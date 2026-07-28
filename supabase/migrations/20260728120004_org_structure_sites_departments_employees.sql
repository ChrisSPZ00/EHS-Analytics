-- Organizational structure: sites -> departments -> employees.
--
-- An SMB may run a single site; the model supports several without change.
--
-- Note the composite foreign keys, e.g. departments (site_id, organization_id) ->
-- sites (id, organization_id). Foreign key checks are not subject to RLS, so a plain
-- FK on site_id alone would let a client attach their department to a site belonging to
-- another tenant -- invisible to them, but a real integrity break. Carrying
-- organization_id into the FK makes a cross-tenant reference structurally impossible.
-- Each table therefore also declares unique (id, organization_id) as the FK target.

create table public.sites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  address text,
  city text,
  state text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  unique (organization_id, name)
);

create index sites_organization_id_idx on public.sites (organization_id);

select public.apply_tenant_guards('public.sites');

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  site_id uuid not null,
  name text not null check (length(trim(name)) > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  unique (site_id, name),
  foreign key (site_id, organization_id)
    references public.sites (id, organization_id) on delete cascade
);

create index departments_organization_id_idx on public.departments (organization_id);
create index departments_site_id_idx on public.departments (site_id);

select public.apply_tenant_guards('public.departments');

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  site_id uuid not null,
  department_id uuid,
  -- The client's own identifier from their existing spreadsheet or HRIS. This is the
  -- join key for CSV import and the display value when anonymize_employees is on.
  employee_ref text,
  display_name text,
  hire_date date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (site_id, organization_id)
    references public.sites (id, organization_id) on delete cascade,
  foreign key (department_id, organization_id)
    references public.departments (id, organization_id) on delete set null
);

create unique index employees_org_employee_ref_key
  on public.employees (organization_id, employee_ref)
  where employee_ref is not null;

create index employees_organization_id_idx on public.employees (organization_id);
create index employees_site_id_idx on public.employees (site_id);
create index employees_department_id_idx on public.employees (department_id);

comment on column public.employees.display_name is
  'Optional. Suppressed in the UI when organizations.anonymize_employees is true.';
comment on column public.employees.employee_ref is
  'The client''s own employee identifier. Unique per organization when present.';

select public.apply_tenant_guards('public.employees');
