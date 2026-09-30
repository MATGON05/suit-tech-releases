// ============================================
// API.JS - VERSÃO COMPLETA COM FINANCEIRO E FECHAMENTO
// ============================================

console.log('📦 API Financeira carregando...');

// Converte 'YYYY-MM-DD' para Date local
function dataLocalHojeISO(data = new Date()) {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const dia = String(data.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
}

window.dataLocalHojeISO = dataLocalHojeISO;

function parseDataSegura(valor) {
    if (!valor) return null;
    if (typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor)) {
        const [a, m, d] = valor.split('-').map(Number);
        return new Date(a, m - 1, d);
    }
    const d = new Date(valor);
    return isNaN(d.getTime()) ? null : d;
}

async function chamarSupabase(operacao, colecao, payload) {
    if (!window.electron || !window.electron.supabaseCrud) return { remoto: false };
    return window.electron.supabaseCrud(operacao, colecao, payload);
}

const api = {
    // ============================================
    // CRUD BÁSICO
    // ============================================
    buscar: async function(colecao) {
        console.log(`📂 Buscando ${colecao}...`);
        try {
            const remoto = await chamarSupabase('buscar', colecao);
            if (remoto.remoto) {
                if (remoto.sucesso === false) throw new Error(remoto.erro || 'Erro ao consultar Supabase');
                return { sucesso: true, dados: remoto.dados || [], remoto: true };
            }
            const localData = localStorage.getItem(`db_${colecao}`);
            if (localData) {
                const dados = JSON.parse(localData);
                console.log(`✅ ${colecao} carregado: ${dados.length} itens`);
                return { sucesso: true, dados: dados };
            }
            return { sucesso: true, dados: [] };
        } catch (error) {
            console.error(`❌ Erro ao buscar ${colecao}:`, error);
            return { sucesso: false, dados: [], erro: error.message };
        }
    },

    salvar: async function(colecao, dados) {
        console.log(`💾 Salvando ${colecao}...`);
        try {
            const remoto = await chamarSupabase('salvar', colecao, dados);
            if (remoto.remoto) {
                if (remoto.sucesso === false) throw new Error(remoto.erro || 'Erro ao salvar no Supabase');
                return { sucesso: true, dados: remoto.dados, remoto: true };
            }
            let lista = [];
            const localData = localStorage.getItem(`db_${colecao}`);
            if (localData) lista = JSON.parse(localData);

            if (Array.isArray(dados)) {
                lista = dados;
            } else {
                if (!dados._id) {
                    dados._id = 'id_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
                }
                if (!dados.data_criacao) dados.data_criacao = new Date().toISOString();
                lista.push(dados);
            }

            localStorage.setItem(`db_${colecao}`, JSON.stringify(lista));
            console.log(`✅ ${colecao} salvo: ${lista.length} itens`);
            return { sucesso: true, dados: dados };
        } catch (error) {
            console.error(`❌ Erro ao salvar ${colecao}:`, error);
            return { sucesso: false, erro: error.message };
        }
    },

    atualizar: async function(colecao, id, dados) {
        console.log(`🔄 Atualizando ${colecao}...`);
        try {
            const remoto = await chamarSupabase('atualizar', colecao, { id, dados });
            if (remoto.remoto) {
                if (remoto.sucesso === false) throw new Error(remoto.erro || 'Erro ao atualizar no Supabase');
                return { sucesso: true, dados: remoto.dados, remoto: true };
            }
            const localData = localStorage.getItem(`db_${colecao}`);
            let lista = localData ? JSON.parse(localData) : [];
            const index = lista.findIndex(item => item._id === id);
            if (index !== -1) {
                dados._id = id;
                dados.data_atualizacao = new Date().toISOString();
                lista[index] = dados;
                localStorage.setItem(`db_${colecao}`, JSON.stringify(lista));
                await this.logAuditoria('atualizacao', colecao, null, dados, 'Atualização via API');
                return { sucesso: true };
            }
            return { sucesso: false, erro: 'Item não encontrado' };
        } catch (error) {
            return { sucesso: false, erro: error.message };
        }
    },

    deletar: async function(colecao, id) {
        console.log(`🗑️ Deletando ${colecao}...`);
        try {
            const remoto = await chamarSupabase('deletar', colecao, { id });
            if (remoto.remoto) {
                if (remoto.sucesso === false) throw new Error(remoto.erro || 'Erro ao excluir no Supabase');
                return { sucesso: true, remoto: true };
            }
            const localData = localStorage.getItem(`db_${colecao}`);
            let lista = localData ? JSON.parse(localData) : [];
            const item = lista.find(i => i._id === id);
            lista = lista.filter(item => item._id !== id);
            localStorage.setItem(`db_${colecao}`, JSON.stringify(lista));
            if (item) {
                await this.logAuditoria('exclusao', colecao, item, null, 'Exclusão via API');
            }
            return { sucesso: true };
        } catch (error) {
            return { sucesso: false, erro: error.message };
        }
    },

    // ============================================
    // NOVAS COLEÇÕES FINANCEIRAS
    // ============================================
    contasBuscar: async function() {
        return this.buscar('financial_accounts');
    },
    contasSalvar: async function(conta) {
        return this.salvar('financial_accounts', conta);
    },
    contasAtualizar: async function(id, dados) {
        return this.atualizar('financial_accounts', id, dados);
    },
    contasDeletar: async function(id) {
        return this.deletar('financial_accounts', id);
    },

    categoriasBuscar: async function() {
        return this.buscar('financial_categories');
    },
    categoriasSalvar: async function(categoria) {
        return this.salvar('financial_categories', categoria);
    },
    categoriasAtualizar: async function(id, dados) {
        return this.atualizar('financial_categories', id, dados);
    },
    categoriasDeletar: async function(id) {
        const movsEntrada = await this.buscar('caixa_entrada');
        const movsSaida = await this.buscar('caixa_saida');
        const temVinculo =
            movsEntrada.dados.some(e => e.categoria_id === id || e.categoria === id) ||
            movsSaida.dados.some(s => s.categoria_id === id || s.categoria === id);
        if (temVinculo) {
            return { sucesso: false, erro: 'Categoria possui movimentações vinculadas' };
        }
        return this.deletar('financial_categories', id);
    },

    fornecedoresBuscar: async function() {
        return this.buscar('suppliers');
    },
    fornecedoresSalvar: async function(fornecedor) {
        return this.salvar('suppliers', fornecedor);
    },
    fornecedoresAtualizar: async function(id, dados) {
        return this.atualizar('suppliers', id, dados);
    },
    fornecedoresDeletar: async function(id) {
        return this.deletar('suppliers', id);
    },

    // ============================================
    // AUDITORIA
    // ============================================
    logAuditoria: async function(acao, registro, valorAnterior, novoValor, motivo) {
        const sessao = JSON.parse(localStorage.getItem('sessao_suittech') || '{}');
        const log = {
            _id: 'aud_' + Date.now().toString(36),
            usuario: sessao.usuario || 'sistema',
            data: new Date().toISOString(),
            acao: acao,
            registro: registro,
            valor_anterior: valorAnterior ? JSON.stringify(valorAnterior) : null,
            novo_valor: novoValor ? JSON.stringify(novoValor) : null,
            motivo: motivo || '',
            ip: '',
            data_criacao: new Date().toISOString()
        };
        return this.salvar('audit_logs', log);
    },

    // ============================================
    // CONSOLIDAÇÃO FINANCEIRA
    // ============================================
    consolidarSaldoContas: async function() {
        const contas = (await this.contasBuscar()).dados || [];
        const entradas = (await this.buscar('caixa_entrada')).dados || [];
        const saidas = (await this.buscar('caixa_saida')).dados || [];
        const saldos = {};
        contas.forEach(c => saldos[c._id] = Number(c.saldo_inicial) || 0);
        // Lançamentos antigos sem conta continuam visíveis no saldo total,
        // em vez de serem silenciosamente descartados.
        saldos.__sem_conta__ = 0;

        const idsEntradas = new Set();
        entradas.forEach(e => {
            if (e && e._id && idsEntradas.has(String(e._id))) return;
            if (e && e._id) idsEntradas.add(String(e._id));
            if (e.tipo === 'transferencia' || (e.status && !['confirmado', 'pago', 'recebido', 'quitado'].includes(e.status))) return;
            const contaId = e.conta_id && saldos[e.conta_id] !== undefined ? e.conta_id : '__sem_conta__';
            if (contaId) {
                const valor = Number(e.valor_liquido !== undefined ? e.valor_liquido : (e.venda || 0));
                if (Number.isFinite(valor)) saldos[contaId] += valor;
            }
        });

        const idsSaidas = new Set();
        saidas.forEach(s => {
            if (s && s._id && idsSaidas.has(String(s._id))) return;
            if (s && s._id) idsSaidas.add(String(s._id));
            if (s.tipo_saida === 'transferencia' || s.pago === false || ['pendente', 'vencida', 'cancelada', 'cancelado'].includes(s.status)) return;
            const contaId = s.conta_id && saldos[s.conta_id] !== undefined ? s.conta_id : '__sem_conta__';
            if (contaId) {
                const valor = Number(s.valor || 0);
                if (Number.isFinite(valor)) saldos[contaId] -= valor;
            }
        });

        return saldos;
    },

    consolidarFaturamento: async function(filtro) {
        const vendas = (await this.buscar('vendas')).dados || [];
        let filtradas = vendas;

        if (filtro) {
            if (filtro.mes && filtro.ano) {
                filtradas = filtradas.filter(v => {
                    const d = parseDataSegura(v.data);
                    return d && d.getFullYear() == filtro.ano && (d.getMonth() + 1) == filtro.mes;
                });
            }
            if (filtro.status) {
                filtradas = filtradas.filter(v => v.status === filtro.status);
            }
            if (filtro.cliente_id) {
                filtradas = filtradas.filter(v => v.cliente_id === filtro.cliente_id);
            }
        }

        const totalBruto = filtradas.reduce((acc, v) => acc + (Number(v.valor) || 0), 0);
        const totalCusto = filtradas.reduce((acc, v) => acc + (Number(v.pecas) || 0) + (Number(v.extras) || 0), 0);
        const totalLucro = totalBruto - totalCusto;

        return {
            total: filtradas.length,
            totalBruto: totalBruto,
            totalCusto: totalCusto,
            totalLucro: totalLucro,
            dados: filtradas
        };
    },

    consolidarLucro: async function(periodo) {
        const entradas = (await this.buscar('caixa_entrada')).dados || [];
        const saidas = (await this.buscar('caixa_saida')).dados || [];
        const contasPagar = (await this.buscar('contas_pagar')).dados || [];

        let filtroEntradas = entradas;
        let filtroSaidas = saidas;
        let filtroContas = contasPagar;

        if (periodo && periodo.mes && periodo.ano) {
            filtroEntradas = entradas.filter(e => {
                const d = parseDataSegura(e.data);
                return d && d.getFullYear() == periodo.ano && (d.getMonth() + 1) == periodo.mes;
            });
            filtroSaidas = saidas.filter(s => {
                const d = parseDataSegura(s.data);
                return d && d.getFullYear() == periodo.ano && (d.getMonth() + 1) == periodo.mes;
            });
            filtroContas = contasPagar.filter(c => {
                const d = parseDataSegura(c.vencimento);
                return d && d.getFullYear() == periodo.ano && (d.getMonth() + 1) == periodo.mes;
            });
        }

        const receita = filtroEntradas.reduce((acc, e) => acc + Number(e.valor_liquido !== undefined ? e.valor_liquido : (e.venda || 0)), 0);
        const custos = filtroSaidas.filter(s => s.tipo_saida === 'empresarial' && s.pago !== false && !['pendente', 'vencida', 'cancelada', 'cancelado'].includes(s.status)).reduce((acc, s) => acc + (Number(s.valor) || 0), 0);
        const despesas = filtroContas.filter(c => c.tipo === 'empresarial' && (c.status === 'pago' || c.status === 'paga')).reduce((acc, c) => acc + (Number(c.valor) || 0), 0);

        return {
            receita: receita,
            custos: custos,
            despesas: despesas,
            lucro_operacional: receita - custos - despesas,
            retiradas: filtroSaidas.filter(s => s.tipo_saida === 'pessoal' && s.pago !== false && !['pendente', 'vencida', 'cancelada', 'cancelado'].includes(s.status)).reduce((acc, s) => acc + (Number(s.valor) || 0), 0),
            resultado_final: receita - custos - despesas - (filtroSaidas.filter(s => s.tipo_saida === 'pessoal' && s.pago !== false && !['pendente', 'vencida', 'cancelada', 'cancelado'].includes(s.status)).reduce((acc, s) => acc + (Number(s.valor) || 0), 0))
        };
    },

    consolidarFluxoCaixa: async function(dias = 30) {
        // Datas financeiras são comparadas por dia, não por hora. Isso evita
        // excluir lançamentos com vencimento hoje porque estão à meia-noite.
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const entradas = (await this.buscar('caixa_entrada')).dados || [];
        const saidas = (await this.buscar('caixa_saida')).dados || [];
        const contasPagar = (await this.buscar('contas_pagar')).dados || [];
        const valoresReceber = (await this.buscar('valores_receber')).dados || [];

        const saldos = await this.consolidarSaldoContas();
        const saldoAtual = Object.values(saldos).reduce((a,b) => a+b, 0);

        let recebimentosFuturos = 0;
        let pagamentosFuturos = 0;

        const dataLimite = new Date(hoje);
        dataLimite.setDate(dataLimite.getDate() + dias);

        valoresReceber.forEach(v => {
            if (v.status !== 'quitado' && v.data_vencimento) {
                const d = parseDataSegura(v.data_vencimento);
                if (d && d >= hoje && d <= dataLimite) {
                    recebimentosFuturos += Number(v.faltaReceber) || 0;
                }
            }
        });

        contasPagar.forEach(c => {
            if (c.status !== 'pago' && c.status !== 'paga' && c.vencimento) {
                const d = parseDataSegura(c.vencimento);
                if (d && d >= hoje && d <= dataLimite) {
                    pagamentosFuturos += Number(c.valor) || 0;
                }
            }
        });

        return {
            saldo_atual: saldoAtual,
            recebimentos_futuros: recebimentosFuturos,
            pagamentos_futuros: pagamentosFuturos,
            saldo_projetado: saldoAtual + recebimentosFuturos - pagamentosFuturos,
            dias: dias
        };
    },

    // ============================================
    // MIGRAÇÃO DE DADOS
    // ============================================
    migrarDadosFinanceiros: async function() {
        const colecoes = ['caixa_entrada', 'caixa_saida', 'contas_pagar', 'valores_receber', 'vendas'];
        let modificado = false;

        for (const colecao of colecoes) {
            const dados = (await this.buscar(colecao)).dados || [];
            let alterado = false;
            dados.forEach(item => {
                if (colecao === 'caixa_entrada') {
                    if (!item.conta_id) { item.conta_id = ''; alterado = true; }
                    if (!item.categoria) { item.categoria = ''; alterado = true; }
                    if (!item.forma_pagamento) { item.forma_pagamento = ''; alterado = true; }
                    if (item.desconto === undefined) { item.desconto = 0; alterado = true; }
                    if (item.taxa === undefined) { item.taxa = 0; alterado = true; }
                    if (item.valor_liquido === undefined) {
                        item.valor_liquido = (item.venda || 0) - (item.desconto || 0) - (item.taxa || 0);
                        alterado = true;
                    }
                    if (!item.observacao) { item.observacao = ''; alterado = true; }
                    if (!item.os_id) { item.os_id = ''; alterado = true; }
                }
                if (colecao === 'caixa_saida') {
                    if (!item.conta_id) { item.conta_id = ''; alterado = true; }
                    if (!item.categoria) { item.categoria = ''; alterado = true; }
                    if (!item.forma_pagamento) { item.forma_pagamento = ''; alterado = true; }
                    if (!item.tipo_saida) { item.tipo_saida = 'empresarial'; alterado = true; }
                    if (!item.fornecedor) { item.fornecedor = ''; alterado = true; }
                    if (!item.data_vencimento) { item.data_vencimento = item.data || ''; alterado = true; }
                    if (!item.observacao) { item.observacao = ''; alterado = true; }
                    if (!item.status) { item.status = item.pago ? 'pago' : 'pendente'; alterado = true; }
                }
                if (colecao === 'contas_pagar') {
                    if (!item.conta_id) { item.conta_id = ''; alterado = true; }
                    if (!item.forma_pagamento) { item.forma_pagamento = ''; alterado = true; }
                    if (!item.tipo) { item.tipo = 'empresarial'; alterado = true; }
                    if (!item.fornecedor) { item.fornecedor = ''; alterado = true; }
                    if (!item.data_emissao) { item.data_emissao = item.vencimento || ''; alterado = true; }
                    if (!item.data_pagamento) { item.data_pagamento = ''; alterado = true; }
                }
                if (colecao === 'valores_receber') {
                    if (!item.conta_id) { item.conta_id = ''; alterado = true; }
                    if (!item.forma_pagamento) { item.forma_pagamento = ''; alterado = true; }
                    if (!item.os_id) { item.os_id = ''; alterado = true; }
                    if (!item.data_vencimento) { item.data_vencimento = item.data_acerto || item.dataAcerto || ''; alterado = true; }
                    if (!item.data_recebimento) { item.data_recebimento = ''; alterado = true; }
                }
                if (colecao === 'vendas') {
                    if (item.custo_total === undefined) {
                        item.custo_total = (item.pecas || 0) + (item.extras || 0);
                        alterado = true;
                    }
                    if (item.lucro_bruto === undefined) {
                        item.lucro_bruto = (item.valor || 0) - (item.custo_total || 0);
                        alterado = true;
                    }
                    if (!item.faturamento_id) { item.faturamento_id = ''; alterado = true; }
                }
            });
            if (alterado) {
                localStorage.setItem(`db_${colecao}`, JSON.stringify(dados));
                modificado = true;
                console.log(`✅ Migração aplicada em ${colecao}`);
            }
        }

        const contas = (await this.contasBuscar()).dados || [];
        if (contas.length === 0) {
            const contasPadrao = [
                { _id: 'cta_1', nome: 'Caixa Físico', tipo: 'caixa', saldo_inicial: 0, ativo: true, data_criacao: new Date().toISOString() },
                { _id: 'cta_2', nome: 'Banco Itaú', tipo: 'banco', saldo_inicial: 0, ativo: true, data_criacao: new Date().toISOString() },
                { _id: 'cta_3', nome: 'PIX', tipo: 'pix', saldo_inicial: 0, ativo: true, data_criacao: new Date().toISOString() },
                { _id: 'cta_4', nome: 'Conta Pessoal', tipo: 'pessoal', saldo_inicial: 0, ativo: true, data_criacao: new Date().toISOString() },
            ];
            for (const c of contasPadrao) {
                await this.contasSalvar(c);
            }
            console.log('✅ Contas padrão criadas');
            modificado = true;
        }

        const categorias = (await this.categoriasBuscar()).dados || [];
        if (categorias.length === 0) {
            const categoriasPadrao = [
                { _id: 'cat_1', nome: 'Serviços', tipo: 'empresarial', cor: '#3b82f6', ativo: true, data_criacao: new Date().toISOString() },
                { _id: 'cat_2', nome: 'Venda de Produtos', tipo: 'empresarial', cor: '#22c55e', ativo: true, data_criacao: new Date().toISOString() },
                { _id: 'cat_3', nome: 'Peças', tipo: 'empresarial', cor: '#f59e0b', ativo: true, data_criacao: new Date().toISOString() },
                { _id: 'cat_4', nome: 'Fornecedores', tipo: 'empresarial', cor: '#ef4444', ativo: true, data_criacao: new Date().toISOString() },
                { _id: 'cat_5', nome: 'Aluguel', tipo: 'empresarial', cor: '#8b5cf6', ativo: true, data_criacao: new Date().toISOString() },
                { _id: 'cat_6', nome: 'Energia', tipo: 'empresarial', cor: '#ec4899', ativo: true, data_criacao: new Date().toISOString() },
                { _id: 'cat_7', nome: 'Internet', tipo: 'empresarial', cor: '#14b8a6', ativo: true, data_criacao: new Date().toISOString() },
                { _id: 'cat_8', nome: 'Marketing', tipo: 'empresarial', cor: '#f97316', ativo: true, data_criacao: new Date().toISOString() },
                { _id: 'cat_9', nome: 'Transporte', tipo: 'empresarial', cor: '#6366f1', ativo: true, data_criacao: new Date().toISOString() },
                { _id: 'cat_10', nome: 'Ferramentas', tipo: 'empresarial', cor: '#06b6d4', ativo: true, data_criacao: new Date().toISOString() },
                { _id: 'cat_11', nome: 'Software', tipo: 'empresarial', cor: '#a855f7', ativo: true, data_criacao: new Date().toISOString() },
                { _id: 'cat_12', nome: 'Impostos', tipo: 'empresarial', cor: '#dc2626', ativo: true, data_criacao: new Date().toISOString() },
                { _id: 'cat_13', nome: 'Funcionários', tipo: 'empresarial', cor: '#2563eb', ativo: true, data_criacao: new Date().toISOString() },
                { _id: 'cat_14', nome: 'Outros (Empresa)', tipo: 'empresarial', cor: '#6b7280', ativo: true, data_criacao: new Date().toISOString() },
                { _id: 'cat_15', nome: 'Moradia', tipo: 'pessoal', cor: '#f59e0b', ativo: true, data_criacao: new Date().toISOString() },
                { _id: 'cat_16', nome: 'Alimentação', tipo: 'pessoal', cor: '#22c55e', ativo: true, data_criacao: new Date().toISOString() },
                { _id: 'cat_17', nome: 'Transporte (Pessoal)', tipo: 'pessoal', cor: '#3b82f6', ativo: true, data_criacao: new Date().toISOString() },
                { _id: 'cat_18', nome: 'Cartões', tipo: 'pessoal', cor: '#ef4444', ativo: true, data_criacao: new Date().toISOString() },
                { _id: 'cat_19', nome: 'Contas (Pessoal)', tipo: 'pessoal', cor: '#8b5cf6', ativo: true, data_criacao: new Date().toISOString() },
                { _id: 'cat_20', nome: 'Compras', tipo: 'pessoal', cor: '#ec4899', ativo: true, data_criacao: new Date().toISOString() },
                { _id: 'cat_21', nome: 'Outros (Pessoal)', tipo: 'pessoal', cor: '#6b7280', ativo: true, data_criacao: new Date().toISOString() },
            ];
            for (const c of categoriasPadrao) {
                await this.categoriasSalvar(c);
            }
            console.log('✅ Categorias padrão criadas');
            modificado = true;
        }

        return { sucesso: true, mensagem: modificado ? 'Migração aplicada' : 'Nenhuma migração necessária' };
    },

    // ============================================
    // BACKUP
    // ============================================
    backup: async function() {
        console.log('📦 Fazendo backup...');
        try {
            const colecoes = ['vendas', 'caixa_entrada', 'caixa_saida', 'clientes', 
                            'contas_pagar', 'valores_receber',
                            'devolucoes', 'agendamentos', 'lixeira',
                            'financial_accounts', 'financial_categories', 'suppliers', 'audit_logs'];
            const backup = {};
            let total = 0;
            for (const colecao of colecoes) {
                const resultado = await this.buscar(colecao);
                backup[colecao] = resultado.sucesso ? resultado.dados : [];
                total += backup[colecao].length;
            }
            localStorage.setItem('backup_completo', JSON.stringify(backup));
            await this.logAuditoria('backup', 'sistema', null, { total }, 'Backup completo');
            return { sucesso: true, mensagem: `Backup concluído! ${total} itens` };
        } catch (error) {
            return { sucesso: false, erro: error.message };
        }
    },

    // ============================================
    // USUÁRIOS
    // ============================================
    usuariosBuscar: async function() {
        try {
            const usuarios = JSON.parse(localStorage.getItem('usuarios_suittech') || 
                '[{"id":"1","usuario":"admin","nome":"Administrador","senha":"admin123"}]');
            return { sucesso: true, dados: usuarios };
        } catch (error) {
            return { sucesso: false, dados: [], erro: error.message };
        }
    },

    usuariosSalvar: async function(usuarios) {
        try {
            localStorage.setItem('usuarios_suittech', JSON.stringify(usuarios));
            return { sucesso: true };
        } catch (error) {
            return { sucesso: false, erro: error.message };
        }
    },

    // ============================================
    // FOTOS
    // ============================================
    salvarFoto: async function(os, dataUrl) {
        try {
            const fotos = JSON.parse(localStorage.getItem(`fotos_${os}`) || '[]');
            const id = 'foto_' + Date.now().toString(36);
            fotos.push({ id: id, data: dataUrl, nome: id + '.jpg', dataCriacao: new Date().toISOString() });
            localStorage.setItem(`fotos_${os}`, JSON.stringify(fotos));
            return { sucesso: true, id: id };
        } catch (error) {
            return { sucesso: false, erro: error.message };
        }
    },

    listarFotos: async function(os) {
        try {
            const fotos = JSON.parse(localStorage.getItem(`fotos_${os}`) || '[]');
            return { sucesso: true, fotos: fotos.map(f => ({ nome: f.nome, caminho: f.data, data: f.dataCriacao })) };
        } catch (error) {
            return { sucesso: false, erro: error.message, fotos: [] };
        }
    },

    deletarFoto: async function(os, nome) {
        try {
            let fotos = JSON.parse(localStorage.getItem(`fotos_${os}`) || '[]');
            fotos = fotos.filter(f => f.nome !== nome);
            localStorage.setItem(`fotos_${os}`, JSON.stringify(fotos));
            return { sucesso: true };
        } catch (error) {
            return { sucesso: false, erro: error.message };
        }
    },

    abrirPastaAnexos: async function(os) {
        const fotos = JSON.parse(localStorage.getItem(`fotos_${os}`) || '[]');
        if (fotos.length === 0) return { sucesso: false, erro: 'Nenhuma foto' };
        window.open(fotos[0].data, '_blank');
        return { sucesso: true };
    },

    // ============================================
    // CONFIGURAÇÕES
    // ============================================
    configLer: async function() {
        try {
            return { sucesso: true, dados: JSON.parse(localStorage.getItem('config_rede') || '{"modo":"local","caminhoRede":""}') };
        } catch (error) {
            return { sucesso: false, erro: error.message };
        }
    },

    configSalvar: async function(config) {
        try {
            localStorage.setItem('config_rede', JSON.stringify(config));
            return { sucesso: true };
        } catch (error) {
            return { sucesso: false, erro: error.message };
        }
    },

    configTestar: async function(caminho) {
        return { sucesso: true, mensagem: 'Caminho válido' };
    },

    // ============================================
    // FECHAMENTO MENSAL AUTOMÁTICO (PRESERVA HISTÓRICO)
    // ============================================
    fecharMes: async function() {
        const hoje = new Date();
        const mesAno = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}`;
        const ultimoFechamento = localStorage.getItem('ultimo_fechamento_mes');

        if (ultimoFechamento === mesAno) {
            return { sucesso: false, erro: 'Mês atual já foi fechado.' };
        }

        const colecoesParaArquivar = [
            'caixa_entrada',
            'caixa_saida',
            'contas_pagar',
            'valores_receber',
            'devolucoes'
        ];

        let itensArquivados = 0;

        for (const colecao of colecoesParaArquivar) {
            const resultado = await this.buscar(colecao);
            if (!resultado.sucesso) continue;
            const dados = resultado.dados || [];
            const registrosMes = dados.filter(item => {
                let dataRef = item.data || item.vencimento || item.data_criacao;
                if (!dataRef) return false;
                const d = new Date(dataRef);
                return d.getFullYear() === hoje.getFullYear() && (d.getMonth()+1) === (hoje.getMonth()+1);
            });

            if (registrosMes.length === 0) continue;

            for (const registro of registrosMes) {
                const historico = {
                    mes: mesAno,
                    colecao: colecao,
                    dados: registro,
                    data_arquivamento: new Date().toISOString()
                };
                await this.salvar('historico_mensal', historico);
            }

            const idsParaRemover = registrosMes.map(r => r._id);
            for (const id of idsParaRemover) {
                await this.deletar(colecao, id);
            }

            itensArquivados += registrosMes.length;
        }

        // Atualiza saldos das contas (saldo final vira saldo_inicial)
        const contas = (await this.contasBuscar()).dados || [];
        const saldosAtuais = await this.consolidarSaldoContas();
        for (const conta of contas) {
            const saldo = saldosAtuais[conta._id] || 0;
            await this.contasAtualizar(conta._id, { ...conta, saldo_inicial: saldo });
        }

        // Registra o fechamento
        localStorage.setItem('ultimo_fechamento_mes', mesAno);
        localStorage.setItem('data_ultimo_fechamento', new Date().toISOString());

        // Backup automático
        await this.backup();

        return { sucesso: true, mensagem: `Mês ${mesAno} fechado com sucesso. ${itensArquivados} itens arquivados.` };
    },

    verificarFechamentoPendente: function() {
        const hoje = new Date();
        const mesAno = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}`;
        const ultimo = localStorage.getItem('ultimo_fechamento_mes');
        return ultimo !== mesAno;
    }
};
// ============================================
// ESTOQUE
// ============================================

api.produtosBuscar = async function() {
    return this.buscar('produtos');
};

api.produtosSalvar = async function(produto) {
    return this.salvar('produtos', produto);
};

api.produtosAtualizar = async function(id, dados) {
    return this.atualizar('produtos', id, dados);
};

api.produtosDeletar = async function(id) {
    return this.deletar('produtos', id);
};

api.movimentacoesEstoqueBuscar = async function() {
    return this.buscar('movimentacoes_estoque');
};

api.movimentacaoEstoqueSalvar = async function(movimentacao) {
    return this.salvar('movimentacoes_estoque', movimentacao);
};

api.movimentacaoEstoqueDeletar = async function(id) {
    return this.deletar('movimentacoes_estoque', id);
};

// Função para dar entrada ou saída de produtos (atualiza quantidade)
api.movimentarEstoque = async function(produtoId, quantidade, tipo, observacao = '', clienteId = '') {
    // tipo: 'entrada' ou 'saida'
    if (quantidade <= 0) return { sucesso: false, erro: 'Quantidade deve ser maior que zero' };
    
    const produtoResult = await this.produtosBuscar();
    const produto = produtoResult.dados.find(p => p._id === produtoId);
    if (!produto) return { sucesso: false, erro: 'Produto não encontrado' };

    let novaQuantidade = produto.quantidade || 0;
    if (tipo === 'entrada') {
        novaQuantidade += quantidade;
    } else if (tipo === 'saida') {
        if (novaQuantidade < quantidade) {
            return { sucesso: false, erro: 'Estoque insuficiente' };
        }
        novaQuantidade -= quantidade;
    } else {
        return { sucesso: false, erro: 'Tipo de movimentação inválido' };
    }

    // Atualiza o produto
    const produtoAtualizado = { ...produto, quantidade: novaQuantidade };
    await this.produtosAtualizar(produtoId, produtoAtualizado);

    // Registra a movimentação
    const movimentacao = {
        produto_id: produtoId,
        produto_nome: produto.nome,
        quantidade: quantidade,
        tipo: tipo,
        data: new Date().toISOString().split('T')[0],
        hora: new Date().toISOString(),
        observacao: observacao || '',
        cliente_id: clienteId || '',
        cliente_nome: '',
        estoque_anterior: produto.quantidade || 0,
        estoque_atual: novaQuantidade
    };

    if (clienteId) {
        const clientes = await this.buscar('clientes');
        const cliente = clientes.dados.find(c => c._id === clienteId);
        if (cliente) movimentacao.cliente_nome = cliente.nome;
    }

    await this.movimentacaoEstoqueSalvar(movimentacao);
    return { sucesso: true, mensagem: `${tipo === 'entrada' ? 'Entrada' : 'Saída'} realizada com sucesso!` };
};

// Modelos de comunicação editáveis pelo usuário.
api.mensagensBuscar = async function() {
    const padrao = {
        orcamento: 'Olá, {cliente}! Segue o orçamento da OS {os}. Valor: {valor}. Serviço: {servico}.',
        agradecimento: 'Olá, {cliente}! Agradecemos pela preferência e pela confiança na SUIT-TECH.',
        garantia: 'Olá, {cliente}! Sua OS {os} possui garantia de 90 dias, válida até {validade}.',
        pronto: 'Olá, {cliente}! Seu equipamento está pronto para retirada na SUIT-TECH.'
    };
    try {
        const salvo = JSON.parse(localStorage.getItem('mensagens_whatsapp') || '{}');
        return { sucesso: true, dados: { ...padrao, ...salvo } };
    } catch (e) {
        return { sucesso: true, dados: padrao };
    }
};

api.mensagensSalvar = async function(mensagens) {
    try {
        localStorage.setItem('mensagens_whatsapp', JSON.stringify(mensagens || {}));
        return { sucesso: true };
    } catch (e) {
        return { sucesso: false, erro: e.message };
    }
};

window.api = api;
console.log('✅ API Financeira carregada com sucesso!');
