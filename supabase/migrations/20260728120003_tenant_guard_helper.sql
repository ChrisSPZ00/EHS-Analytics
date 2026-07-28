-- apply_tenant_guards(): one call installs the complete tenant protection set on a table.
--
-- Hard rule 2 and hard rule 3 say every table gets organization_id enforcement and RLS.
-- Applying that by hand per table is how a table eventually ships without a policy, so
-- the pattern is codified here instead. Every operational table calls this exactly once
-- in the same migration that creates it, which means no table exists -- even for one
-- migration -- without RLS enabled.
--
-- Installed per table:
--   BEFORE INSERT  -> set_organization_id()   (overwrites any client-supplied value)
--   BEFORE UPDATE  -> lock_organization_id()  (pins organization_id to its stored value)
--   BEFORE UPDATE  -> set_updated_at()
--   RLS enabled, with select/insert/update/delete policies scoped to current_org_id().
--   Writes additionally require can_write(), so the 'viewer' role is read-only.
--   All privileges revoked from anon; CRUD granted to authenticated.

create or replace function public.apply_tenant_guards(p_table regclass)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_qualified text := p_table::text;
  v_name text := (
    select c.relname from pg_catalog.pg_class c where c.oid = p_table
  );
begin
  if not exists (
    select 1
    from pg_catalog.pg_attribute a
    where a.attrelid = p_table
      and a.attname = 'organization_id'
      and not a.attisdropped
  ) then
    raise exception 'apply_tenant_guards: table % has no organization_id column', v_qualified;
  end if;

  execute format('alter table %s enable row level security', v_qualified);

  execute format(
    'create trigger %I before insert on %s for each row execute function public.set_organization_id()',
    v_name || '_set_organization_id', v_qualified);
  execute format(
    'create trigger %I before update on %s for each row execute function public.lock_organization_id()',
    v_name || '_lock_organization_id', v_qualified);
  execute format(
    'create trigger %I before update on %s for each row execute function public.set_updated_at()',
    v_name || '_set_updated_at', v_qualified);

  execute format(
    'create policy %I on %s for select to authenticated using (organization_id = public.current_org_id())',
    v_name || '_select', v_qualified);
  execute format(
    'create policy %I on %s for insert to authenticated with check (organization_id = public.current_org_id() and public.can_write())',
    v_name || '_insert', v_qualified);
  execute format(
    'create policy %I on %s for update to authenticated using (organization_id = public.current_org_id() and public.can_write()) with check (organization_id = public.current_org_id() and public.can_write())',
    v_name || '_update', v_qualified);
  execute format(
    'create policy %I on %s for delete to authenticated using (organization_id = public.current_org_id() and public.can_write())',
    v_name || '_delete', v_qualified);

  execute format('revoke all on %s from anon', v_qualified);
  execute format('grant select, insert, update, delete on %s to authenticated', v_qualified);
end;
$$;

comment on function public.apply_tenant_guards(regclass) is
  'Installs the standard organization_id triggers, RLS policies and grants on a tenant table. '
  'Called once per table by the migration that creates it.';

revoke all on function public.apply_tenant_guards(regclass) from public;
revoke all on function public.apply_tenant_guards(regclass) from anon;
revoke all on function public.apply_tenant_guards(regclass) from authenticated;

-- Variant for shared reference data (injury types, body parts) where a NULL
-- organization_id means "system default, visible to every tenant". Tenants may add
-- their own rows; those are always stamped with their own org.
create or replace function public.set_organization_id_allow_system()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is not null then
    new.organization_id := public.current_org_id();
    if new.organization_id is null then
      raise exception 'No organization context: user % has no profile', v_uid
        using errcode = '42501';
    end if;
  end if;
  -- No user context (migration / service_role): the supplied value stands, and NULL
  -- is meaningful here -- it denotes a system-provided default row.
  return new;
end;
$$;
