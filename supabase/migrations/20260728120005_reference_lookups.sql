-- Reference data.
--
-- injury_types and body_parts are TEXT on the incidents table rather than enums, backed
-- by these lookup tables. That is deliberate: the lookups drive the dropdowns, but a CSV
-- import carrying an unfamiliar value must still land rather than be rejected. Rejecting
-- a client's historical data because their spreadsheet says "Laceration" instead of
-- "Cut/Laceration" is exactly the failure mode the import flow exists to avoid.
--
-- organization_id IS NULL on these two tables means "system default, visible to every
-- tenant". A tenant may add its own rows, which are always stamped with its own org.

create table public.injury_types (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete cascade,
  label text not null check (length(trim(label)) > 0),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index injury_types_system_label_key
  on public.injury_types (label) where organization_id is null;
create unique index injury_types_org_label_key
  on public.injury_types (organization_id, label) where organization_id is not null;

create table public.body_parts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete cascade,
  label text not null check (length(trim(label)) > 0),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index body_parts_system_label_key
  on public.body_parts (label) where organization_id is null;
create unique index body_parts_org_label_key
  on public.body_parts (organization_id, label) where organization_id is not null;


-- ---------------------------------------------------------------------------
-- Hierarchy of controls
-- ---------------------------------------------------------------------------

-- Stored as a lookup table carrying an explicit rank, not as an enum.
--
-- The spec originally described this field as an enum. An enum cannot carry the rank,
-- which would leave ordering dependent on either alphabetisation ("Administrative" first,
-- "Substitution" last -- exactly backwards) or on enum declaration order, which is a
-- fragile thing to hang a safety-maturity metric on. A lookup table makes rank a real,
-- queryable column: ORDER BY rank is correct in SQL, in the API and in every chart
-- without the application re-deriving it.
--
-- This is fixed reference data defined by the hierarchy of controls itself, so unlike
-- injury_types and body_parts it is NOT tenant-customisable and carries no
-- organization_id: it is readable by every authenticated user and writable by none.

create table public.hierarchy_of_control_levels (
  code text primary key,
  rank integer not null unique check (rank between 1 and 5),
  label text not null unique,
  description text not null,
  created_at timestamptz not null default now()
);

comment on table public.hierarchy_of_control_levels is
  'The five control levels with their rank. Rank 1 is most effective. Sort ascending by '
  'rank everywhere. Unclassified is the ABSENCE of a row here (a NULL reference), not a '
  'row with rank 0 -- see the corrective_actions comments.';

insert into public.hierarchy_of_control_levels (code, rank, label, description) values
  ('elimination',    1, 'Elimination',    'Remove the hazard entirely'),
  ('substitution',   2, 'Substitution',   'Replace with something less hazardous'),
  ('engineering',    3, 'Engineering',    'Isolate people from the hazard'),
  ('administrative', 4, 'Administrative', 'Change the way people work'),
  ('ppe',            5, 'PPE',            'Protect the worker with equipment');


-- ---------------------------------------------------------------------------
-- Seed values
-- ---------------------------------------------------------------------------

insert into public.injury_types (label, sort_order) values
  ('Strain', 10), ('Sprain', 20), ('Cut/Laceration', 30), ('Bruise/Contusion', 40),
  ('Puncture', 50), ('Burn', 60), ('Crushing', 70), ('Foreign Body', 80),
  ('Tendonitis', 90), ('Hearing Loss - STS', 100), ('Chemical', 110), ('Sting', 120),
  ('Hernia', 130), ('Fracture', 140), ('Dermatitis', 150), ('Respiratory', 160),
  ('Other', 999);

insert into public.body_parts (label, sort_order) values
  ('Hand', 10), ('Finger', 20), ('Arm', 30), ('Elbow', 40), ('Wrist', 50),
  ('Shoulder', 60), ('Back', 70), ('Neck', 80), ('Head', 90), ('Eye', 100),
  ('Face', 110), ('Torso', 120), ('Rib/Chest', 130), ('Groin', 140), ('Hip', 150),
  ('Leg', 160), ('Knee', 170), ('Ankle', 180), ('Foot', 190), ('Toe', 200),
  ('Multiple', 210), ('Other', 999);


-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

-- Bespoke rather than apply_tenant_guards(), because a NULL organization_id is
-- meaningful on these two tables and the standard guard treats NULL as an error.
alter table public.injury_types enable row level security;
alter table public.body_parts enable row level security;

create trigger injury_types_set_organization_id
  before insert on public.injury_types
  for each row execute function public.set_organization_id_allow_system();
create trigger injury_types_lock_organization_id
  before update on public.injury_types
  for each row execute function public.lock_organization_id();
create trigger injury_types_set_updated_at
  before update on public.injury_types
  for each row execute function public.set_updated_at();

create trigger body_parts_set_organization_id
  before insert on public.body_parts
  for each row execute function public.set_organization_id_allow_system();
create trigger body_parts_lock_organization_id
  before update on public.body_parts
  for each row execute function public.lock_organization_id();
create trigger body_parts_set_updated_at
  before update on public.body_parts
  for each row execute function public.set_updated_at();

-- Readable: system defaults plus your own additions. Writable: your own additions only,
-- so no tenant can edit or delete a shared default out from under the others.
create policy injury_types_select
  on public.injury_types for select to authenticated
  using (organization_id is null or organization_id = public.current_org_id());
create policy injury_types_insert
  on public.injury_types for insert to authenticated
  with check (organization_id = public.current_org_id() and public.can_write());
create policy injury_types_update
  on public.injury_types for update to authenticated
  using (organization_id = public.current_org_id() and public.can_write())
  with check (organization_id = public.current_org_id() and public.can_write());
create policy injury_types_delete
  on public.injury_types for delete to authenticated
  using (organization_id = public.current_org_id() and public.can_write());

create policy body_parts_select
  on public.body_parts for select to authenticated
  using (organization_id is null or organization_id = public.current_org_id());
create policy body_parts_insert
  on public.body_parts for insert to authenticated
  with check (organization_id = public.current_org_id() and public.can_write());
create policy body_parts_update
  on public.body_parts for update to authenticated
  using (organization_id = public.current_org_id() and public.can_write())
  with check (organization_id = public.current_org_id() and public.can_write());
create policy body_parts_delete
  on public.body_parts for delete to authenticated
  using (organization_id = public.current_org_id() and public.can_write());

-- Fixed standard: everyone reads, nobody writes (no insert/update/delete policy).
alter table public.hierarchy_of_control_levels enable row level security;

create policy hierarchy_of_control_levels_select
  on public.hierarchy_of_control_levels for select to authenticated
  using (true);

revoke all on public.injury_types from anon;
revoke all on public.body_parts from anon;
revoke all on public.hierarchy_of_control_levels from anon;
grant select, insert, update, delete on public.injury_types to authenticated;
grant select, insert, update, delete on public.body_parts to authenticated;
grant select on public.hierarchy_of_control_levels to authenticated;
