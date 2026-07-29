-- ===========================================================================
-- Tenant isolation proof (pgTAP)
-- ===========================================================================
--
-- Proves that a user in Org A cannot READ, INSERT, UPDATE or DELETE across into Org B,
-- and that the arbitrary-organization_id insert that broke the previous build is now
-- structurally impossible.
--
-- Everything runs inside a single transaction that ROLLS BACK, so the script leaves no
-- rows behind and is safe to run against any environment, including production.
--
-- Run it with either:
--     psql "$DATABASE_URL" -f supabase/tests/rls.sql
--     supabase test db
-- or by pasting it into the SQL editor. Output is one TAP line per assertion; any line
-- beginning "not ok" is a failure.
--
-- Test identities are synthetic UUIDs and example.test addresses. No real data.

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_catalog;

-- TAP lines are collected here because the assertions run as the `authenticated` role
-- while the fixtures are built as the migration role, and we want a single ordered
-- report at the end.
create temp table tap_out (ord serial primary key, line text) on commit drop;
grant all on table tap_out to authenticated, anon;
grant usage, select on sequence pg_temp.tap_out_ord_seq to authenticated, anon;

select * from no_plan();


-- ---------------------------------------------------------------------------
-- Fixtures. Built with RLS bypassed; two fully separate tenants.
-- ---------------------------------------------------------------------------

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'owner.a@example.test'),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'viewer.a@example.test'),
  ('bbbbbbbb-0000-4000-8000-000000000001', 'owner.b@example.test');

insert into public.organizations (id, name) values
  ('a0000000-0000-4000-8000-00000000000a', 'Org A'),
  ('b0000000-0000-4000-8000-00000000000b', 'Org B');

insert into public.profiles (id, organization_id, full_name, role) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-00000000000a', 'Owner A', 'owner'),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-00000000000a', 'Viewer A', 'viewer'),
  ('bbbbbbbb-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-00000000000b', 'Owner B', 'owner');

insert into public.sites (id, organization_id, name) values
  ('a1000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a', 'Site A'),
  ('b1000000-0000-4000-8000-00000000000b', 'b0000000-0000-4000-8000-00000000000b', 'Site B');

insert into public.departments (id, organization_id, site_id, name) values
  ('a2000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a', 'a1000000-0000-4000-8000-00000000000a', 'Dept A'),
  ('b2000000-0000-4000-8000-00000000000b', 'b0000000-0000-4000-8000-00000000000b', 'b1000000-0000-4000-8000-00000000000b', 'Dept B');

insert into public.employees (id, organization_id, site_id, department_id, employee_ref, hire_date) values
  ('a3000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a', 'a1000000-0000-4000-8000-00000000000a', 'a2000000-0000-4000-8000-00000000000a', 'EMP-A-1', date '2020-01-15'),
  ('b3000000-0000-4000-8000-00000000000b', 'b0000000-0000-4000-8000-00000000000b', 'b1000000-0000-4000-8000-00000000000b', 'b2000000-0000-4000-8000-00000000000b', 'EMP-B-1', date '2021-03-01');

insert into public.incidents (id, organization_id, site_id, department_id, employee_id, incident_date, incident_type, injury_type) values
  ('a4000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a', 'a1000000-0000-4000-8000-00000000000a', 'a2000000-0000-4000-8000-00000000000a', 'a3000000-0000-4000-8000-00000000000a', date '2024-06-01', 'OSHA Recordable', 'Strain'),
  ('b4000000-0000-4000-8000-00000000000b', 'b0000000-0000-4000-8000-00000000000b', 'b1000000-0000-4000-8000-00000000000b', 'b2000000-0000-4000-8000-00000000000b', 'b3000000-0000-4000-8000-00000000000b', date '2024-06-02', 'First Aid', 'Sprain');

insert into public.corrective_actions (id, organization_id, incident_id, description, hierarchy_of_controls) values
  ('a5000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a', 'a4000000-0000-4000-8000-00000000000a', 'Guard the pinch point', 'engineering'),
  ('b5000000-0000-4000-8000-00000000000b', 'b0000000-0000-4000-8000-00000000000b', 'b4000000-0000-4000-8000-00000000000b', 'Toolbox talk', null);

insert into public.hours_worked (id, organization_id, site_id, period_year, period_month, hours) values
  ('a6000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a', 'a1000000-0000-4000-8000-00000000000a', 2024, 6, 42000),
  ('b6000000-0000-4000-8000-00000000000b', 'b0000000-0000-4000-8000-00000000000b', 'b1000000-0000-4000-8000-00000000000b', 2024, 6, 31000);

insert into public.leading_indicators (id, organization_id, site_id, period_year, period_month, inspections_completed, hazards_reported) values
  ('a7000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a', 'a1000000-0000-4000-8000-00000000000a', 2024, 6, 12, 30),
  ('b7000000-0000-4000-8000-00000000000b', 'b0000000-0000-4000-8000-00000000000b', 'b1000000-0000-4000-8000-00000000000b', 2024, 6, 8, 5);

insert into public.compliance_obligations (id, organization_id, site_id, jurisdiction, obligation, frequency) values
  ('a8000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a', 'a1000000-0000-4000-8000-00000000000a', 'Federal', 'Obligation A', 'Annual'),
  ('b8000000-0000-4000-8000-00000000000b', 'b0000000-0000-4000-8000-00000000000b', 'b1000000-0000-4000-8000-00000000000b', 'State', 'Obligation B', 'Quarterly');

insert into public.compliance_events (id, organization_id, obligation_id, due_date) values
  ('a9000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a', 'a8000000-0000-4000-8000-00000000000a', date '2024-12-31'),
  ('b9000000-0000-4000-8000-00000000000b', 'b0000000-0000-4000-8000-00000000000b', 'b8000000-0000-4000-8000-00000000000b', date '2024-12-31');


-- ===========================================================================
-- Structural assertions (run as the migration role)
-- ===========================================================================

insert into tap_out (line) select is_empty(
  $$ select c.relname::text
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity $$,
  'STRUCTURE: every table in public has RLS enabled'
);

insert into tap_out (line) select is_empty(
  $$ select c.relname::text
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r'
       and not exists (select 1 from pg_policy p where p.polrelid = c.oid) $$,
  'STRUCTURE: every table in public has at least one RLS policy'
);

-- A view without security_invoker runs as its owner and bypasses RLS entirely.
insert into tap_out (line) select is_empty(
  $$ select c.relname::text
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'v'
       and coalesce(array_to_string(c.reloptions, ','), '') not like '%security_invoker=on%' $$,
  'STRUCTURE: every view in public sets security_invoker = on'
);

insert into tap_out (line) select is_empty(
  $$ select c.relname::text
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r'
       and c.relname not in ('organizations', 'hierarchy_of_control_levels')
       and not exists (
         select 1 from pg_attribute a
         where a.attrelid = c.oid and a.attname = 'organization_id' and not a.attisdropped
       ) $$,
  'STRUCTURE: every tenant table carries an organization_id column'
);

insert into tap_out (line) select ok(
  not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'current_org_id'
      and has_function_privilege('anon', p.oid, 'execute')
  ),
  'STRUCTURE: anon cannot execute current_org_id()'
);

insert into tap_out (line) select ok(
  (select p.provolatile from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'current_org_id') = 's'
  and (select p.prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = 'current_org_id'),
  'STRUCTURE: current_org_id() is STABLE and SECURITY DEFINER'
);

insert into tap_out (line) select ok(
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('current_org_id', 'current_org_role', 'can_write', 'is_org_admin',
                       'set_organization_id', 'set_organization_id_allow_system',
                       'lock_organization_id', 'guard_profile_update',
                       'bootstrap_organization', 'add_member_to_current_org')
     and p.proconfig is not null
     and exists (select 1 from unnest(p.proconfig) cfg where cfg like 'search_path=%')
  ) = 10,
  'STRUCTURE: all tenancy functions pin an explicit search_path'
);

-- Every tenant table must carry both organization_id triggers.
insert into tap_out (line) select is_empty(
  $$ select c.relname::text
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r'
       and c.relname not in ('organizations', 'profiles', 'hierarchy_of_control_levels')
       and not exists (
         select 1 from pg_trigger t
         where t.tgrelid = c.oid and not t.tgisinternal
           and t.tgname = c.relname || '_set_organization_id'
       ) $$,
  'STRUCTURE: every tenant table has a BEFORE INSERT set_organization_id trigger'
);

insert into tap_out (line) select is_empty(
  $$ select c.relname::text
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r'
       and c.relname not in ('organizations', 'profiles', 'hierarchy_of_control_levels')
       and not exists (
         select 1 from pg_trigger t
         where t.tgrelid = c.oid and not t.tgisinternal
           and t.tgname = c.relname || '_lock_organization_id'
       ) $$,
  'STRUCTURE: every tenant table has a BEFORE UPDATE lock_organization_id trigger'
);


-- ===========================================================================
-- Org A owner: reads are confined to Org A
-- ===========================================================================

set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';

insert into tap_out (line) select is(
  public.current_org_id(),
  'a0000000-0000-4000-8000-00000000000a'::uuid,
  'CONTEXT: current_org_id() resolves to Org A for Org A owner'
);

insert into tap_out (line) select is(
  (select count(*) from public.incidents)::int, 1,
  'READ: incidents visible to Org A owner = 1 (Org B row hidden)'
);

insert into tap_out (line) select is(
  (select count(*) from public.incidents
   where id = 'b4000000-0000-4000-8000-00000000000b')::int, 0,
  'READ: Org B incident is invisible when addressed by primary key'
);

insert into tap_out (line) select is(
  (select count(*) from public.organizations)::int, 1,
  'READ: only own organization row is visible'
);

insert into tap_out (line) select is(
  (select count(*) from public.profiles)::int, 2,
  'READ: only Org A profiles are visible'
);

insert into tap_out (line) select is(
  (select count(*) from public.sites)::int, 1, 'READ: sites are org-scoped');
insert into tap_out (line) select is(
  (select count(*) from public.departments)::int, 1, 'READ: departments are org-scoped');
insert into tap_out (line) select is(
  (select count(*) from public.employees)::int, 1, 'READ: employees are org-scoped');
insert into tap_out (line) select is(
  (select count(*) from public.corrective_actions)::int, 1,
  'READ: corrective_actions are org-scoped');
insert into tap_out (line) select is(
  (select count(*) from public.hours_worked)::int, 1, 'READ: hours_worked is org-scoped');
insert into tap_out (line) select is(
  (select count(*) from public.leading_indicators)::int, 1,
  'READ: leading_indicators are org-scoped');
insert into tap_out (line) select is(
  (select count(*) from public.compliance_obligations)::int, 1,
  'READ: compliance_obligations are org-scoped');
insert into tap_out (line) select is(
  (select count(*) from public.compliance_events)::int, 1,
  'READ: compliance_events are org-scoped');

-- Views must not become a side door around RLS.
insert into tap_out (line) select is(
  (select count(*) from public.incidents_enriched)::int, 1,
  'READ: incidents_enriched view is org-scoped (security_invoker holds)');
insert into tap_out (line) select is(
  (select count(*) from public.corrective_actions_enriched)::int, 1,
  'READ: corrective_actions_enriched view is org-scoped');


-- ===========================================================================
-- The vulnerability that broke the previous build
-- ===========================================================================

-- Inserting with a forged organization_id must NOT land the row in Org B. The BEFORE
-- INSERT trigger overwrites the column, so the row lands in Org A instead.
insert into public.incidents
  (id, organization_id, site_id, incident_date, incident_type)
values
  ('a4000000-0000-4000-8000-0000000000ff',
   'b0000000-0000-4000-8000-00000000000b',   -- forged: Org B
   'a1000000-0000-4000-8000-00000000000a',
   date '2024-07-01', 'Near Miss');

insert into tap_out (line) select is(
  (select organization_id from public.incidents
   where id = 'a4000000-0000-4000-8000-0000000000ff'),
  'a0000000-0000-4000-8000-00000000000a'::uuid,
  'INSERT: forged organization_id is overwritten with the caller''s own org'
);

insert into tap_out (line) select is(
  (select count(*) from public.incidents
   where organization_id = 'b0000000-0000-4000-8000-00000000000b')::int, 0,
  'INSERT: no row was created in Org B'
);

-- Inserting a row that references another tenant's site must fail on the composite FK,
-- even though RLS alone would not catch it (FK checks are not RLS-filtered).
insert into tap_out (line) select throws_ok(
  $$ insert into public.incidents (organization_id, site_id, incident_date, incident_type)
     values ('a0000000-0000-4000-8000-00000000000a',
             'b1000000-0000-4000-8000-00000000000b',
             date '2024-07-02', 'Hazard') $$,
  '23503',
  null,
  'INSERT: referencing another tenant''s site violates the composite foreign key'
);

-- Updating one's own row to move it into Org B must not move it.
update public.incidents
   set organization_id = 'b0000000-0000-4000-8000-00000000000b'
 where id = 'a4000000-0000-4000-8000-00000000000a';

insert into tap_out (line) select is(
  (select organization_id from public.incidents
   where id = 'a4000000-0000-4000-8000-00000000000a'),
  'a0000000-0000-4000-8000-00000000000a'::uuid,
  'UPDATE: organization_id is pinned; a row cannot be moved to another tenant'
);

-- Writes aimed at Org B rows simply match nothing.
with u as (
  update public.incidents set description = 'tampered'
   where id = 'b4000000-0000-4000-8000-00000000000b' returning 1
)
insert into tap_out (line) select is(
  (select count(*) from u)::int, 0,
  'UPDATE: updating an Org B incident affects zero rows'
);

with d as (
  delete from public.incidents
   where id = 'b4000000-0000-4000-8000-00000000000b' returning 1
)
insert into tap_out (line) select is(
  (select count(*) from d)::int, 0,
  'DELETE: deleting an Org B incident affects zero rows'
);

with d as (
  delete from public.corrective_actions
   where id = 'b5000000-0000-4000-8000-00000000000b' returning 1
)
insert into tap_out (line) select is(
  (select count(*) from d)::int, 0,
  'DELETE: deleting an Org B corrective action affects zero rows'
);

with d as (
  delete from public.sites where id = 'b1000000-0000-4000-8000-00000000000b' returning 1
)
insert into tap_out (line) select is(
  (select count(*) from d)::int, 0,
  'DELETE: deleting an Org B site affects zero rows'
);

-- A user cannot move their own membership. The guard trigger pins organization_id back
-- rather than raising, so the update succeeds and changes nothing.
update public.profiles
   set organization_id = 'b0000000-0000-4000-8000-00000000000b'
 where id = 'aaaaaaaa-0000-4000-8000-000000000001';

insert into tap_out (line) select is(
  (select organization_id from public.profiles
   where id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  'a0000000-0000-4000-8000-00000000000a'::uuid,
  'UPDATE: a user cannot move their own profile to another organization'
);


-- ===========================================================================
-- Hierarchy of controls
-- ===========================================================================

insert into tap_out (line) select is(
  (select count(*) from public.hierarchy_of_control_levels)::int, 5,
  'HOC: all five control levels are readable'
);

insert into tap_out (line) select results_eq(
  $$ select code from public.hierarchy_of_control_levels order by rank $$,
  $$ values ('elimination'), ('substitution'), ('engineering'), ('administrative'), ('ppe') $$,
  'HOC: rank orders Elimination -> PPE, not alphabetically'
);

insert into tap_out (line) select throws_ok(
  $$ insert into public.hierarchy_of_control_levels (code, rank, label, description)
     values ('custom', 6, 'Custom', 'nope') $$,
  '42501',
  null,
  'HOC: the control level list is not writable by tenants'
);

-- The field must never block a save.
insert into public.corrective_actions (incident_id, description)
values ('a4000000-0000-4000-8000-00000000000a', 'Unclassified action saves fine');

insert into tap_out (line) select is(
  (select count(*) from public.corrective_actions where hierarchy_of_controls is null)::int, 1,
  'HOC: a corrective action saves with hierarchy_of_controls NULL'
);

insert into tap_out (line) select is(
  (select hoc_label from public.corrective_actions_enriched
   where hierarchy_of_controls is null limit 1),
  'Unclassified',
  'HOC: NULL surfaces as the label "Unclassified"'
);

insert into tap_out (line) select is(
  (select hoc_token from public.corrective_actions_enriched
   where hierarchy_of_controls is null limit 1)::int, 0,
  'HOC: Unclassified maps to colour token 0 (outside the green ramp)'
);

insert into tap_out (line) select is(
  (select hoc_sort_rank from public.corrective_actions_enriched
   where hierarchy_of_controls is null limit 1)::int, 999,
  'HOC: Unclassified sorts last, not first'
);

insert into tap_out (line) select is(
  (select is_engineering_or_above from public.corrective_actions_enriched
   where hierarchy_of_controls is null limit 1),
  null,
  'HOC: Unclassified is NULL for the maturity KPI, so it leaves the denominator'
);

insert into tap_out (line) select is(
  (select count(*) from public.corrective_actions_needing_classification)::int, 1,
  'HOC: the needs-classification queue returns exactly the unclassified rows'
);


-- ===========================================================================
-- Compliance calendar
-- ===========================================================================
--
-- The generator writes rows on the caller's behalf, which makes it the one place in the
-- schema where a tenant boundary could be crossed by something other than a direct
-- insert. It runs SECURITY INVOKER, so RLS decides what it can see, and the assertions
-- below prove that holds -- including the case where a caller passes another tenant's
-- obligation id, which must be indistinguishable from passing a nonexistent one.

-- Still acting as Org A owner.
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';

insert into tap_out (line) select is(
  (select count(*) from public.compliance_events_enriched)::int, 1,
  'COMPLIANCE: compliance_events_enriched is org-scoped (security_invoker holds)'
);

insert into tap_out (line) select is(
  (select count(*) from public.compliance_obligations_enriched)::int, 1,
  'COMPLIANCE: compliance_obligations_enriched is org-scoped'
);

-- Creating an obligation generates its dated entries by trigger, and they must be stamped
-- with the caller's org -- not with whatever the payload claimed.
insert into public.compliance_obligations
  (id, organization_id, site_id, jurisdiction, obligation, frequency, due_date)
values
  ('a8000000-0000-4000-8000-0000000000ff',
   'b0000000-0000-4000-8000-00000000000b',   -- forged: Org B
   'a1000000-0000-4000-8000-00000000000a',
   'Federal', 'Quarterly discharge sampling', 'Quarterly', current_date);

insert into tap_out (line) select is(
  (select organization_id from public.compliance_obligations
   where id = 'a8000000-0000-4000-8000-0000000000ff'),
  'a0000000-0000-4000-8000-00000000000a'::uuid,
  'COMPLIANCE: a forged organization_id on an obligation is overwritten'
);

insert into tap_out (line) select ok(
  (select count(*) from public.compliance_events
   where obligation_id = 'a8000000-0000-4000-8000-0000000000ff')::int > 0,
  'COMPLIANCE: creating an obligation generates its calendar entries'
);

insert into tap_out (line) select is_empty(
  $$ select ce.id::text from public.compliance_events ce
     where ce.obligation_id = 'a8000000-0000-4000-8000-0000000000ff'
       and ce.organization_id <> 'a0000000-0000-4000-8000-00000000000a' $$,
  'COMPLIANCE: every generated entry carries the caller''s own organization_id'
);

-- Re-running the generator cannot duplicate a date.
insert into tap_out (line) select is(
  public.generate_compliance_events('a8000000-0000-4000-8000-0000000000ff'), 0,
  'COMPLIANCE: the generator is idempotent -- a second run creates nothing'
);

-- The frequencies that describe a standing duty rather than a dated task must never
-- acquire a date, whatever is passed alongside them.
insert into public.compliance_obligations
  (id, organization_id, jurisdiction, obligation, frequency, due_date)
values
  ('a8000000-0000-4000-8000-0000000000fe',
   'a0000000-0000-4000-8000-00000000000a',
   'Federal', 'Maintain the written PPE hazard assessment', 'Ongoing', current_date);

insert into tap_out (line) select is(
  (select count(*) from public.compliance_events
   where obligation_id = 'a8000000-0000-4000-8000-0000000000fe')::int, 0,
  'COMPLIANCE: an Ongoing obligation generates no dates, even carrying a due_date'
);

-- No anchor means no dates. The tempting bug is to invent a plausible one.
insert into public.compliance_obligations
  (id, organization_id, jurisdiction, obligation, frequency)
values
  ('a8000000-0000-4000-8000-0000000000fd',
   'a0000000-0000-4000-8000-00000000000a',
   'State', 'Renew the state air permit', 'Every 4 years');

insert into tap_out (line) select is(
  (select count(*) from public.compliance_events
   where obligation_id = 'a8000000-0000-4000-8000-0000000000fd')::int, 0,
  'COMPLIANCE: an obligation with no due date and no recurrence anchor generates nothing'
);

-- Completed history survives a schedule change; untouched future placeholders do not.
update public.compliance_events
   set status = 'Compliant', completed_date = current_date, completed_by = 'Owner A'
 where obligation_id = 'a8000000-0000-4000-8000-0000000000ff'
   and due_date = current_date;

update public.compliance_obligations
   set frequency = 'Annual', due_date = current_date + 40
 where id = 'a8000000-0000-4000-8000-0000000000ff';

insert into tap_out (line) select is(
  (select count(*) from public.compliance_events
   where obligation_id = 'a8000000-0000-4000-8000-0000000000ff'
     and completed_date is not null)::int, 1,
  'COMPLIANCE: a completed entry survives a change to the obligation''s schedule'
);

insert into tap_out (line) select is(
  (select count(*) from public.compliance_events
   where obligation_id = 'a8000000-0000-4000-8000-0000000000ff'
     and due_date = current_date + 40)::int, 1,
  'COMPLIANCE: and the new schedule''s dates are generated'
);

-- "Compliant" with no date recorded is an assertion, not an audit trail.
insert into tap_out (line) select throws_ok(
  $$ update public.compliance_events set status = 'Compliant', completed_date = null
      where id = 'a9000000-0000-4000-8000-00000000000a' $$,
  '23514',
  null,
  'COMPLIANCE: a Compliant entry cannot be saved without a completion date'
);

-- The generator called against another tenant's obligation: RLS makes it look like an id
-- that does not exist, which is exactly what it should look like.
insert into tap_out (line) select is(
  public.generate_compliance_events('b8000000-0000-4000-8000-00000000000b'), 0,
  'COMPLIANCE: the generator does nothing for another tenant''s obligation id'
);

insert into tap_out (line) select is(
  (select count(*) from public.compliance_events
   where obligation_id = 'b8000000-0000-4000-8000-00000000000b'
     and organization_id = 'a0000000-0000-4000-8000-00000000000a')::int, 0,
  'COMPLIANCE: and it creates nothing under the caller''s org either'
);

-- Regenerating another tenant's obligation must not delete their future entries.
insert into tap_out (line) select is(
  public.regenerate_compliance_events('b8000000-0000-4000-8000-00000000000b'), 0,
  'COMPLIANCE: regeneration does nothing for another tenant''s obligation id'
);


-- ===========================================================================
-- Role enforcement: viewer is read-only
-- ===========================================================================

set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-4000-8000-000000000002","role":"authenticated"}';

insert into tap_out (line) select is(
  (select count(*) from public.incidents)::int, 2,
  'ROLE: a viewer can read their own org''s incidents'
);

insert into tap_out (line) select throws_ok(
  $$ insert into public.incidents (site_id, incident_date, incident_type)
     values ('a1000000-0000-4000-8000-00000000000a', date '2024-08-01', 'Hazard') $$,
  '42501',
  null,
  'ROLE: a viewer cannot insert (can_write() is false)'
);

with u as (
  update public.incidents set description = 'viewer edit'
   where id = 'a4000000-0000-4000-8000-00000000000a' returning 1
)
insert into tap_out (line) select is(
  (select count(*) from u)::int, 0,
  'ROLE: a viewer cannot update'
);

-- Self-promotion is refused by the profiles guard trigger.
insert into tap_out (line) select throws_ok(
  $$ update public.profiles set role = 'owner'
      where id = 'aaaaaaaa-0000-4000-8000-000000000002' $$,
  '42501',
  null,
  'ROLE: a viewer cannot promote themselves to owner'
);


-- ===========================================================================
-- Org B owner sees the mirror image
-- ===========================================================================

set local request.jwt.claims = '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';

insert into tap_out (line) select is(
  (select count(*) from public.incidents)::int, 1,
  'READ: Org B owner sees only the Org B incident'
);

insert into tap_out (line) select is(
  (select id from public.incidents),
  'b4000000-0000-4000-8000-00000000000b'::uuid,
  'READ: and it is the Org B row, unmodified by Org A''s attempts'
);

insert into tap_out (line) select is(
  (select count(*) from public.corrective_actions)::int, 1,
  'READ: Org B corrective action survived Org A''s delete attempt'
);

-- Asserted from Org B's own session deliberately: counting Org B's rows from Org A would
-- return zero whether they survived or not, which proves nothing.
insert into tap_out (line) select is(
  (select count(*) from public.compliance_events)::int, 1,
  'READ: Org B calendar entry survived Org A''s regeneration attempt'
);


-- ===========================================================================
-- Anonymous callers get nothing
-- ===========================================================================

-- `authenticated` is not a member of `anon`, so step back to the session role first.
reset role;
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

insert into tap_out (line) select throws_ok(
  $$ select count(*) from public.incidents $$,
  '42501',
  null,
  'ANON: anonymous callers have no privilege on incidents'
);

insert into tap_out (line) select throws_ok(
  $$ select public.current_org_id() $$,
  '42501',
  null,
  'ANON: anonymous callers cannot execute current_org_id()'
);

reset role;

insert into tap_out (line) select * from finish();

-- The report. Any line beginning "not ok" is a failure.
select line from tap_out order by ord;

rollback;
