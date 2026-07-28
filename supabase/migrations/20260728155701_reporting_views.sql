-- Reporting views.
--
-- Every view here is created WITH (security_invoker = on). This is not optional: a
-- Postgres view runs with its OWNER's privileges by default, and the owner is the
-- migration role, which bypasses RLS. A view created without security_invoker would
-- serve every tenant's rows to every caller -- a complete bypass of the isolation the
-- rest of this schema exists to enforce. Any view added later must set it too.

-- ---------------------------------------------------------------------------
-- incidents_enriched
-- ---------------------------------------------------------------------------
-- Resolves tenure_days (deliberately not stored), the tenure bucket used by the
-- tenure-at-incident histogram, and the display name honouring anonymize_employees.

create view public.incidents_enriched
with (security_invoker = on) as
select
  i.*,
  s.name as site_name,
  d.name as department_name,
  e.employee_ref,
  case
    when e.id is null then null
    when o.anonymize_employees then e.employee_ref
    else coalesce(e.display_name, e.employee_ref)
  end as employee_display,
  e.hire_date,

  -- Derived, never stored: recomputes correctly when either date is corrected.
  case
    when e.hire_date is null then null
    else (i.incident_date - e.hire_date)
  end as tenure_days,

  case
    when e.hire_date is null then null
    when (i.incident_date - e.hire_date) < 0 then null
    when (i.incident_date - e.hire_date) <= 30 then '0-30 days'
    when (i.incident_date - e.hire_date) <= 90 then '31-90 days'
    when (i.incident_date - e.hire_date) <= 180 then '91-180 days'
    when (i.incident_date - e.hire_date) <= 365 then '181-365 days'
    when (i.incident_date - e.hire_date) <= 1095 then '1-3 yr'
    when (i.incident_date - e.hire_date) <= 1825 then '3-5 yr'
    else '5+ yr'
  end as tenure_bucket,

  case
    when e.hire_date is null then null
    when (i.incident_date - e.hire_date) < 0 then null
    when (i.incident_date - e.hire_date) <= 30 then 1
    when (i.incident_date - e.hire_date) <= 90 then 2
    when (i.incident_date - e.hire_date) <= 180 then 3
    when (i.incident_date - e.hire_date) <= 365 then 4
    when (i.incident_date - e.hire_date) <= 1095 then 5
    when (i.incident_date - e.hire_date) <= 1825 then 6
    else 7
  end as tenure_bucket_rank,

  -- DART: a case counts if it carried days away OR restricted days.
  (i.days_away > 0 or i.days_restricted > 0) as is_dart_case,
  (i.incident_type = 'OSHA Recordable') as is_recordable

from public.incidents i
  join public.organizations o on o.id = i.organization_id
  join public.sites s on s.id = i.site_id
  left join public.departments d on d.id = i.department_id
  left join public.employees e on e.id = i.employee_id;

comment on view public.incidents_enriched is
  'Incidents with derived tenure_days, tenure bucket and privacy-aware employee display. '
  'security_invoker = on, so the caller''s RLS policies apply.';


-- ---------------------------------------------------------------------------
-- corrective_actions_enriched
-- ---------------------------------------------------------------------------
-- Carries the hierarchy-of-controls rank, label and colour token so that no caller has
-- to re-derive ordering or re-map NULL to "Unclassified".

create view public.corrective_actions_enriched
with (security_invoker = on) as
select
  ca.*,
  i.incident_date,
  i.site_id,
  i.department_id,
  s.name as site_name,
  d.name as department_name,

  h.rank as hoc_rank,
  coalesce(h.label, 'Unclassified') as hoc_label,
  h.description as hoc_description,

  -- Sort key: rank ascending, with unclassified forced last rather than first.
  coalesce(h.rank, 999) as hoc_sort_rank,

  -- Colour token index, matching the --hoc-N-bg / --hoc-N-fg CSS variables.
  -- Unclassified is token 0, which sits OUTSIDE the green ramp in neutral grey -- it is
  -- not a position on the ladder and must never be rendered as one.
  coalesce(h.rank, 0) as hoc_token,

  (ca.hierarchy_of_controls is null) as needs_classification,

  -- Rank 1-3 (Elimination, Substitution, Engineering) are the "designed out" controls.
  -- NULL here, not false, for unclassified rows: they are excluded from the maturity
  -- KPI's denominator rather than counted as a miss.
  case
    when h.rank is null then null
    else h.rank <= 3
  end as is_engineering_or_above

from public.corrective_actions ca
  join public.incidents i on i.id = ca.incident_id
  join public.sites s on s.id = i.site_id
  left join public.departments d on d.id = i.department_id
  left join public.hierarchy_of_control_levels h on h.code = ca.hierarchy_of_controls;

comment on view public.corrective_actions_enriched is
  'Corrective actions joined to their incident and control level. hoc_sort_rank orders '
  'ascending by rank with Unclassified last; hoc_token maps to the --hoc-N colour '
  'variables, 0 being the neutral grey used for Unclassified.';


-- ---------------------------------------------------------------------------
-- corrective_actions_needing_classification
-- ---------------------------------------------------------------------------
-- Backs the needs-classification queue and its dashboard prompt count.

create view public.corrective_actions_needing_classification
with (security_invoker = on) as
select *
from public.corrective_actions_enriched
where hierarchy_of_controls is null;

comment on view public.corrective_actions_needing_classification is
  'Corrective actions with no control level assigned. The queue sorts these by '
  'incident_date descending and supports inline assignment.';

revoke all on public.incidents_enriched from anon;
revoke all on public.corrective_actions_enriched from anon;
revoke all on public.corrective_actions_needing_classification from anon;

grant select on public.incidents_enriched to authenticated;
grant select on public.corrective_actions_enriched to authenticated;
grant select on public.corrective_actions_needing_classification to authenticated;
