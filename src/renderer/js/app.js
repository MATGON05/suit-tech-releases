// ============================================
// APP.JS - COMPLETO COM FINANCEIRO
// ============================================

console.log('🚀 app.js carregando...');

// ============================================
// PERMISSÕES E VALIDAÇÕES GERAIS
// ============================================
window.SUIT_PERFIS = {
    admin: ['*'],
    gerente: ['clientes', 'orcamentos', 'agendamentos', 'estoque', 'financeiro', 'relatorios', 'contas-pagar', 'caixa-entrada', 'caixa-saida'],
    tecnico: ['clientes', 'orcamentos', 'agendamentos', 'estoque'],
    atendente: ['clientes', 'orcamentos', 'agendamentos']
};

window.suitSessaoAtual = function() {
    try { return JSON.parse(localStorage.getItem('sessao_suittech') || '{}'); }
    catch (e) { return {}; }
};

window.suitTemPermissao = function(modulo) {
    const sessao = window.suitSessaoAtual();
    const perfil = sessao.perfil || (sessao.usuario === 'admin' ? 'admin' : 'atendente');
    const permissoes = window.SUIT_PERFIS[perfil] || window.SUIT_PERFIS.atendente;
    return permissoes.includes('*') || permissoes.includes(modulo);
};

window.suitValidarCPF = function(cpf) {
    const valor = String(cpf || '').replace(/\D/g, '');
    if (valor.length !== 11 || /^(\d)\1+$/.test(valor)) return false;
    let soma = 0;
    for (let i = 0; i < 9; i++) soma += Number(valor[i]) * (10 - i);
    let digito = (soma * 10) % 11; if (digito === 10) digito = 0;
    if (digito !== Number(valor[9])) return false;
    soma = 0;
    for (let i = 0; i < 10; i++) soma += Number(valor[i]) * (11 - i);
    digito = (soma * 10) % 11; if (digito === 10) digito = 0;
    return digito === Number(valor[10]);
};

window.suitRegistrarAuditoria = async function(acao, registro, dados, motivo = '') {
    if (window.api?.logAuditoria) return window.api.logAuditoria(acao, registro, null, dados, motivo);
    return null;
};

window.suitAplicarPermissaoPagina = function() {
    const pagina = (window.location.pathname.split('/').pop() || '').replace('.html', '');
    if (['financeiro', 'config-rede', 'lixeira', 'fechamento-caixa'].includes(pagina)) {
        window.location.replace('index.html');
        return false;
    }
    if (!pagina || pagina === 'login' || pagina === 'index') return true;
    if (pagina === 'usuarios') {
        const sessao = window.suitSessaoAtual();
        if ((sessao.perfil || (sessao.usuario === 'admin' ? 'admin' : 'atendente')) !== 'admin') {
            window.location.replace('index.html');
            return false;
        }
        return true;
    }
    if (!window.suitTemPermissao(pagina)) {
        alert('Seu perfil não possui permissão para acessar esta área.');
        window.location.replace('index.html');
        return false;
    }
    return true;
};

document.addEventListener('DOMContentLoaded', window.suitAplicarPermissaoPagina);

// ============================================
// FUNÇÕES DE CLIENTES
// ============================================

window.carregarClientes = async function() {
    try {
        if (typeof window.api === 'undefined') return JSON.parse(localStorage.getItem('clientes') || '[]');
        const resultado = await window.api.buscar('clientes');
        return resultado.sucesso ? resultado.dados : [];
    } catch (e) {
        console.error('Erro ao carregar clientes:', e);
        return [];
    }
};

window.salvarClientes = async function(clientes) {
    try {
        if (typeof window.api === 'undefined') {
            localStorage.setItem('clientes', JSON.stringify(clientes));
            return true;
        }
        const resultado = await window.api.salvar('clientes', clientes);
        return resultado.sucesso;
    } catch (e) {
        console.error('Erro ao salvar clientes:', e);
        return false;
    }
};

window.adicionarCliente = async function(cliente) {
    try {
        const clientes = await window.carregarClientes();
        cliente.id = clientes.length > 0 ? Math.max(...clientes.map(c => c.id || 0)) + 1 : 1;
        cliente._id = 'cli_' + Date.now().toString(36);
        cliente.data_cadastro = new Date().toISOString();
        clientes.push(cliente);
        await window.salvarClientes(clientes);
        return true;
    } catch (e) {
        console.error('Erro ao adicionar cliente:', e);
        return false;
    }
};

window.excluirCliente = async function(id) {
    try {
        let clientes = await window.carregarClientes();
        clientes = clientes.filter(c => c._id !== id && c.id !== id);
        await window.salvarClientes(clientes);
        return true;
    } catch (e) {
        console.error('Erro ao excluir cliente:', e);
        return false;
    }
};

// ============================================
// FUNÇÕES DE VENDAS
// ============================================

window.carregarVendas = async function() {
    try {
        if (typeof window.api === 'undefined') return JSON.parse(localStorage.getItem('vendas') || '[]');
        const resultado = await window.api.buscar('vendas');
        return resultado.sucesso ? resultado.dados : [];
    } catch (e) {
        console.error('Erro ao carregar vendas:', e);
        return [];
    }
};

window.salvarVendas = async function(vendas) {
    try {
        if (typeof window.api === 'undefined') {
            localStorage.setItem('vendas', JSON.stringify(vendas));
            return true;
        }
        const resultado = await window.api.salvar('vendas', vendas);
        return resultado.sucesso;
    } catch (e) {
        console.error('Erro ao salvar vendas:', e);
        return false;
    }
};

// ============================================
// FUNÇÕES DE AGENDAMENTOS
// ============================================

window.carregarAgendamentos = async function() {
    try {
        if (typeof window.api === 'undefined') return JSON.parse(localStorage.getItem('agendamentos') || '[]');
        const resultado = await window.api.buscar('agendamentos');
        return resultado.sucesso ? resultado.dados : [];
    } catch (e) {
        console.error('Erro ao carregar agendamentos:', e);
        return [];
    }
};

window.salvarAgendamentos = async function(agendamentos) {
    try {
        if (typeof window.api === 'undefined') {
            localStorage.setItem('agendamentos', JSON.stringify(agendamentos));
            return true;
        }
        const resultado = await window.api.salvar('agendamentos', agendamentos);
        return resultado.sucesso;
    } catch (e) {
        console.error('Erro ao salvar agendamentos:', e);
        return false;
    }
};

// ============================================
// FUNÇÕES DE CAIXA (com novos campos)
// ============================================

window.carregarCaixaEntrada = async function() {
    try {
        if (typeof window.api === 'undefined') return JSON.parse(localStorage.getItem('caixa_entrada') || '[]');
        const resultado = await window.api.buscar('caixa_entrada');
        return resultado.sucesso ? resultado.dados : [];
    } catch (e) {
        console.error('Erro ao carregar caixa entrada:', e);
        return [];
    }
};

window.salvarCaixaEntrada = async function(dados) {
    try {
        if (typeof window.api === 'undefined') {
            localStorage.setItem('caixa_entrada', JSON.stringify(dados));
            return true;
        }
        const resultado = await window.api.salvar('caixa_entrada', dados);
        return resultado.sucesso;
    } catch (e) {
        console.error('Erro ao salvar caixa entrada:', e);
        return false;
    }
};

window.carregarCaixaSaida = async function() {
    try {
        if (typeof window.api === 'undefined') return JSON.parse(localStorage.getItem('caixa_saida') || '[]');
        const resultado = await window.api.buscar('caixa_saida');
        return resultado.sucesso ? resultado.dados : [];
    } catch (e) {
        console.error('Erro ao carregar caixa saida:', e);
        return [];
    }
};

window.salvarCaixaSaida = async function(dados) {
    try {
        if (typeof window.api === 'undefined') {
            localStorage.setItem('caixa_saida', JSON.stringify(dados));
            return true;
        }
        const resultado = await window.api.salvar('caixa_saida', dados);
        return resultado.sucesso;
    } catch (e) {
        console.error('Erro ao salvar caixa saida:', e);
        return false;
    }
};

// ============================================
// FUNÇÕES DE CONTAS
// ============================================

window.carregarContasPagar = async function() {
    try {
        if (typeof window.api === 'undefined') return JSON.parse(localStorage.getItem('contas_pagar') || '[]');
        const resultado = await window.api.buscar('contas_pagar');
        return resultado.sucesso ? resultado.dados : [];
    } catch (e) {
        console.error('Erro ao carregar contas pagar:', e);
        return [];
    }
};

window.salvarContasPagar = async function(contas) {
    try {
        if (typeof window.api === 'undefined') {
            localStorage.setItem('contas_pagar', JSON.stringify(contas));
            return true;
        }
        const resultado = await window.api.salvar('contas_pagar', contas);
        return resultado.sucesso;
    } catch (e) {
        console.error('Erro ao salvar contas pagar:', e);
        return false;
    }
};

window.carregarValoresReceber = async function() {
    try {
        if (typeof window.api === 'undefined') return JSON.parse(localStorage.getItem('valores_receber') || '[]');
        const resultado = await window.api.buscar('valores_receber');
        return resultado.sucesso ? resultado.dados : [];
    } catch (e) {
        console.error('Erro ao carregar valores receber:', e);
        return [];
    }
};

window.salvarValoresReceber = async function(dados) {
    try {
        if (typeof window.api === 'undefined') {
            localStorage.setItem('valores_receber', JSON.stringify(dados));
            return true;
        }
        const resultado = await window.api.salvar('valores_receber', dados);
        return resultado.sucesso;
    } catch (e) {
        console.error('Erro ao salvar valores receber:', e);
        return false;
    }
};

// ============================================
// FUNÇÕES DE DEVOLUÇÕES
// ============================================

window.carregarDevolucoes = async function() {
    try {
        if (typeof window.api === 'undefined') return JSON.parse(localStorage.getItem('devolucoes') || '[]');
        const resultado = await window.api.buscar('devolucoes');
        return resultado.sucesso ? resultado.dados : [];
    } catch (e) {
        console.error('Erro ao carregar devolucoes:', e);
        return [];
    }
};

window.salvarDevolucoes = async function(devolucoes) {
    try {
        if (typeof window.api === 'undefined') {
            localStorage.setItem('devolucoes', JSON.stringify(devolucoes));
            return true;
        }
        const resultado = await window.api.salvar('devolucoes', devolucoes);
        return resultado.sucesso;
    } catch (e) {
        console.error('Erro ao salvar devolucoes:', e);
        return false;
    }
};

// ============================================
// FUNÇÃO PARA POPULAR SELECTS
// ============================================

window.popularSelectClientes = function(selectId, selectedValue = '') {
    const select = document.getElementById(selectId);
    if (!select) return;
    window.carregarClientes().then(clientes => {
        select.innerHTML = '<option value="">Selecione um cliente...</option>';
        clientes.forEach(c => {
            const option = document.createElement('option');
            option.value = c._id || c.id;
            option.textContent = c.nome + (c.telefone ? ' - ' + c.telefone : '');
            option.dataset.nome = c.nome || '';
            option.dataset.telefone = c.telefone || '';
            option.dataset.email = c.email || '';
            option.dataset.cpf = c.cpf || '';
            option.dataset.endereco = c.endereco || '';
            if (option.value === selectedValue || c._id === selectedValue || c.id == selectedValue) {
                option.selected = true;
            }
            select.appendChild(option);
        });
    });
};

window.preencherDadosCliente = function(selectId, mapeamento) {
    const select = document.getElementById(selectId);
    if (!select) return;
    const option = select.options[select.selectedIndex];
    if (!option || !option.value) {
        Object.values(mapeamento).forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        return;
    }
    Object.entries(mapeamento).forEach(([key, id]) => {
        const el = document.getElementById(id);
        if (el) el.value = option.dataset[key] || '';
    });
};

// ============================================
// CARREGAR CONTAS E CATEGORIAS PARA SELECTS
// ============================================

window.carregarContasSelect = async function(selectId, selectedValue = '') {
    const select = document.getElementById(selectId);
    if (!select) return;
    try {
        const result = await window.api.contasBuscar();
        const contas = result.sucesso ? result.dados : [];
        select.innerHTML = '<option value="">Selecione uma conta...</option>';
        contas.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c._id;
            opt.textContent = c.nome + (c.tipo ? ' (' + c.tipo + ')' : '');
            if (opt.value === selectedValue) opt.selected = true;
            select.appendChild(opt);
        });
    } catch (e) {
        console.error('Erro ao carregar contas:', e);
    }
};

window.carregarCategoriasSelect = async function(selectId, selectedValue = '', tipo = null) {
    const select = document.getElementById(selectId);
    if (!select) return;
    try {
        const result = await window.api.categoriasBuscar();
        let categorias = result.sucesso ? result.dados : [];
        if (tipo) categorias = categorias.filter(c => c.tipo === tipo);
        select.innerHTML = '<option value="">Selecione uma categoria...</option>';
        categorias.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c._id;
            opt.textContent = c.nome + (c.tipo ? ' (' + c.tipo + ')' : '');
            if (opt.value === selectedValue) opt.selected = true;
            select.appendChild(opt);
        });
    } catch (e) {
        console.error('Erro ao carregar categorias:', e);
    }
};

window.carregarFornecedoresSelect = async function(selectId, selectedValue = '') {
    const select = document.getElementById(selectId);
    if (!select) return;
    try {
        const result = await window.api.fornecedoresBuscar();
        const fornecedores = result.sucesso ? result.dados : [];
        select.innerHTML = '<option value="">Selecione um fornecedor...</option>';
        fornecedores.forEach(f => {
            const opt = document.createElement('option');
            opt.value = f._id;
            opt.textContent = f.nome + (f.telefone ? ' - ' + f.telefone : '');
            if (opt.value === selectedValue) opt.selected = true;
            select.appendChild(opt);
        });
    } catch (e) {
        console.error('Erro ao carregar fornecedores:', e);
    }
};

console.log('✅ app.js carregado com sucesso!');
