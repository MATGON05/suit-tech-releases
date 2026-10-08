// main.js - SUIT-TECH Financeiro
console.log('🚀 SUIT-TECH Financeiro carregando...');

// Função principal que inicializa o sistema
function iniciarSistema() {
    console.log('✅ Sistema SUIT-TECH Financeiro iniciado!');
    
    // Verificar se o usuário está logado
    verificarLogin();
    
    // Carregar dados iniciais
    carregarDados();
    
    // Inicializar módulos
    inicializarModulos();
    
    // Executar migração de dados (primeira execução)
    migrarDadosFinanceiros();
}

// Verificar se o usuário está logado
function verificarLogin() {
    const sessao = localStorage.getItem('sessao_suittech');
    if (sessao) {
        try {
            const dados = JSON.parse(sessao);
            if (dados.logado) {
                console.log(`👤 Usuário logado: ${dados.nome}`);
                const nomeEl = document.getElementById('nome-usuario');
                if (nomeEl) nomeEl.textContent = dados.nome;
                return true;
            }
        } catch (e) {}
    }
    // Se não estiver logado, redirecionar (exceto se estiver na página de login)
    if (!window.location.href.includes('login.html')) {
        window.location.href = 'login.html';
    }
    return false;
}

// Carregar dados dos JSON
function carregarDados() {
    console.log('📊 Carregando dados...');
    // As funções de carregamento estão em app.js
}

// Inicializar os módulos do sistema
function inicializarModulos() {
    console.log('🧩 Inicializando módulos...');
    document.dispatchEvent(new Event('sistema-carregado'));
}

// Migrar dados financeiros (executa uma vez)
async function migrarDadosFinanceiros() {
    try {
        const jaMigrou = localStorage.getItem('migracao_financeira_realizada');
        if (jaMigrou) {
            console.log('✅ Migração financeira já realizada');
            return;
        }
        console.log('🔄 Executando migração financeira...');
        if (typeof window.api !== 'undefined' && window.api.migrarDadosFinanceiros) {
            const resultado = await window.api.migrarDadosFinanceiros();
            if (resultado.sucesso) {
                localStorage.setItem('migracao_financeira_realizada', 'true');
                console.log('✅ Migração concluída:', resultado.mensagem);
            } else {
                console.error('❌ Erro na migração:', resultado.erro);
            }
        }
    } catch (e) {
        console.error('❌ Erro na migração:', e);
    }
}

// Iniciar quando o DOM estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciarSistema);
} else {
    iniciarSistema();
}

// Exportar módulo se estiver usando Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { iniciarSistema };
}

console.log('✅ main.js carregado com sucesso!');