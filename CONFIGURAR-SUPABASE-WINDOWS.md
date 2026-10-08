# Configuração do Supabase para o projeto correto

## Observação sobre as abas removidas

O ZIP enviado contém referências antigas a `comissoes` e `transfers` em rotinas de dados, backup e textos internos, mas as abas **Transferências** e **Comissões** não devem mais fazer parte do sistema. As migrações desta pasta não criam essas coleções no banco online.

As coleções usadas pela base inicial são:

```text
agendamentos
clientes
caixa_entrada
caixa_saida
contas_pagar
devolucoes
financial_accounts
financial_categories
historico_mensal
lixeira
movimentacoes_estoque
produtos
suppliers
servicos_tercerizados
valores_receber
vendas
audit_logs
```

A migração não inclui `transfers` nem `comissoes`.

## 1. Criar o projeto Supabase

1. Acesse [supabase.com](https://supabase.com).
2. Crie uma conta ou entre na sua conta.
3. Clique em **New project**.
4. Dê o nome `suit-tech`.
5. Escolha uma região próxima do Brasil.
6. Crie uma senha forte para o banco.
7. Aguarde a criação terminar.

Não envie a senha do banco para ninguém. O projeto deve permanecer privado.

## 2. Criar seu usuário

No painel do Supabase, abra:

```text
Authentication → Users → Add user
```

Crie o seu e-mail e uma senha forte. O aplicativo usará esse usuário para permitir acesso ao banco.

## 3. Executar o SQL

No painel, abra:

```text
SQL Editor → New query
```

Abra o arquivo:

```text
supabase/001_initial_schema.sql
```

Copie todo o conteúdo para o SQL Editor e clique em **Run**.

Se o banco já existia antes da inclusão da coleção de serviços terceirizados, execute também:

```text
supabase/002_allow_servicos_tercerizados.sql
```

Essa migration acrescenta `servicos_tercerizados` à validação de `public.records`, preservando as coleções já autorizadas. Em um banco novo criado pelo arquivo `001_initial_schema.sql`, ela não precisa alterar nada.

A migração cria:

- Workspace da empresa;
- Usuários vinculados ao workspace;
- Registros do sistema em JSONB;
- Auditoria;
- Bucket privado de fotos e anexos;
- Políticas de segurança RLS.

## 4. Vincular seu usuário ao workspace

Depois de executar o SQL, copie o comando abaixo para o SQL Editor. Troque `SEU_EMAIL_AQUI` pelo e-mail criado em Authentication:

```sql
with new_workspace as (
  insert into public.workspaces (name)
  values ('SUIT-TECH')
  returning id
)
insert into public.workspace_members (workspace_id, user_id, role)
select new_workspace.id, auth_user.id, 'owner'
from new_workspace
cross join auth.users auth_user
where auth_user.email = 'SEU_EMAIL_AQUI';
```

Confirme o resultado:

```sql
select
  w.name as workspace,
  wm.role,
  u.email
from public.workspace_members wm
join public.workspaces w on w.id = wm.workspace_id
join auth.users u on u.id = wm.user_id;
```

Deve aparecer o workspace `SUIT-TECH`, seu e-mail e o perfil `owner`.

## 5. Conferir o bucket de arquivos

Abra **Storage**. Deve existir um bucket chamado:

```text
attachments
```

Ele deve estar como **privado**. Não altere para público.

As fotos serão organizadas futuramente assim:

```text
attachments/<WORKSPACE_ID>/os/<ID_DA_OS>/foto.jpg
```

## 6. Informações que serão usadas no aplicativo

Abra:

```text
Project Settings → API
```

Guarde:

- Project URL;
- Publishable key ou chave `anon`.

Não use a chave `service_role` no aplicativo. Ela ignora as políticas de segurança e deve ficar somente em servidor confiável.

## 7. Estado atual do projeto

O aplicativo já usa o Supabase para ler e gravar registros quando a sessão está autenticada e associada a um workspace. Sem uma sessão remota ativa, a API ainda pode recorrer ao `localStorage`; por isso, confirme o e-mail e workspace usados no login se os dados online não aparecerem.

O fechamento mensal arquiva alguns movimentos na coleção `historico_mensal` e remove esses registos das coleções ativas. Os ecrãs financeiros e relatórios também consultam esse arquivo. Contas a pagar antigas com saldo em aberto são reativadas na coleção ativa ao abrir a página, preservando o vencimento e permitindo pagar ou abater; valores a receber ainda pendentes também voltam à coleção ativa, mantendo o saldo e permitindo registrar recebimentos. Contas quitadas continuam disponíveis como histórico de consulta. A leitura remota percorre páginas para não ficar limitada à primeira página de resultados do Supabase.

O pacote não migra automaticamente dados locais antigos para o Supabase. Antes de remover dados locais, confirme no painel do Supabase que as coleções e o histórico contêm os registos esperados e mantenha um backup.

## 8. Cuidados

Não apague:

- Dados do `localStorage`;
- Arquivos de backup;
- A pasta `src/data`;
- A instalação atual do Windows.

Não apague os dados locais nem os backups até confirmar a integridade do workspace remoto e dos registos arquivados.

## Referências oficiais

[1]: https://supabase.com/docs/guides/database/tables "Supabase: Tables and Data"

[2]: https://supabase.com/docs/guides/database/postgres/row-level-security "Supabase: Row Level Security"

[3]: https://supabase.com/docs/guides/storage/security/access-control "Supabase: Storage Access Control"
