-- Compliance calendar: the standing obligation register, and the dated instances
-- generated from it.
--
-- site_id is nullable on obligations because plenty of obligations are organization-wide
-- (an EPCRA Tier II filing, say) rather than tied to one location.

create table public.compliance_obligations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  site_id uuid,

  jurisdiction public.jurisdiction not null,
  program_area text,
  permit_ref text,
  citation text,
  agency text,

  obligation text not null check (length(trim(obligation)) > 0),

  frequency public.obligation_frequency not null,
  due_date date,
  recurrence_month integer check (recurrence_month between 1 and 12),
  recurrence_day integer check (recurrence_day between 1 and 31),

  responsible_party text,
  status public.obligation_status not null default 'Not Started',
  notes text,

  -- A calendar built from memory rather than from the permit text is a liability.
  -- Unverified rows carry a visible badge in the UI and must look different from
  -- verified ones.
  is_verified boolean not null default false,

  -- Days before due_date at which an event enters the "due soon" state.
  lead_time_days integer not null default 30 check (lead_time_days >= 0),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (id, organization_id),

  foreign key (site_id, organization_id)
    references public.sites (id, organization_id) on delete cascade
);

comment on column public.compliance_obligations.is_verified is
  'False until a human has confirmed this obligation against the source permit or rule '
  'text. Unverified rows render with a warning badge.';
comment on column public.compliance_obligations.lead_time_days is
  'Per-obligation lead time, default 30. Drives the "due soon" state, which is distinct '
  'from overdue.';
comment on column public.compliance_obligations.site_id is
  'Nullable: many obligations are organization-wide rather than site-specific.';

create index compliance_obligations_org_idx
  on public.compliance_obligations (organization_id);
create index compliance_obligations_site_idx
  on public.compliance_obligations (site_id);
-- The register groups by jurisdiction then program area, which is how EHS managers
-- actually hold their obligations in their heads.
create index compliance_obligations_grouping_idx
  on public.compliance_obligations (organization_id, jurisdiction, program_area);
create index compliance_obligations_status_idx
  on public.compliance_obligations (organization_id, status);

select public.apply_tenant_guards('public.compliance_obligations');

-- The generated instances. The recurrence engine (Phase 4) regenerates future events on
-- obligation edit; completed events are preserved, which is what completed_date and
-- evidence_notes being on the event rather than the obligation buys us -- the register
-- doubles as an audit trail.
create table public.compliance_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  obligation_id uuid not null,

  due_date date not null,
  status public.obligation_status not null default 'Not Started',
  completed_date date,
  completed_by text,
  evidence_notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (id, organization_id),
  -- One event per obligation per due date, so regeneration is idempotent.
  unique (obligation_id, due_date),

  foreign key (obligation_id, organization_id)
    references public.compliance_obligations (id, organization_id) on delete cascade
);

create index compliance_events_org_due_idx
  on public.compliance_events (organization_id, due_date);
create index compliance_events_obligation_idx
  on public.compliance_events (obligation_id);
create index compliance_events_status_idx
  on public.compliance_events (organization_id, status);

comment on constraint compliance_events_obligation_id_due_date_key
  on public.compliance_events is
  'Makes recurrence regeneration idempotent: re-running the generator cannot duplicate '
  'an existing event, so completed history survives an obligation edit.';

select public.apply_tenant_guards('public.compliance_events');
