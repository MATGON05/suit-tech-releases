# Configuração do Supabase para o projeto correto

## Observação sobre as abas removidas

O ZIP enviado contém referências antigas a `comissoes` e `transfers` em rotinas de dados, backup e textos internos, mas as abas **Transferências** e **Comissões** não devem mais fazer parte do sistema. A migração criada nesta pasta não cria essas coleções no banco online.

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

O arquivo `src/renderer/js/api.js` ainda usa `localStorage`. Isso foi mantido de propósito para não destruir os dados atuais antes de realizar a migração.

A próxima alteração no código será feita para:

1. Fazer login no Supabase;
2. Identificar seu workspace;
3. Ler e salvar registros no banco online;
4. Enviar fotos para o Storage privado;
5. Migrar os dados locais do Windows;
6. Manter backup antes da migração;
7. Remover do aplicativo as referências funcionais a Transferências e Comissões.

## 8. Não faça ainda

Não apague:

- Dados do `localStorage`;
- Arquivos de backup;
- A pasta `src/data`;
- A instalação atual do Windows.

Primeiro criaremos o banco, depois conectaremos o aplicativo em modo de teste e somente após conferirmos os dados faremos a migração definitiva.

## Referências oficiais

[1]: https://supabase.com/docs/guides/database/tables "Supabase: Tables and Data"

[2]: https://supabase.com/docs/guides/database/postgres/row-level-security "Supabase: Row Level Security"

[3]: https://supabase.com/docs/guides/storage/security/access-control "Supabase: Storage Access Control"
