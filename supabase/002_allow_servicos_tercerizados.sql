-- Corrige bancos Supabase criados antes da coleção de serviços terceirizados.
-- Execute uma vez no Supabase SQL Editor (ou reaplique com segurança).
-- A migration preserva a expressão atual do check e só acrescenta a coleção
-- servicos_tercerizados; não habilita transfers nem comissoes.

begin;

do $migration$
declare
  current_check text;
begin
  if to_regclass('public.records') is null then
    raise exception 'A tabela public.records não existe. Execute primeiro supabase/001_initial_schema.sql.';
  end if;

  select pg_get_expr(c.conbin, c.conrelid)
    into current_check
  from pg_constraint c
  where c.conrelid = 'public.records'::regclass
    and c.conname = 'records_collection_check'
    and c.contype = 'c';

  if current_check is null then
    raise exception 'A constraint public.records_collection_check não foi encontrada. Confira o esquema antes de aplicar a migration.';
  end if;

  if position('servicos_tercerizados' in current_check) > 0 then
    raise notice 'A coleção servicos_tercerizados já está permitida; nenhuma alteração necessária.';
  else
    execute 'alter table public.records drop constraint records_collection_check';
    execute format(
      'alter table public.records add constraint records_collection_check check ((%s) or collection = %L)',
      current_check,
      'servicos_tercerizados'
    );
    raise notice 'Coleção servicos_tercerizados adicionada; demais valores permitidos foram preservados.';
  end if;
end;
$migration$;

commit;
