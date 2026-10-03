const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const intake = fs.readFileSync(path.join(root, 'src/renderer/pages/novo-atendimento.html'), 'utf8');
const budgets = fs.readFileSync(path.join(root, 'src/renderer/pages/orcamentos.html'), 'utf8');
const menu = fs.readFileSync(path.join(root, 'src/renderer/pages/menu.html'), 'utf8');

for (const id of [
  'cliente-busca', 'cliente-resultados', 'cliente-select', 'cliente-nome', 'cliente-telefone',
  'cliente-cpf', 'aparelho', 'marca', 'modelo', 'cor', 'serie', 'imei', 'defeito',
  'acessorios-lista', 'condition-table', 'acesso-aparelho', 'prioridade', 'previsao',
  'autorizacao-diagnostico', 'confirmacao-backup'
]) assert.ok(intake.includes(`id="${id}"`), `campo da recepção em falta: ${id}`);

assert.ok(intake.includes('Digite nome, telefone ou CPF'), 'a interface deve explicar os campos pesquisáveis');
assert.ok(!/\b(registe|registar|registo|ecrã|equipa|contacto|seleccionar)\b/i.test(intake), 'a ficha deve manter a ortografia brasileira consistente');
assert.ok(intake.includes('window.api.salvar(\'vendas\', body)'), 'a OS deve continuar integrada na coleção de OS/orçamentos existente');
assert.ok(intake.includes("origem: 'novo_atendimento'"), 'a origem da ordem de serviço deve ser marcada');
assert.ok(intake.includes("etapa_atendimento: 'recebido_para_avaliacao'"), 'a OS deve nascer no estágio de avaliação');
assert.ok(intake.includes("status: 'pendente'"), 'o status legado deve permanecer compatível');
assert.ok(!intake.includes('id="senha-aparelho"'), 'a ficha não deve recolher senhas/PINs');
assert.ok(!intake.includes('id="mao-obra"') && !intake.includes('id="pecas"'), 'a recepção não deve cobrar nem estimar preços');
assert.ok(!intake.includes('checklist-saida'), 'a recepção não deve misturar checklist de entrega');
assert.ok(intake.includes('Nenhum reparo será iniciado sem sua aprovação'), 'o comprovante deve esclarecer que o reparo requer aprovação');
assert.ok(budgets.includes("'Recebido para avaliação'"), 'a OS deve aparecer identificada como recebida na lista');
assert.ok(budgets.includes('...(orçamentoAnterior || {})'), 'a edição de orçamento deve preservar os dados específicos da recepção');
assert.ok(menu.includes('Entrada de Equipamento'), 'o menu deve reflectir a função da aba');

const inlineScript = intake.match(/<script>\s*([\s\S]*?)<\/script>/i)?.[1];
assert.ok(inlineScript, 'script da página encontrado para testes');
const windowMock = {};
const documentMock = { addEventListener() {} };
vm.runInNewContext(inlineScript, { window: windowMock, document: documentMock, console });
const cliente = { nome: 'João da Silva', telefone: '(11) 98765-4321', cpf: '123.456.789-00' };
for (const termo of ['João', 'joao da', 'Silva', '(11) 98765', '987654321', '123.456.789', '456789']) {
  assert.equal(windowMock.clienteCorrespondeBusca(cliente, termo), true, `deve localizar por ${termo}`);
}
assert.equal(windowMock.clienteCorrespondeBusca(cliente, 'Maria'), false, 'não deve corresponder a cliente diferente');
assert.equal(windowMock.clienteCorrespondeBusca(cliente, ''), false, 'busca vazia não deve retornar cliente');

console.log('OK: testes da ficha e da busca por nome, telefone e CPF passaram.');
