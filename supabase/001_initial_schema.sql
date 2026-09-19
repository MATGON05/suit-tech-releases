-- SUIT-TECH / ST-LDTA
-- Migração inicial privada para Supabase/PostgreSQL.
-- Esta versão NÃO inclui Transferências nem Comissões.
-- Execute no SQL Editor do Supabase.
-- Não coloque chaves secretas neste arquivo.

create extension if not exists pgcrypto;

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'admin', 'user')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create or replace function public.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = (select auth.uid())
  );
$$;

-- Os registros atuais do aplicativo ficam em coleções JSON.
-- Esta lista exclui deliberadamente transfers e comissoes.
create table if not exists public.records (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  collection text not null check (collection in (
    'agendamentos',
    'audit_logs',
    'caixa_entrada',
    'caixa_saida',
    'clientes',
    'contas_pagar',
    'devolucoes',
    'financial_accounts',
    'financial_categories',
    'suppliers',
    'historico_mensal',
    'lixeira',
    'movimentacoes_estoque',
    'produtos',
    'valores_receber',
    'vendas'
  )),
  legacy_id text not null,
  data jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, collection, legacy_id)
);

create index if not exists records_workspace_collection_idx
  on public.records (workspace_id, collection);

create index if not exists records_data_gin_idx
  on public.records using gin (data);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  collection text,
  record_legacy_id text,
  previous_data jsonb,
  new_data jsonb,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_workspace_created_idx
  on public.audit_logs (workspace_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists records_set_updated_at on public.records;
create trigger records_set_updated_at
before update on public.records
for each row execute function public.set_updated_at();

-- Segurança: somente usuários autenticados vinculados ao workspace.
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.records enable row level security;
alter table public.audit_logs enable row level security;

revoke all on table public.workspaces from anon, authenticated;
revoke all on table public.workspace_members from anon, authenticated;
revoke all on table public.records from anon, authenticated;
revoke all on table public.audit_logs from anon, authenticated;

grant select, insert, update, delete on table public.workspaces to authenticated;
grant select, insert, update, delete on table public.workspace_members to authenticated;
grant select, insert, update, delete on table public.records to authenticated;
grant select, insert on table public.audit_logs to authenticated;

drop policy if exists workspaces_member_select on public.workspaces;
create policy workspaces_member_select
on public.workspaces for select to authenticated
using (public.is_workspace_member(id));

drop policy if exists workspaces_member_insert on public.workspaces;
create policy workspaces_member_insert
on public.workspaces for insert to authenticated
with check (true);

drop policy if exists workspaces_member_update on public.workspaces;
create policy workspaces_member_update
on public.workspaces for update to authenticated
using (public.is_workspace_member(id))
with check (public.is_workspace_member(id));

drop policy if exists workspaces_member_delete on public.workspaces;
create policy workspaces_member_delete
on public.workspaces for delete to authenticated
using (public.is_workspace_member(id));

drop policy if exists workspace_members_member_select on public.workspace_members;
create policy workspace_members_member_select
on public.workspace_members for select to authenticated
using (user_id = (select auth.uid()) or public.is_workspace_member(workspace_id));

drop policy if exists workspace_members_member_insert on public.workspace_members;
create policy workspace_members_member_insert
on public.workspace_members for insert to authenticated
with check (
  public.is_workspace_member(workspace_id)
  and role in ('owner', 'admin', 'user')
);

drop policy if exists workspace_members_member_update on public.workspace_members;
create policy workspace_members_member_update
on public.workspace_members for update to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists workspace_members_member_delete on public.workspace_members;
create policy workspace_members_member_delete
on public.workspace_members for delete to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists records_member_select on public.records;
create policy records_member_select
on public.records for select to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists records_member_insert on public.records;
create policy records_member_insert
on public.records for insert to authenticated
with check (public.is_workspace_member(workspace_id));

drop policy if exists records_member_update on public.records;
create policy records_member_update
on public.records for update to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists records_member_delete on public.records;
create policy records_member_delete
on public.records for delete to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists audit_logs_member_select on public.audit_logs;
create policy audit_logs_member_select
on public.audit_logs for select to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists audit_logs_member_insert on public.audit_logs;
create policy audit_logs_member_insert
on public.audit_logs for insert to authenticated
with check (public.is_workspace_member(workspace_id));

-- Bucket privado para fotos e anexos.
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do update set public = false;

drop policy if exists attachments_select_member on storage.objects;
create policy attachments_select_member
on storage.objects for select to authenticated
using (
  bucket_id = 'attachments'
  and public.is_workspace_member(((storage.foldername(name))[1])::uuid)
);

drop policy if exists attachments_insert_member on storage.objects;
create policy attachments_insert_member
on storage.objects for insert to authenticated
with check (
  bucket_id = 'attachments'
  and public.is_workspace_member(((storage.foldername(name))[1])::uuid)
);

drop policy if exists attachments_update_member on storage.objects;
create policy attachments_update_member
on storage.objects for update to authenticated
using (
  bucket_id = 'attachments'
  and public.is_workspace_member(((storage.foldername(name))[1])::uuid)
)
with check (
  bucket_id = 'attachments'
  and public.is_workspace_member(((storage.foldername(name))[1])::uuid)
);

drop policy if exists attachments_delete_member on storage.objects;
create policy attachments_delete_member
on storage.objects for delete to authenticated
using (
  bucket_id = 'attachments'
  and public.is_workspace_member(((storage.foldername(name))[1])::uuid)
);

-- Depois de criar seu usuário em Authentication, crie o workspace:
-- with new_workspace as (
--   insert into public.workspaces (name) values ('SUIT-TECH') returning id
-- )
-- insert into public.workspace_members (workspace_id, user_id, role)
-- select new_workspace.id, auth_user.id, 'owner'
-- from new_workspace
-- cross join auth.users auth_user
-- where auth_user.email = 'SEU_EMAIL_AQUI';
