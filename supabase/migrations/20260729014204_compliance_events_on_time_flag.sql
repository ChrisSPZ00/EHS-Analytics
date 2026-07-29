-- Adds completed_on_time to compliance_events_enriched.
--
-- "On time" is a definition, not an ad-hoc comparison, so it belongs in the view beside
-- the due state rather than being re-derived by each caller. The same reasoning put
-- is_dart_case and is_engineering_or_above in the incident views.
--
-- NULL -- not false -- for an entry that has not been completed. An open entry has no
-- on-time answer yet, and counting it as a miss would make the rate fall every time a new
-- instance is generated. It leaves the denominator instead.

create or replace view public.compliance_events_enriched
with (security_invoker = on) as
select
  ce.*,

  o.obligation,
  o.jurisdiction,
  o.program_area,
  o.permit_ref,
  o.citation,
  o.agency,
  o.frequency,
  o.responsible_party,
  o.is_verified,
  o.lead_time_days,
  o.site_id,
  s.name as site_name,

  public.compliance_event_state(ce.due_date, ce.completed_date, o.lead_time_days, current_date)
    as state,
  public.compliance_state_rank(
    public.compliance_event_state(ce.due_date, ce.completed_date, o.lead_time_days, current_date)
  ) as state_rank,

  -- Negative when the date has passed. Rendered as "N days overdue" rather than as a
  -- minus sign in front of a number.
  (ce.due_date - current_date) as days_until_due,

  case
    when ce.completed_date is null then null
    else ce.completed_date <= ce.due_date
  end as completed_on_time

from public.compliance_events ce
  join public.compliance_obligations o on o.id = ce.obligation_id
  left join public.sites s on s.id = o.site_id;

comment on view public.compliance_events_enriched is
  'Calendar instances joined to their obligation, carrying the derived due state, the '
  'signed day count to the due date and whether the completion beat the deadline. '
  'completed_on_time is NULL for entries that are not yet complete, so they leave the '
  'on-time denominator rather than counting as a miss. security_invoker = on.';
