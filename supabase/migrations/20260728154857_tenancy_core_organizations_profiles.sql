-- Multi-tenancy foundation.
--
-- Threat model: a client must never be able to read, write or attribute a row to an
-- organization other than their own -- including by passing an arbitrary organization_id
-- in an insert or update payload. Three independent mechanisms enforce this:
--
--   1. current_org_id() resolves the caller's org SERVER-SIDE from their auth.uid().
--      The client never supplies it and cannot influence it.
--   2. A BEFORE INSERT trigger OVERWRITES organization_id with current_org_id(), and a
--      BEFORE UPDATE trigger pins it back to its previous value. Whatever the client
--      sends in that column is discarded.
--   3. RLS USING and WITH CHECK clauses compare organization_id to current_org_id().
--      Postgres evaluates WITH CHECK against the post-trigger row, so a forged value
--      that somehow survived (1) and (2) still fails here.
--
-- Any one of these failing leaves the other two standing.

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  naics_code text,
  employee_count integer check (employee_count is null or employee_count >= 0),
  -- Injury records are sensitive. When true the UI renders employee_ref only and
  -- suppresses display_name everywhere.
  anonymize_employees boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.organizations is
  'Tenant root. There is no organization_id column here -- the primary key IS the tenant key.';
comment on column public.organizations.anonymize_employees is
  'Per-organization privacy setting: when true the UI shows employee_ref instead of display_name.';

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  full_name text,
  role public.user_role not null default 'viewer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_organization_id_idx on public.profiles (organization_id);

comment on table public.profiles is
  'Maps an auth user to exactly one organization. This table is the sole source of truth '
  'for tenant membership; current_org_id() reads it and nothing else.';


-- ---------------------------------------------------------------------------
-- Tenant context resolution
-- ---------------------------------------------------------------------------

-- SECURITY DEFINER so it can read profiles without being subject to the RLS policies
-- that themselves call this function -- that is what prevents infinite recursion.
-- For the same reason public.profiles must never have FORCE ROW LEVEL SECURITY set.
create or replace function public.current_org_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.organization_id
  from public.profiles p
  where p.id = (select auth.uid());
$$;

comment on function public.current_org_id() is
  'The caller''s organization, resolved server-side from auth.uid(). Never client-supplied. '
  'Returns NULL when there is no user context or the user has no profile, which causes every '
  'RLS predicate that references it to evaluate to NULL and therefore deny.';

revoke all on function public.current_org_id() from public;
revoke all on function public.current_org_id() from anon;
grant execute on function public.current_org_id() to authenticated;

create or replace function public.current_org_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles p
  where p.id = (select auth.uid());
$$;

revoke all on function public.current_org_role() from public;
revoke all on function public.current_org_role() from anon;
grant execute on function public.current_org_role() to authenticated;

-- Viewers get read-only access; everyone else may write operational data.
create or replace function public.can_write()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.role from public.profiles p where p.id = (select auth.uid()))
      in ('owner', 'admin', 'contributor'),
    false
  );
$$;

revoke all on function public.can_write() from public;
revoke all on function public.can_write() from anon;
grant execute on function public.can_write() to authenticated;

create or replace function public.is_org_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.role from public.profiles p where p.id = (select auth.uid()))
      in ('owner', 'admin'),
    false
  );
$$;

revoke all on function public.is_org_admin() from public;
revoke all on function public.is_org_admin() from anon;
grant execute on function public.is_org_admin() to authenticated;


-- ---------------------------------------------------------------------------
-- organization_id enforcement triggers
-- ---------------------------------------------------------------------------

create or replace function public.set_organization_id()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_org uuid;
begin
  if v_uid is not null then
    -- A request carrying an end-user JWT: the column is server-assigned, full stop.
    -- Anything the client sent in new.organization_id is discarded here.
    v_org := public.current_org_id();
    if v_org is null then
      raise exception 'No organization context: user % has no profile', v_uid
        using errcode = '42501';
    end if;
    new.organization_id := v_org;
  else
    -- No end-user context. This is service_role or a direct database session, both of
    -- which already bypass RLS entirely, so there is no privilege to escalate here.
    -- Used by migrations and the seed script; an explicit value is required.
    if new.organization_id is null then
      raise exception 'organization_id must be supplied when there is no user context'
        using errcode = '23502';
    end if;
  end if;
  return new;
end;
$$;

comment on function public.set_organization_id() is
  'BEFORE INSERT trigger: overwrites organization_id with the caller''s own org. '
  'The client-supplied value is never trusted.';

create or replace function public.lock_organization_id()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- organization_id is immutable after insert. Silently pinning it back (rather than
  -- raising) means a client that sends the whole row back on update -- which is the
  -- normal REST/PostgREST pattern -- still succeeds, it just cannot move the row.
  new.organization_id := old.organization_id;
  return new;
end;
$$;

comment on function public.lock_organization_id() is
  'BEFORE UPDATE trigger: restores organization_id to its stored value, making tenant '
  'reassignment impossible from the client.';


-- ---------------------------------------------------------------------------
-- profiles: organization_id and role are not self-service
-- ---------------------------------------------------------------------------

create or replace function public.guard_profile_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- A user may never move themselves between organizations.
  new.organization_id := old.organization_id;
  new.id := old.id;

  -- Nor grant themselves a higher role. Only an owner/admin of the same org may
  -- change a role, and only through this path.
  if new.role is distinct from old.role and not public.is_org_admin() then
    raise exception 'Only an owner or admin may change a profile role'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger profiles_guard_update
  before update on public.profiles
  for each row execute function public.guard_profile_update();

create trigger organizations_set_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();


-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;

-- organizations: readable by its own members; editable by owner/admin.
-- Deliberately NO insert policy -- orgs are created only via bootstrap_organization().
create policy organizations_select_own
  on public.organizations for select to authenticated
  using (id = public.current_org_id());

create policy organizations_update_own
  on public.organizations for update to authenticated
  using (id = public.current_org_id() and public.is_org_admin())
  with check (id = public.current_org_id() and public.is_org_admin());

-- profiles: members see their colleagues; you may edit your own name; admins may
-- administer profiles within their own org. No insert policy -- membership is granted
-- only through the SECURITY DEFINER functions below.
create policy profiles_select_same_org
  on public.profiles for select to authenticated
  using (organization_id = public.current_org_id());

create policy profiles_update_self
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy profiles_update_by_admin
  on public.profiles for update to authenticated
  using (organization_id = public.current_org_id() and public.is_org_admin())
  with check (organization_id = public.current_org_id() and public.is_org_admin());

create policy profiles_delete_by_admin
  on public.profiles for delete to authenticated
  using (
    organization_id = public.current_org_id()
    and public.is_org_admin()
    and id <> (select auth.uid())
  );


-- ---------------------------------------------------------------------------
-- Membership bootstrap
-- ---------------------------------------------------------------------------

-- The only way an organization comes into existence. Creates the org and makes the
-- calling user its owner. Refuses if the caller already belongs to an org, so this
-- cannot be used to hop tenants or to mint orgs in a loop.
create or replace function public.bootstrap_organization(
  p_org_name text,
  p_full_name text default null,
  p_naics_code text default null,
  p_employee_count integer default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_org_id uuid;
begin
  if v_uid is null then
    raise exception 'bootstrap_organization requires an authenticated user'
      using errcode = '42501';
  end if;

  if exists (select 1 from public.profiles p where p.id = v_uid) then
    raise exception 'User already belongs to an organization'
      using errcode = '42501';
  end if;

  insert into public.organizations (name, naics_code, employee_count)
  values (p_org_name, p_naics_code, p_employee_count)
  returning id into v_org_id;

  insert into public.profiles (id, organization_id, full_name, role)
  values (v_uid, v_org_id, p_full_name, 'owner');

  return v_org_id;
end;
$$;

revoke all on function public.bootstrap_organization(text, text, text, integer) from public;
revoke all on function public.bootstrap_organization(text, text, text, integer) from anon;
grant execute on function public.bootstrap_organization(text, text, text, integer) to authenticated;

-- Adds an existing auth user to the CALLER'S org. The target organization is taken from
-- current_org_id() and is not a parameter, so an admin cannot place a user into a
-- different tenant.
create or replace function public.add_member_to_current_org(
  p_user_id uuid,
  p_full_name text default null,
  p_role public.user_role default 'viewer'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_id uuid := public.current_org_id();
begin
  if v_org_id is null or not public.is_org_admin() then
    raise exception 'Only an owner or admin may add members'
      using errcode = '42501';
  end if;

  if p_role = 'owner' and public.current_org_role() <> 'owner' then
    raise exception 'Only an owner may grant the owner role'
      using errcode = '42501';
  end if;

  insert into public.profiles (id, organization_id, full_name, role)
  values (p_user_id, v_org_id, p_full_name, p_role);
end;
$$;

revoke all on function public.add_member_to_current_org(uuid, text, public.user_role) from public;
revoke all on function public.add_member_to_current_org(uuid, text, public.user_role) from anon;
grant execute on function public.add_member_to_current_org(uuid, text, public.user_role) to authenticated;
