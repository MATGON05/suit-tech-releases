const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const contasPagarPage = fs.readFileSync(path.join(projectRoot, 'src/renderer/pages/contas-pagar.html'), 'utf8');
const valoresReceberPage = fs.readFileSync(path.join(projectRoot, 'src/renderer/pages/valores-receber.html'), 'utf8');
assert.ok(contasPagarPage.includes('reativarContasPendentesHistoricas'), 'a página deve reativar contas antigas em aberto');
assert.ok(contasPagarPage.includes('garantirContaAtiva'), 'as ações devem ativar a conta antes de a alterar');
assert.ok(!contasPagarPage.includes("conta.status === 'paga' || conta.arquivada === true"), 'a flag arquivada não deve ser tratada como conta paga');
assert.ok(valoresReceberPage.includes('reativarValoresReceberHistoricos'), 'a página de recebíveis deve reativar pendências antigas');
assert.ok(valoresReceberPage.includes('recebivelPendenteHistorico(item)'), 'pendências antigas devem manter as ações e não mostrar o selo arquivado');
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
const outrasColecoes = {
  contas_pagar: [{ _id: 'conta-set', vencimento: '2026-09-25', descricao: 'Conta pendente de setembro', status: 'pendente', valor: 100, saldo_restante: 100 }],
  valores_receber: [{ _id: 'receber-set', data: '2026-09-26', dataAcerto: '2026-09-26', cliente: 'Cliente Setembro', descricao: 'Serviço parcelado', status: 'parcial', valorTotal: 120, entrada: 20, valorParcela: 16.67, faltaReceber: 100, parcelas: 6 }],
  devolucoes: []
};

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
  if (colecao === 'contas_pagar') {
    const existente = outrasColecoes.contas_pagar.findIndex(conta => conta._id === item._id);
    if (existente >= 0) outrasColecoes.contas_pagar[existente] = item;
    else outrasColecoes.contas_pagar.push(item);
  }
  if (colecao === 'valores_receber') {
    const existente = outrasColecoes.valores_receber.findIndex(valor => valor._id === item._id);
    if (existente >= 0) outrasColecoes.valores_receber[existente] = item;
    else outrasColecoes.valores_receber.push(item);
  }
  return { sucesso: true, dados: item };
};
api.deletar = async (colecao, id) => {
  if (colecao === 'caixa_entrada') entradas = entradas.filter(item => item._id !== id);
  if (colecao === 'caixa_saida') saidas = saidas.filter(item => item._id !== id);
  if (colecao === 'contas_pagar') outrasColecoes.contas_pagar = outrasColecoes.contas_pagar.filter(item => item._id !== id);
  if (colecao === 'valores_receber') outrasColecoes.valores_receber = outrasColecoes.valores_receber.filter(item => item._id !== id);
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
api.atualizar = async (colecao, id, atualizada) => {
  if (colecao === 'contas_pagar') {
    const existente = outrasColecoes.contas_pagar.findIndex(conta => conta._id === id);
    if (existente < 0) return { sucesso: false, erro: 'Item não encontrado' };
    outrasColecoes.contas_pagar[existente] = atualizada;
    return { sucesso: true };
  }
  if (colecao === 'valores_receber') {
    const existente = outrasColecoes.valores_receber.findIndex(item => item._id === id);
    if (existente < 0) return { sucesso: false, erro: 'Item não encontrado' };
    outrasColecoes.valores_receber[existente] = atualizada;
    return { sucesso: true };
  }
  return { sucesso: false, erro: 'Coleção não simulada' };
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
    if (colecao === 'contas_pagar') {
      const existente = outrasColecoes.contas_pagar.findIndex(conta => conta._id === item._id);
      if (existente >= 0) outrasColecoes.contas_pagar[existente] = item;
      else outrasColecoes.contas_pagar.push(item);
    }
    if (colecao === 'valores_receber') {
      const existente = outrasColecoes.valores_receber.findIndex(valor => valor._id === item._id);
      if (existente >= 0) outrasColecoes.valores_receber[existente] = item;
      else outrasColecoes.valores_receber.push(item);
    }
    return { sucesso: true, dados: item };
  };
  const resultado = await api.fecharMes();
  assert.equal(resultado.sucesso, true, resultado.erro || resultado.mensagem);
  assert.equal(localStorage.getItem('ultimo_fechamento_mes'), '2026-09');
  assert.deepEqual(entradas.map(item => item._id), ['ent-out']);
  assert.deepEqual(saidas.map(item => item._id), ['sai-out']);
  assert.equal(historico.length, 4);
  assert.equal(contas[0].saldo_inicial, 120, 'saldo inicial deve incorporar apenas o resultado do mês fechado');
  assert.equal((await api.consolidarSaldoContas()).caixa, 137, 'saldo total deve permanecer constante após o fecho');
  assert.equal(api.verificarFechamentoPendente(), false);
  const repetido = await api.fecharMes();
  assert.equal(repetido.sucesso, false, 'não deve permitir fechar o mesmo mês duas vezes');
  historico.push({
    _id: 'hist-conta-ref-atual', mes: '2026-09', data_arquivamento: '2026-09-30T10:00:00.000Z', colecao: 'contas_pagar',
    dados: { _id: 'conta-ref-atual', vencimento: '2026-08-25', mes_referencia: '2026-10', descricao: 'Conta vencida de agosto', status: 'vencida', valor: 50, saldo_restante: 50 }
  });
  outrasColecoes.contas_pagar.push({ _id: 'conta-flag-arquivada', vencimento: '2026-08-01', mes_referencia: '2026-09', descricao: 'Conta ativa marcada como arquivada', status: 'pendente', valor: 40, saldo_restante: 40, arquivada: true });
  const reativacao = await api.reativarContasPendentesHistoricas('2026-10');
  assert.equal(reativacao.sucesso, true);
  assert.equal(reativacao.reativadas, 3);
  assert.equal(outrasColecoes.contas_pagar.length, 3, 'contas abertas antigas devem voltar à coleção ativa');
  const contaReativada = outrasColecoes.contas_pagar.find(conta => conta._id === 'conta-set');
  assert.equal(contaReativada.mes_referencia, '2026-10');
  assert.equal(contaReativada.vencimento, '2026-09-25', 'preserva o vencimento original');
  assert.equal(contaReativada.arquivada, false);
  assert.equal(outrasColecoes.contas_pagar.find(conta => conta._id === 'conta-ref-atual').status, 'vencida', 'reativa mesmo se a competência já estava marcada como atual');
  assert.equal(outrasColecoes.contas_pagar.find(conta => conta._id === 'conta-flag-arquivada').arquivada, false, 'limpa a flag arquivada de registo ativo ainda em aberto');
  const reativacaoReceber = await api.reativarValoresReceberHistoricos('2026-10');
  assert.equal(reativacaoReceber.sucesso, true);
  assert.equal(reativacaoReceber.reativadas, 1);
  assert.equal(outrasColecoes.valores_receber.length, 1);
  assert.equal(outrasColecoes.valores_receber[0].mes_referencia, '2026-10');
  assert.equal(outrasColecoes.valores_receber[0].faltaReceber, 100, 'mantém o saldo ainda por receber');
  assert.equal(outrasColecoes.valores_receber[0].arquivada, false);
  const segundaReativacao = await api.reativarContasPendentesHistoricas('2026-10');
  assert.equal(segundaReativacao.reativadas, 0, 'não duplica uma conta que já está ativa');
  assert.equal(outrasColecoes.contas_pagar.length, 3);
  historico.push({ _id: 'hist-duplicado', mes: '2026-09', colecao: 'caixa_entrada', dados: entradas[0] });
  const entradasComHistorico = await api.buscarComHistorico('caixa_entrada');
  assert.equal(entradasComHistorico.sucesso, true);
  assert.deepEqual(entradasComHistorico.dados.map(item => item._id).sort(), ['ent-out', 'ent-set']);
  assert.equal(entradasComHistorico.dados.find(item => item._id === 'ent-set')._arquivado_historico, true);
  assert.equal(entradasComHistorico.dados.find(item => item._id === 'ent-out')._arquivado_historico, undefined);
  const contaComAbatimento = outrasColecoes.contas_pagar.find(conta => conta._id === 'conta-set');
  contaComAbatimento.status = 'parcial';
  contaComAbatimento.saldo_restante = 65;
  outrasColecoes.valores_receber[0].faltaReceber = 75;
  outrasColecoes.valores_receber[0].status = 'parcial';
  const fechamentoOutubro = await api.fecharMes('2026-10');
  assert.equal(fechamentoOutubro.sucesso, true, fechamentoOutubro.erro || fechamentoOutubro.mensagem);
  assert.equal(outrasColecoes.contas_pagar.length, 0, 'as contas são arquivadas pela competência atual, mesmo com vencimento original antigo');
  assert.equal(outrasColecoes.valores_receber.length, 0, 'os valores a receber são arquivados pela competência ativa');
  const reativacaoNovembro = await api.reativarContasPendentesHistoricas('2026-11');
  assert.equal(reativacaoNovembro.sucesso, true);
  assert.equal(reativacaoNovembro.reativadas, 3);
  assert.equal(outrasColecoes.contas_pagar.find(conta => conta._id === 'conta-set').status, 'parcial');
  assert.equal(outrasColecoes.contas_pagar.find(conta => conta._id === 'conta-set').saldo_restante, 65, 'a reativação mantém o saldo após abatimento');
  const reativacaoReceberNovembro = await api.reativarValoresReceberHistoricos('2026-11');
  assert.equal(reativacaoReceberNovembro.sucesso, true);
  assert.equal(reativacaoReceberNovembro.reativadas, 1);
  assert.equal(outrasColecoes.valores_receber[0].faltaReceber, 75, 'a reativação mantém o saldo parcial a receber');
  console.log('OK: testes de caixa mensal passaram.');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
