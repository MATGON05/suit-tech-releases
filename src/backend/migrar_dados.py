#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MIGRADOR DE DADOS JSON PARA SQLITE - SUIT-TECH
Uso: python migrar_json_para_sqlite.py [arquivo.json]
"""

import sqlite3
import json
import os
import sys
from datetime import datetime
from pathlib import Path

# ============================================
# CONFIGURAÇÃO
# ============================================

def get_banco_path():
    """Retorna o caminho do banco de dados"""
    if 'SUITECH_DB_PATH' in os.environ:
        return os.environ['SUITECH_DB_PATH']
    
    if sys.platform == 'win32':
        appdata = os.environ.get('APPDATA', os.path.expanduser('~'))
        return os.path.join(appdata, 'SUIT-TECH', 'suittech.db')
    
    return os.path.join(os.path.expanduser('~'), '.suittech', 'suittech.db')

def get_json_path():
    """Retorna o caminho do arquivo JSON"""
    if len(sys.argv) > 1:
        return sys.argv[1]
    
    # Procura o arquivo de backup mais recente
    pasta_atual = os.path.dirname(os.path.abspath(__file__))
    arquivos = list(Path(pasta_atual).glob('backup_suittech_*.json'))
    
    if not arquivos:
        # Procura na pasta do usuário
        user_data = os.path.expanduser('~')
        arquivos = list(Path(user_data).glob('**/backup_suittech_*.json'))
    
    if not arquivos:
        print('❌ Nenhum arquivo JSON encontrado')
        return None
    
    # Pega o mais recente
    arquivo = max(arquivos, key=lambda x: x.stat().st_mtime)
    print(f'📁 Arquivo encontrado: {arquivo}')
    return str(arquivo)

# ============================================
# MIGRAÇÃO
# ============================================

def migrar_dados(conn, dados_json):
    """Migra os dados do JSON para o SQLite"""
    cursor = conn.cursor()
    total_migrado = 0
    erros = []
    
    # Mapeamento de coleções
    colecoes = {
        'clientes': {
            'tabela': 'clientes',
            'mapeamento': {
                '_id': '_id',
                'nome': 'nome',
                'telefone': 'telefone',
                'email': 'email',
                'cpf': 'cpf',
                'endereco': 'endereco',
            }
        },
        'vendas': {
            'tabela': 'vendas',
            'mapeamento': {
                '_id': '_id',
                'cliente': 'cliente',
                'clienteId': 'cliente_id',
                'telefone': 'telefone',
                'email': 'email',
                'cpf': 'cpf',
                'endereco': 'endereco',
                'aparelho': 'aparelho',
                'marca': 'marca',
                'modelo': 'modelo',
                'serie': 'serie',
                'marcasUso': 'marcas_uso',
                'status': 'status',
                'pagamento': 'pagamento',
                'valor': 'valor',
                'pecas': 'pecas',
                'extras': 'extras',
                'lucro': 'lucro',
                'defeito': 'defeito',
                'diagnostico': 'diagnostico',
                'assinatura': 'assinatura',
                'os': 'os',
                'data': 'data',
            }
        },
        'caixa_entrada': {
            'tabela': 'caixa_entrada',
            'mapeamento': {
                '_id': '_id',
                'data': 'data',
                'tipo': 'tipo',
                'descricao': 'descricao',
                'venda': 'venda',
                'custo': 'custo',
                'lucro': 'lucro',
                'orcamentoId': 'orcamento_id',
            }
        },
        'caixa_saida': {
            'tabela': 'caixa_saida',
            'mapeamento': {
                '_id': '_id',
                'data': 'data',
                'descricao': 'descricao',
                'valor': 'valor',
                'pago': 'pago',
            }
        },
        'contas_pagar': {
            'tabela': 'contas_pagar',
            'mapeamento': {
                '_id': '_id',
                'vencimento': 'vencimento',
                'valor': 'valor',
                'descricao': 'descricao',
                'categoria': 'categoria',
                'status': 'status',
                'obs': 'obs',
            }
        },
        'valores_receber': {
            'tabela': 'valores_receber',
            'mapeamento': {
                '_id': '_id',
                'cliente': 'cliente',
                'telefone': 'telefone',
                'email': 'email',
                'cpf': 'cpf',
                'endereco': 'endereco',
                'descricao': 'descricao',
                'valorTotal': 'valor_total',
                'parcelas': 'parcelas',
                'entrada': 'entrada',
                'valorParcela': 'valor_parcela',
                'faltaReceber': 'falta_receber',
                'formaPagamento': 'forma_pagamento',
                'dataAcerto': 'data_acerto',
                'status': 'status',
                'obsCliente': 'obs_cliente',
                'obsVenda': 'obs_venda',
                'dataUltimoPagamento': 'data_ultimo_pagamento',
            }
        },
        'comissoes': {
            'tabela': 'comissoes',
            'mapeamento': {
                '_id': '_id',
                'vendedor': 'vendedor',
                'venda': 'venda',
                'valorVenda': 'valor_venda',
                'percentual': 'percentual',
                'valor': 'valor',
                'data': 'data',
                'status': 'status',
                'obs': 'obs',
                'dataPagamento': 'data_pagamento',
            }
        },
        'devolucoes': {
            'tabela': 'devolucoes',
            'mapeamento': {
                '_id': '_id',
                'data': 'data',
                'descricao': 'descricao',
                'valor': 'valor',
                'origem': 'origem',
                'vendaId': 'venda_id',
            }
        },
        'agendamentos': {
            'tabela': 'agendamentos',
            'mapeamento': {
                '_id': '_id',
                'cliente': 'cliente',
                'clienteId': 'cliente_id',
                'aparelho': 'aparelho',
                'data': 'data',
                'status': 'status',
                'obs': 'obs',
            }
        },
        'lixeira': {
            'tabela': 'lixeira',
            'mapeamento': {
                '_id': '_id',
                'colecaoOrigem': 'colecao_origem',
                'dados': 'dados',
                'motivo': 'motivo',
                'dataExclusao': 'data_exclusao',
            }
        }
    }
    
    for colecao, config in colecoes.items():
        if colecao not in dados_json:
            print(f'⚠️ Coleção "{colecao}" não encontrada no JSON')
            continue
        
        dados = dados_json[colecao]
        if not dados:
            print(f'⚠️ Coleção "{colecao}" vazia')
            continue
        
        tabela = config['tabela']
        mapeamento = config['mapeamento']
        
        for item in dados:
            try:
                # Constrói o dicionário com os campos mapeados
                valores = {}
                for campo_json, campo_sql in mapeamento.items():
                    if campo_json in item and item[campo_json] is not None:
                        valor = item[campo_json]
                        # Converte booleanos
                        if isinstance(valor, bool):
                            valor = 1 if valor else 0
                        valores[campo_sql] = valor
                
                # Se não tiver _id, gera um
                if '_id' not in valores:
                    import time
                    valores['_id'] = str(int(time.time() * 1000))
                
                # Monta a query
                colunas = ', '.join(valores.keys())
                placeholders = ', '.join(['?' for _ in valores])
                query = f'INSERT OR REPLACE INTO {tabela} ({colunas}) VALUES ({placeholders})'
                
                cursor.execute(query, list(valores.values()))
                total_migrado += 1
                
            except Exception as e:
                erros.append(f'{colecao}: {e}')
        
        print(f'✅ {colecao}: {len(dados)} registros migrados')
    
    conn.commit()
    
    # Registra a migração
    cursor.execute('''
        INSERT INTO logs (usuario, acao, detalhes)
        VALUES (?, ?, ?)
    ''', ('migracao', 'migracao_json_para_sqlite', f'Total: {total_migrado} registros'))
    conn.commit()
    
    if erros:
        print(f'⚠️ Erros: {len(erros)}')
        for erro in erros[:5]:
            print(f'  - {erro}')
    
    return total_migrado

# ============================================
# FUNÇÃO PRINCIPAL
# ============================================

def main():
    print('=' * 50)
    print('🔄 MIGRADOR JSON -> SQLITE - SUIT-TECH')
    print('=' * 50)
    
    # Verifica o banco
    caminho_banco = get_banco_path()
    if not os.path.exists(caminho_banco):
        print(f'❌ Banco não encontrado: {caminho_banco}')
        print('Execute primeiro: python criar_banco_sqlite.py')
        return 1
    
    print(f'📁 Banco: {caminho_banco}')
    
    # Verifica o JSON
    caminho_json = get_json_path()
    if not caminho_json or not os.path.exists(caminho_json):
        print('❌ Arquivo JSON não encontrado')
        return 1
    
    print(f'📄 JSON: {caminho_json}')
    
    # Carrega o JSON
    try:
        with open(caminho_json, 'r', encoding='utf-8') as f:
            dados = json.load(f)
    except Exception as e:
        print(f'❌ Erro ao ler JSON: {e}')
        return 1
    
    print(f'📊 Total de itens no JSON: {dados.get("_totalItens", 0)}')
    
    # Conecta ao banco
    try:
        conn = sqlite3.connect(caminho_banco)
        conn.row_factory = sqlite3.Row
        
        # Migra os dados
        total = migrar_dados(conn, dados)
        
        conn.close()
        
        print('=' * 50)
        print('✅ MIGRAÇÃO CONCLUÍDA COM SUCESSO!')
        print(f'📊 {total} registros migrados')
        print('=' * 50)
        
    except Exception as e:
        print(f'❌ Erro ao migrar dados: {e}')
        return 1
    
    return 0

if __name__ == '__main__':
    sys.exit(main())