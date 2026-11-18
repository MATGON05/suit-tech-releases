# Correção: exibição dos movimentos arquivados

A versão 1.0.22 movia corretamente os movimentos fechados para `historico_mensal`, mas as telas de Caixa de Entrada e Caixa de Saída consultavam somente as coleções ativas. Por isso os movimentos arquivados deixavam de aparecer na aplicação, embora continuassem no Supabase.

A versão-fonte 1.0.23 corrige a leitura para combinar registros ativos e arquivados, marcando os arquivados como somente leitura e evitando duplicar itens que ainda existam na coleção ativa. A mesma leitura foi ligada ao Financeiro, Relatórios e ao filtro mensal do painel. O fechamento e os registros do Supabase não foram modificados pelo patch.

## Verificações

- Testes mensais com `TZ=America/Sao_Paulo`: aprovados.
- Testes da ficha de atendimento: aprovados.
- Verificação de sintaxe JavaScript: aprovada.
- Incluído teste de regressão para inclusão do arquivo e prevenção de duplicados.

Este ZIP contém código-fonte, não é instalador publicado. Antes de compilar/instalar em ambiente de produção, mantenha um backup do sistema e confirme a versão/assinatura do instalador.
