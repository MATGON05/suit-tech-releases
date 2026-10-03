#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CRIADOR DE BANCO DE DADOS SUIT-TECH
Uso: python criar_banco_sqlite.py
"""

import sqlite3
import os
import sys
from datetime import datetime

# ============================================
# CONFIGURAÇÃO
# ============================================

def get_banco_path():
    """Retorna o caminho do banco de dados"""
    # Prioridade: variável de ambiente
    if 'SUITECH_DB_PATH' in os.environ:
        return os.environ['SUITECH_DB_PATH']
    
    # Windows: pasta do usuário
    if sys.platform == 'win32':
        appdata = os.environ.get('APPDATA', os.path.expanduser('~'))
        return os.path.join(appdata, 'SUIT-TECH', 'suittech.db')
    
    # Linux/Mac
    return os.path.join(os.path.expanduser('~'), '.suittech', 'suittech.db')

def criar_pasta_banco():
    """Cria a pasta do banco se não existir"""
    caminho = get_banco_path()
    pasta = os.path.dirname(caminho)
    if not os.path.exists(pasta):
        os.makedirs(pasta, exist_ok=True)
        print(f'📁 Pasta criada: {pasta}')
    return caminho

# ============================================
# CRIAÇÃO DAS TABELAS
# ============================================

def criar_tabelas(conn):
    """Cria todas as tabelas do sistema"""
    cursor = conn.cursor()
    
    # 1. CLIENTES
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS clientes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            _id TEXT UNIQUE,
            nome TEXT NOT NULL,
            telefone TEXT,
            email TEXT,
            cpf TEXT,
            endereco TEXT,
            data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            data_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # 2. VENDAS (ORÇAMENTOS)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS vendas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            _id TEXT UNIQUE,
            cliente TEXT NOT NULL,
            cliente_id TEXT,
            telefone TEXT,
            email TEXT,
            cpf TEXT,
            endereco TEXT,
            aparelho TEXT,
            marca TEXT,
            modelo TEXT,
            serie TEXT,
            marcas_uso TEXT,
            status TEXT DEFAULT 'pendente',
            pagamento TEXT DEFAULT 'nao_pago',
            valor REAL DEFAULT 0,
            pecas REAL DEFAULT 0,
            extras REAL DEFAULT 0,
            lucro REAL DEFAULT 0,
            defeito TEXT,
            diagnostico TEXT,
            assinatura TEXT,
            os TEXT,
            data TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            data_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # 3. ITENS DA VENDA
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS itens_venda (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            _id TEXT UNIQUE,
            venda_id TEXT,
            produto TEXT,
            quantidade INTEGER DEFAULT 1,
            valor_unitario REAL DEFAULT 0,
            subtotal REAL DEFAULT 0,
            FOREIGN KEY (venda_id) REFERENCES vendas(_id) ON DELETE CASCADE
        )
    ''')
    
    # 4. CAIXA ENTRADA
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS caixa_entrada (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            _id TEXT UNIQUE,
            data DATE,
            tipo TEXT,
            descricao TEXT,
            venda REAL DEFAULT 0,
            custo REAL DEFAULT 0,
            lucro REAL DEFAULT 0,
            orcamento_id TEXT,
            data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # 5. CAIXA SAÍDA
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS caixa_saida (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            _id TEXT UNIQUE,
            data DATE,
            descricao TEXT,
            valor REAL DEFAULT 0,
            pago INTEGER DEFAULT 0,
            data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # 6. CONTAS A PAGAR
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS contas_pagar (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            _id TEXT UNIQUE,
            vencimento DATE,
            valor REAL DEFAULT 0,
            descricao TEXT,
            categoria TEXT,
            status TEXT DEFAULT 'pendente',
            obs TEXT,
            data_pagamento DATE,
            data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # 7. VALORES A RECEBER
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS valores_receber (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            _id TEXT UNIQUE,
            cliente TEXT,
            telefone TEXT,
            email TEXT,
            cpf TEXT,
            endereco TEXT,
            descricao TEXT,
            valor_total REAL DEFAULT 0,
            parcelas INTEGER DEFAULT 1,
            entrada REAL DEFAULT 0,
            valor_parcela REAL DEFAULT 0,
            falta_receber REAL DEFAULT 0,
            forma_pagamento TEXT,
            data_acerto DATE,
            status TEXT DEFAULT 'pendente',
            obs_cliente TEXT,
            obs_venda TEXT,
            data_ultimo_pagamento DATE,
            data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # 8. COMISSÕES
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS comissoes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            _id TEXT UNIQUE,
            vendedor TEXT,
            venda TEXT,
            valor_venda REAL DEFAULT 0,
            percentual REAL DEFAULT 0,
            valor REAL DEFAULT 0,
            data DATE,
            status TEXT DEFAULT 'pendente',
            obs TEXT,
            data_pagamento DATE,
            data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # 9. DEVOLUÇÕES
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS devolucoes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            _id TEXT UNIQUE,
            data DATE,
            descricao TEXT,
            valor REAL DEFAULT 0,
            origem TEXT,
            venda_id TEXT,
            data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # 10. AGENDAMENTOS
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS agendamentos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            _id TEXT UNIQUE,
            cliente TEXT,
            cliente_id TEXT,
            aparelho TEXT,
            data TIMESTAMP,
            status TEXT DEFAULT 'agendado',
            obs TEXT,
            data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # 11. LIXEIRA
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS lixeira (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            _id TEXT UNIQUE,
            colecao_origem TEXT,
            dados TEXT,
            motivo TEXT,
            data_exclusao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # 12. USUÁRIOS
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            _id TEXT UNIQUE,
            usuario TEXT UNIQUE NOT NULL,
            nome TEXT NOT NULL,
            senha TEXT NOT NULL,
            perfil TEXT DEFAULT 'usuario',
            ativo INTEGER DEFAULT 1,
            data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # 13. CONFIGURAÇÕES
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS configuracoes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chave TEXT UNIQUE NOT NULL,
            valor TEXT,
            descricao TEXT,
            data_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # 14. LOG DE OPERAÇÕES
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario TEXT,
            acao TEXT,
            detalhes TEXT,
            data TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    conn.commit()
    print('✅ Todas as tabelas criadas com sucesso!')

# ============================================
# ÍNDICES PARA PERFORMANCE
# ============================================

def criar_indices(conn):
    """Cria índices para melhorar a performance"""
    cursor = conn.cursor()
    
    indices = [
        'CREATE INDEX IF NOT EXISTS idx_vendas_cliente ON vendas(cliente)',
        'CREATE INDEX IF NOT EXISTS idx_vendas_status ON vendas(status)',
        'CREATE INDEX IF NOT EXISTS idx_vendas_data ON vendas(data)',
        'CREATE INDEX IF NOT EXISTS idx_clientes_nome ON clientes(nome)',
        'CREATE INDEX IF NOT EXISTS idx_clientes_telefone ON clientes(telefone)',
        'CREATE INDEX IF NOT EXISTS idx_caixa_entrada_data ON caixa_entrada(data)',
        'CREATE INDEX IF NOT EXISTS idx_caixa_saida_data ON caixa_saida(data)',
        'CREATE INDEX IF NOT EXISTS idx_contas_pagar_vencimento ON contas_pagar(vencimento)',
        'CREATE INDEX IF NOT EXISTS idx_contas_pagar_status ON contas_pagar(status)',
        'CREATE INDEX IF NOT EXISTS idx_agendamentos_data ON agendamentos(data)',
        'CREATE INDEX IF NOT EXISTS idx_agendamentos_status ON agendamentos(status)',
        'CREATE INDEX IF NOT EXISTS idx_comissoes_vendedor ON comissoes(vendedor)',
        'CREATE INDEX IF NOT EXISTS idx_valores_receber_cliente ON valores_receber(cliente)',
    ]
    
    for sql in indices:
        try:
            cursor.execute(sql)
        except sqlite3.Error as e:
            print(f'⚠️ Erro ao criar índice: {e}')
    
    conn.commit()
    print('✅ Índices criados com sucesso!')

# ============================================
# USUÁRIO PADRÃO
# ============================================

def criar_usuario_padrao(conn):
    """Cria o usuário administrador padrão"""
    cursor = conn.cursor()
    
    # Verifica se já existe
    cursor.execute('SELECT COUNT(*) FROM usuarios WHERE usuario = "admin"')
    if cursor.fetchone()[0] > 0:
        print('👤 Usuário admin já existe')
        return
    
    # Cria usuário admin
    cursor.execute('''
        INSERT INTO usuarios (_id, usuario, nome, senha, perfil)
        VALUES (?, ?, ?, ?, ?)
    ''', ('1', 'admin', 'Administrador', 'admin123', 'admin'))
    
    conn.commit()
    print('👤 Usuário admin criado (senha: admin123)')

# ============================================
# CONFIGURAÇÕES PADRÃO
# ============================================

def criar_configuracoes_padrao(conn):
    """Cria as configurações padrão do sistema"""
    cursor = conn.cursor()
    
    configs = [
        ('versao', '1.0.0', 'Versão do sistema'),
        ('empresa_nome', 'SUIT-TECH', 'Nome da empresa'),
        ('whatsapp_numero', '5524999421921', 'Número do WhatsApp'),
        ('backup_automatico', '1', 'Backup automático (1=sim, 0=não)'),
        ('backup_frequencia', 'diario', 'Frequência do backup'),
        ('backup_horario', '23:00', 'Horário do backup'),
        ('moeda', 'R$', 'Símbolo da moeda'),
        ('garantia_dias', '90', 'Dias de garantia padrão'),
    ]
    
    for chave, valor, descricao in configs:
        cursor.execute('''
            INSERT OR IGNORE INTO configuracoes (chave, valor, descricao)
            VALUES (?, ?, ?)
        ''', (chave, valor, descricao))
    
    conn.commit()
    print('⚙️ Configurações padrão criadas')

# ============================================
# FUNÇÃO PRINCIPAL
# ============================================

def main():
    print('=' * 50)
    print('🚀 CRIADOR DE BANCO SUIT-TECH v1.0')
    print('=' * 50)
    
    caminho = criar_pasta_banco()
    print(f'📁 Banco: {caminho}')
    
    # Verifica se o banco já existe
    if os.path.exists(caminho):
        resp = input('⚠️ Banco já existe. Recriar? (s/N): ')
        if resp.lower() != 's':
            print('❌ Operação cancelada')
            return
    
    try:
        # Conecta ao banco
        conn = sqlite3.connect(caminho)
        conn.row_factory = sqlite3.Row
        
        # Cria as tabelas
        criar_tabelas(conn)
        
        # Cria os índices
        criar_indices(conn)
        
        # Cria usuário padrão
        criar_usuario_padrao(conn)
        
        # Cria configurações padrão
        criar_configuracoes_padrao(conn)
        
        conn.close()
        
        print('=' * 50)
        print('✅ BANCO DE DADOS CRIADO COM SUCESSO!')
        print(f'📁 Local: {caminho}')
        print('=' * 50)
        print()
        print('📌 PRÓXIMOS PASSOS:')
        print('1. Compartilhe a pasta do banco na rede')
        print('2. Configure a variável SUITECH_DB_PATH no Electron')
        print('3. Execute o sistema com o novo banco')
        print()
        print('👤 Usuário padrão: admin')
        print('🔑 Senha: admin123')
        print('=' * 50)
        
    except Exception as e:
        print(f'❌ Erro ao criar banco: {e}')
        return 1
    
    return 0

if __name__ == '__main__':
    sys.exit(main())