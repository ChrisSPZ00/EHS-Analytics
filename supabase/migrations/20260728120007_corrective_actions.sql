-- Corrective actions.
--
-- hierarchy_of_controls is the differentiator here -- most SMB trackers don't capture it,
-- and it is what makes a corrective action auditable rather than just closed.
--
-- It is NULLABLE by design and nothing in the database requires it: no NOT NULL, no check
-- constraint, no trigger. Classification is something a client fills in over time, so it
-- must never block a save or an import. NULL means "not classified yet" and is a
-- first-class state, distinct from any control level -- it is never to be folded into a
-- level, defaulted to one, or guessed at on import.
--
-- The reference is to hierarchy_of_control_levels(code) rather than to an enum so that
-- rank travels with the value; see that table's comments.

-- Needed as the target of the composite assigned_to_profile_id FK below, which carries
-- organization_id so an action cannot be assigned to a user in another tenant.
alter table public.profiles add constraint profiles_id_organization_id_key
  unique (id, organization_id);

create table public.corrective_actions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  incident_id uuid not null,

  description text not null check (length(trim(description)) > 0),

  -- Assignment is either an app user or a free-text name, since the person accountable
  -- for a fix on the floor frequently has no login.
  assigned_to_profile_id uuid,
  assigned_to_name text,

  due_date date,
  status public.corrective_action_status not null default 'Not Started',
  completed_date date,

  hierarchy_of_controls text
    references public.hierarchy_of_control_levels (code) on update cascade on delete restrict,

  verification_notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (id, organization_id),

  foreign key (incident_id, organization_id)
    references public.incidents (id, organization_id) on delete cascade,
  foreign key (assigned_to_profile_id, organization_id)
    references public.profiles (id, organization_id) on delete set null,

  constraint corrective_actions_completed_requires_date
    check (status <> 'Complete' or completed_date is not null)
);

comment on column public.corrective_actions.hierarchy_of_controls is
  'Nullable by design -- NULL means "not classified yet" and never blocks a save or an '
  'import. References hierarchy_of_control_levels(code); ORDER BY the joined rank column, '
  'never by this text value.';

create index corrective_actions_org_idx on public.corrective_actions (organization_id);
create index corrective_actions_incident_idx on public.corrective_actions (incident_id);
create index corrective_actions_status_idx
  on public.corrective_actions (organization_id, status);
create index corrective_actions_due_date_idx
  on public.corrective_actions (organization_id, due_date);
create index corrective_actions_hoc_idx
  on public.corrective_actions (organization_id, hierarchy_of_controls);

-- Powers the needs-classification queue, which is the one view that reads only the
-- unclassified rows.
create index corrective_actions_unclassified_idx
  on public.corrective_actions (organization_id)
  where hierarchy_of_controls is null;

select public.apply_tenant_guards('public.corrective_actions');
