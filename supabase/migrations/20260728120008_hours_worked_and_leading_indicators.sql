-- Rate denominators and leading indicators, both stored per site per month.
--
-- hours_worked is the denominator of TRIR, DART, LTIFR and Severity Rate. When a period
-- has no row here the dashboard must render those cards as "--" with "Hours not entered
-- for this period" -- never zero, never an estimate. The absence of a row is the signal,
-- which is why there is no default and no backfill.

create table public.hours_worked (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  site_id uuid not null,
  period_year integer not null check (period_year between 1900 and 2200),
  period_month integer not null check (period_month between 1 and 12),
  hours numeric(12, 2) not null check (hours >= 0),
  -- Surfaced in the UI so a rate built on an estimated denominator is visibly flagged.
  is_estimate boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (site_id, period_year, period_month),

  foreign key (site_id, organization_id)
    references public.sites (id, organization_id) on delete cascade
);

create index hours_worked_org_period_idx
  on public.hours_worked (organization_id, period_year, period_month);

comment on column public.hours_worked.is_estimate is
  'Marks a denominator the client estimated rather than pulled from payroll. Shown in the UI.';

select public.apply_tenant_guards('public.hours_worked');

create table public.leading_indicators (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  site_id uuid not null,
  period_year integer not null check (period_year between 1900 and 2200),
  period_month integer not null check (period_month between 1 and 12),
  inspections_completed integer not null default 0 check (inspections_completed >= 0),
  hazards_reported integer not null default 0 check (hazards_reported >= 0),
  gemba_walks integer not null default 0 check (gemba_walks >= 0),
  safety_meetings integer not null default 0 check (safety_meetings >= 0),
  trainings_delivered integer not null default 0 check (trainings_delivered >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (site_id, period_year, period_month),

  foreign key (site_id, organization_id)
    references public.sites (id, organization_id) on delete cascade
);

create index leading_indicators_org_period_idx
  on public.leading_indicators (organization_id, period_year, period_month);

select public.apply_tenant_guards('public.leading_indicators');
