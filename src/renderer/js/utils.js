// ============================================
// utils.js - FUNÇÕES COMPARTILHADAS
// ============================================

// ============================================
// TOAST
// ============================================
function showToast(mensagem, tipo = 'success') {
    const toast = document.getElementById('toast');
    if (!toast) {
        console.log('📢', mensagem);
        return;
    }
    toast.textContent = mensagem;
    toast.className = 'toast toast-' + tipo;
    setTimeout(() => toast.classList.add('show'), 100);
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// ============================================
// LOGOUT
// ============================================
function fazerLogout() {
    if (confirm('Deseja realmente sair?')) {
        if (window.electron && window.electron.supabaseLogout) {
            window.electron.supabaseLogout().catch(() => {});
        }
        localStorage.removeItem('sessao_suittech');
        window.location.href = 'login.html';
    }
}

// ============================================
// FORMATADORES
// ============================================
function formatarMoeda(valor) {
    return `R$ ${(valor || 0).toFixed(2).replace('.', ',')}`;
}

function formatarData(data) {
    if (!data) return '-';
    return new Date(data).toLocaleDateString('pt-BR');
}

function formatarDataHora(data) {
    if (!data) return '-';
    return new Date(data).toLocaleString('pt-BR');
}

// ============================================
// WHATSAPP
// ============================================
async function enviarWhatsApp(numero, mensagem) {
    const numeroLimpo = String(numero || '').replace(/\D/g, '');
    if (numeroLimpo.length < 10) {
        showToast('❌ Número inválido!', 'error');
        return false;
    }
    const numeroCompleto = numeroLimpo.startsWith('55') ? numeroLimpo : '55' + numeroLimpo;
    const texto = encodeURIComponent(mensagem || 'Olá! Vim pelo sistema SUIT-TECH.');
    const appUrl = `whatsapp://send?phone=${numeroCompleto}&text=${texto}`;
    const webUrl = `https://wa.me/${numeroCompleto}?text=${texto}`;
    try {
        if (window.electron?.abrirWhatsAppDesktop) {
            const resultado = await window.electron.abrirWhatsAppDesktop(appUrl);
            if (resultado?.sucesso) {
                showToast('📱 WhatsApp Desktop a ser aberto...', 'success');
                return true;
            }
            console.warn('WhatsApp Desktop indisponível:', resultado?.erro || 'erro desconhecido');
        }
    } catch (erro) {
        console.error('Falha ao abrir WhatsApp Desktop:', erro);
    }
    const janela = window.open(webUrl, '_blank');
    showToast(janela ? '📤 WhatsApp Web a ser aberto...' : '❌ Não foi possível abrir o WhatsApp', janela ? 'success' : 'error');
    return !!janela;
}

// ============================================
// STATUS
// ============================================
const STATUS_LABELS = {
    'pendente': 'Pendente',
    'aprovado': 'Aprovado',
    'em-reparo': 'Em Reparo',
    'concluido': 'Concluído',
    'entregue': 'Entregue',
    'cancelado': 'Cancelado',
    'agendado': 'Agendado',
    'confirmado': 'Confirmado',
    'pago': 'Pago',
    'parcial': 'Parcial',
    'quitado': 'Quitado',
    'vencido': 'Vencido'
};

function getStatusLabel(status) {
    return STATUS_LABELS[status] || status || 'Pendente';
}

// ============================================
// CRUD GENERICO
// ============================================
async function carregarDados(colecao) {
    try {
        if (typeof window.api === 'undefined' || !window.api.buscar) {
            return [];
        }
        const resultado = await window.api.buscar(colecao);
        return resultado.sucesso ? resultado.dados || [] : [];
    } catch (erro) {
        console.error(`Erro ao carregar ${colecao}:`, erro);
        return [];
    }
}

async function salvarDadosGenerico(colecao, dados) {
    try {
        if (typeof window.api === 'undefined' || !window.api.salvar) {
            showToast('❌ Banco não disponível', 'error');
            return null;
        }
        const resultado = await window.api.salvar(colecao, dados);
        if (resultado.sucesso) {
            return resultado.dados;
        } else {
            showToast('❌ Erro: ' + resultado.erro, 'error');
            return null;
        }
    } catch (erro) {
        console.error('Erro:', erro);
        showToast('❌ Erro: ' + erro.message, 'error');
        return null;
    }
}

async function atualizarDadosGenerico(colecao, id, dados) {
    try {
        if (typeof window.api === 'undefined' || !window.api.atualizar) {
            showToast('❌ Banco não disponível', 'error');
            return null;
        }
        const resultado = await window.api.atualizar(colecao, id, dados);
        if (resultado.sucesso) {
            return resultado.dados;
        } else {
            showToast('❌ Erro: ' + resultado.erro, 'error');
            return null;
        }
    } catch (erro) {
        console.error('Erro:', erro);
        showToast('❌ Erro: ' + erro.message, 'error');
        return null;
    }
}

async function deletarDadosGenerico(colecao, id, nome = 'item') {
    if (!confirm(`❌ Excluir "${nome}"?`)) return false;
    try {
        if (typeof window.api === 'undefined' || !window.api.deletar) {
            showToast('❌ Banco não disponível', 'error');
            return false;
        }
        const resultado = await window.api.deletar(colecao, id);
        if (resultado.sucesso) {
            showToast('✅ Excluído!', 'success');
            return true;
        } else {
            showToast('❌ Erro: ' + resultado.erro, 'error');
            return false;
        }
    } catch (erro) {
        console.error('Erro:', erro);
        showToast('❌ Erro: ' + erro.message, 'error');
        return false;
    }
}

// ============================================
// FILTROS
// ============================================
function filtrarPorMes(dados, campoData, mes, ano) {
    if (!mes || !ano) return dados;
    return dados.filter(item => {
        if (!item[campoData]) return false;
        const d = new Date(item[campoData]);
        return d.getFullYear() == ano && (d.getMonth() + 1) == mes;
    });
}

function filtrarPorTexto(dados, campo, texto) {
    if (!texto) return dados;
    return dados.filter(item => 
        (item[campo] || '').toLowerCase().includes(texto.toLowerCase())
    );
}

// ============================================
// GERAR ID
// ============================================
function gerarId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ============================================
// EXPORTAR CSV
// ============================================
function exportarCSV(dados, nomeArquivo, cabecalho) {
    if (!dados || dados.length === 0) {
        showToast('❌ Nenhum dado para exportar', 'error');
        return;
    }
    
    let csv = cabecalho.join(',') + '\n';
    dados.forEach(item => {
        const linha = cabecalho.map(campo => {
            const valor = item[campo] || '';
            return `"${String(valor).replace(/"/g, '""')}"`;
        }).join(',');
        csv += linha + '\n';
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${nomeArquivo}_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
    showToast('📥 CSV exportado!', 'success');
}

// ============================================
// FUNÇÕES FINANCEIRAS
// ============================================
function calcularValorLiquido(bruto, desconto = 0, taxa = 0) {
    return Math.max(0, bruto - desconto - taxa);
}

function getTipoSaidaLabel(tipo) {
    return tipo === 'empresarial' ? '🏢 Empresarial' : '👤 Pessoal';
}

console.log('✅ utils.js carregado!');
