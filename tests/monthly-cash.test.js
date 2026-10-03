const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const storage = new Map();
const localStorage = {
  getItem: key => storage.has(key) ? storage.get(key) : null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: key => storage.delete(key)
};

const RealDate = Date;
class FixedDate extends RealDate {
  constructor(...args) {
    super(...(args.length ? args : ['2026-10-03T12:00:00-03:00']));
  }
  static now() { return new RealDate('2026-10-03T15:00:00Z').getTime(); }
}

const window = {};
const context = vm.createContext({
  window,
  localStorage,
  console: { log() {}, warn() {}, error() {} },
  Date: FixedDate,
  Math,
  Set,
  Number,
  String,
  Array,
  Object,
  JSON,
  RegExp,
  Error,
  Promise,
  encodeURIComponent
});
vm.runInContext(fs.readFileSync(path.join(projectRoot, 'src/renderer/js/api.js'), 'utf8'), context, {
  filename: 'src/renderer/js/api.js'
});

const api = window.api;
assert.ok(api, 'a API deve ser exposta em window.api');

// Regressão: em Brasília, Date("AAAA-MM-DD") era convertido para o dia anterior.
const primeiroDia = window.parseDataSegura('2026-10-01');
assert.equal(primeiroDia.getFullYear(), 2026);
assert.equal(primeiroDia.getMonth() + 1, 10);
assert.equal(primeiroDia.getDate(), 1);
assert.equal(window.parseDataSegura('data-inválida'), null);

assert.equal(window.mesFechamentoAlvo(new FixedDate(2026, 9, 3)), '2026-09');
assert.equal(window.mesFechamentoAlvo(new FixedDate(2026, 0, 3)), '2025-12');
assert.equal(window.mesFechamentoAlvo(), '2026-09');

// Simula movimentos nos dois lados da viragem de mês.
let entradas = [
  { _id: 'ent-set', data: '2026-09-30', conta_id: 'caixa', venda: 30, valor_liquido: 30, status: 'confirmado' },
  { _id: 'ent-out', data: '2026-10-01', conta_id: 'caixa', venda: 20, valor_liquido: 20, status: 'confirmado' }
];
let saidas = [
  { _id: 'sai-set', data: '2026-09-30', conta_id: 'caixa', valor: 10, pago: true, status: 'pago' },
  { _id: 'sai-out', data: '2026-10-01', conta_id: 'caixa', valor: 3, pago: true, status: 'pago' }
];
let contas = [{ _id: 'caixa', nome: 'Caixa', saldo_inicial: 100 }];
let historico = [];
const outrasColecoes = { contas_pagar: [], valores_receber: [], devolucoes: [] };

api.backup = async () => ({ sucesso: true });
api.buscar = async colecao => ({
  sucesso: true,
  dados: colecao === 'caixa_entrada' ? entradas :
    colecao === 'caixa_saida' ? saidas :
      colecao === 'historico_mensal' ? historico.slice() :
        colecao === 'financial_accounts' ? contas : (outrasColecoes[colecao] || [])
});
api.salvar = async (colecao, item) => {
  if (colecao === 'historico_mensal') historico.push(item);
  return { sucesso: true, dados: item };
};
api.deletar = async (colecao, id) => {
  if (colecao === 'caixa_entrada') entradas = entradas.filter(item => item._id !== id);
  if (colecao === 'caixa_saida') saidas = saidas.filter(item => item._id !== id);
  return { sucesso: true };
};
api.contasBuscar = async () => ({ sucesso: true, dados: contas });
api.consolidarSaldoContas = async () => {
  const saldo = contas[0].saldo_inicial
    + entradas.reduce((n, item) => n + (Number(item.valor_liquido ?? item.venda) || 0), 0)
    - saidas.reduce((n, item) => n + (Number(item.valor) || 0), 0);
  return { caixa: saldo, __sem_conta__: 0 };
};
api.contasAtualizar = async (id, atualizada) => {
  contas = contas.map(conta => conta._id === id ? atualizada : conta);
  return { sucesso: true };
};

(async () => {
  api.backup = async () => ({ sucesso: false, erro: 'teste de falha' });
  const semBackup = await api.fecharMes();
  assert.equal(semBackup.sucesso, false);
  assert.equal(entradas.length, 2, 'não apaga movimentos sem backup confirmado');
  assert.equal(saidas.length, 2, 'não apaga saídas sem backup confirmado');

  api.backup = async () => ({ sucesso: true });
  api.salvar = async () => ({ sucesso: false, erro: 'teste de falha de arquivo' });
  const semArquivo = await api.fecharMes();
  assert.equal(semArquivo.sucesso, false);
  assert.equal(entradas.length, 2, 'não apaga movimentos se o arquivo falhar');
  assert.equal(saidas.length, 2, 'não apaga saídas se o arquivo falhar');

  api.salvar = async (colecao, item) => {
    if (colecao === 'historico_mensal') historico.push(item);
    return { sucesso: true, dados: item };
  };
  const resultado = await api.fecharMes();
  assert.equal(resultado.sucesso, true, resultado.erro || resultado.mensagem);
  assert.equal(localStorage.getItem('ultimo_fechamento_mes'), '2026-09');
  assert.deepEqual(entradas.map(item => item._id), ['ent-out']);
  assert.deepEqual(saidas.map(item => item._id), ['sai-out']);
  assert.equal(historico.length, 2);
  assert.equal(contas[0].saldo_inicial, 120, 'saldo inicial deve incorporar apenas o resultado do mês fechado');
  assert.equal((await api.consolidarSaldoContas()).caixa, 137, 'saldo total deve permanecer constante após o fecho');
  assert.equal(api.verificarFechamentoPendente(), false);
  const repetido = await api.fecharMes();
  assert.equal(repetido.sucesso, false, 'não deve permitir fechar o mesmo mês duas vezes');
  console.log('OK: testes de caixa mensal passaram.');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
