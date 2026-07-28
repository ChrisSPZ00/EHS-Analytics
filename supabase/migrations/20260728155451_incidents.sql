-- The core incident record.
--
-- tenure_days is deliberately NOT stored. It is incident_date minus the employee's
-- hire_date, which is derivable at query time and would otherwise go stale the moment
-- either date is corrected. A generated column cannot reference another table, so it is
-- exposed by the incidents_enriched view instead (see the reporting views migration).

create table public.incidents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  site_id uuid not null,
  department_id uuid,
  employee_id uuid,

  incident_date date not null,
  reported_date date,

  claim_ref text,

  incident_type public.incident_type not null,
  classification public.incident_classification,
  shift public.shift_type,

  injury_type text,
  body_part text,

  root_cause_category public.root_cause_category,
  root_cause_detail text,

  machine_involved boolean not null default false,
  safety_violation boolean not null default false,
  recently_transferred boolean not null default false,
  is_lost_time boolean not null default false,

  days_away integer not null default 0 check (days_away >= 0),
  days_restricted integer not null default 0 check (days_restricted >= 0),

  severity_rating public.severity_rating,

  expected_cost numeric(12, 2) check (expected_cost is null or expected_cost >= 0),
  actual_cost_to_date numeric(12, 2) check (actual_cost_to_date is null or actual_cost_to_date >= 0),

  description text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (id, organization_id),

  -- An incident cannot be reported before it happened.
  constraint incidents_reported_after_occurred
    check (reported_date is null or reported_date >= incident_date),

  foreign key (site_id, organization_id)
    references public.sites (id, organization_id) on delete cascade,
  foreign key (department_id, organization_id)
    references public.departments (id, organization_id) on delete set null,
  foreign key (employee_id, organization_id)
    references public.employees (id, organization_id) on delete set null
);

comment on column public.incidents.employee_id is
  'Nullable: near misses, hazards and property damage often have no injured person.';
comment on column public.incidents.injury_type is
  'Free text backed by the injury_types lookup. Text rather than an enum so an import '
  'carrying an unrecognised value still lands instead of being rejected.';

-- Every dashboard query filters by org and slices by date, so lead with that pair.
create index incidents_org_date_idx
  on public.incidents (organization_id, incident_date desc);
create index incidents_site_date_idx
  on public.incidents (organization_id, site_id, incident_date desc);
create index incidents_department_idx on public.incidents (department_id);
create index incidents_employee_idx on public.incidents (employee_id);
create index incidents_type_idx on public.incidents (organization_id, incident_type);
create index incidents_classification_idx
  on public.incidents (organization_id, classification);
create index incidents_injury_type_idx on public.incidents (organization_id, injury_type);
create index incidents_body_part_idx on public.incidents (organization_id, body_part);
create index incidents_root_cause_idx
  on public.incidents (organization_id, root_cause_category);

-- Duplicate detection for CSV import keys on incident_date + employee + injury_type.
create index incidents_dedupe_idx
  on public.incidents (organization_id, incident_date, employee_id, injury_type);

select public.apply_tenant_guards('public.incidents');
