-- Compliance calendar: the recurrence engine and its reporting views.
--
-- The register (compliance_obligations) holds the standing requirement; the calendar
-- (compliance_events) holds the dated instances generated from it. This migration is the
-- generator, plus the two views the UI reads.
--
-- Two rules shape the whole thing:
--
--   1. A date is never invented. An obligation with no due_date and no recurrence anchor
--      generates nothing, and 'Ongoing' / 'Per event' frequencies generate nothing at
--      all -- they have no dated instances, and putting one on a calendar would be
--      asserting something the permit does not say.
--   2. Regeneration never destroys work. It removes only untouched future placeholders;
--      anything completed, annotated or moved off 'Not Started' survives an obligation
--      edit. The unique (obligation_id, due_date) constraint does the rest, which is what
--      makes re-running the generator idempotent.

-- ---------------------------------------------------------------------------
-- Recurrence primitives
-- ---------------------------------------------------------------------------

-- The step between instances. NULL for the frequencies that do not recur on a fixed
-- interval: 'One-time' (handled separately), 'Ongoing' and 'Per event' (no instances).
create or replace function public.compliance_recurrence_step(
  p_frequency public.obligation_frequency
)
returns interval
language sql
immutable
set search_path = ''
as $$
  select case p_frequency
    when 'Daily' then interval '1 day'
    when 'Weekly' then interval '1 week'
    when 'Monthly' then interval '1 month'
    when 'Quarterly' then interval '3 months'
    when 'Semi-annual' then interval '6 months'
    when 'Annual' then interval '1 year'
    when 'Biennial' then interval '2 years'
    when 'Every 4 years' then interval '4 years'
    when '5-year cycle' then interval '5 years'
    else null
  end;
$$;

comment on function public.compliance_recurrence_step(public.obligation_frequency) is
  'Interval between instances of a recurring obligation. NULL for One-time, Ongoing and '
  'Per event, none of which step on a fixed period.';

-- How far either side of today the generator materialises instances. Scaled to the
-- frequency so a daily inspection does not generate five years of rows and a five-year
-- permit renewal is not invisible until the year it falls due.
create or replace function public.compliance_generation_window(
  p_frequency public.obligation_frequency,
  out lookback interval,
  out horizon interval
)
language sql
immutable
set search_path = ''
as $$
  select
    case p_frequency
      when 'Daily' then interval '14 days'
      when 'Weekly' then interval '8 weeks'
      when 'Monthly' then interval '12 months'
      when 'Quarterly' then interval '12 months'
      when 'Semi-annual' then interval '24 months'
      when 'Annual' then interval '24 months'
      when 'Biennial' then interval '48 months'
      when 'Every 4 years' then interval '96 months'
      when '5-year cycle' then interval '120 months'
      else interval '0 days'
    end,
    case p_frequency
      when 'Daily' then interval '45 days'
      when 'Weekly' then interval '26 weeks'
      when 'Monthly' then interval '12 months'
      when 'Quarterly' then interval '24 months'
      when 'Semi-annual' then interval '24 months'
      when 'Annual' then interval '36 months'
      when 'Biennial' then interval '60 months'
      when 'Every 4 years' then interval '120 months'
      when '5-year cycle' then interval '120 months'
      else interval '0 days'
    end;
$$;

comment on function public.compliance_generation_window(public.obligation_frequency) is
  'How far back and forward the generator materialises instances, scaled to the '
  'frequency. The lookback exists so an instance that is already overdue appears on the '
  'calendar rather than only future ones.';

-- A day-of-month that cannot fall off the end of a short month: 31 in February clamps to
-- the 28th (or 29th) rather than raising.
create or replace function public.compliance_month_day(
  p_year integer,
  p_month integer,
  p_day integer
)
returns date
language sql
immutable
set search_path = ''
as $$
  select least(
    make_date(p_year, p_month, 1) + (greatest(p_day, 1) - 1),
    (make_date(p_year, p_month, 1) + interval '1 month' - interval '1 day')::date
  );
$$;

comment on function public.compliance_month_day(integer, integer, integer) is
  'Day-of-month clamped to the length of the month, so a "31st" recurrence lands on the '
  '28th in February instead of raising.';

-- The lattice origin. due_date wins when present; otherwise the recurrence_month /
-- recurrence_day pair is read against the current year. When neither is available the
-- answer is NULL, and the caller generates nothing -- a guessed date on a compliance
-- calendar is worse than a visible gap.
create or replace function public.compliance_anchor_date(
  p_due_date date,
  p_frequency public.obligation_frequency,
  p_recurrence_month integer,
  p_recurrence_day integer,
  p_as_of date default current_date
)
returns date
language sql
immutable
set search_path = ''
as $$
  select case
    when p_due_date is not null then p_due_date
    when p_recurrence_month is not null and p_recurrence_day is not null then
      public.compliance_month_day(
        extract(year from p_as_of)::integer, p_recurrence_month, p_recurrence_day)
    -- A day without a month anchors within the current month, which is the only reading
    -- that makes sense for a monthly, weekly or daily obligation.
    when p_recurrence_day is not null then
      public.compliance_month_day(
        extract(year from p_as_of)::integer, extract(month from p_as_of)::integer, p_recurrence_day)
    else null
  end;
$$;

comment on function public.compliance_anchor_date(date, public.obligation_frequency, integer, integer, date) is
  'Origin of the recurrence lattice. NULL when the obligation carries neither a due date '
  'nor a recurrence anchor -- the generator then produces nothing rather than guessing.';


-- ---------------------------------------------------------------------------
-- Due state
-- ---------------------------------------------------------------------------
--
-- Four states, derived from dates alone. Deliberately NOT folded in here:
--
--   * obligations.is_verified -- whether a human has checked this against the permit
--     text. That is a separate warning badge; an unverified obligation is not "less
--     overdue".
--   * the 'N/A - Verify' status -- "we believe this does not apply, but nobody has
--     confirmed it". Reading that as compliant would hide exactly the row that most
--     needs looking at.

create or replace function public.compliance_event_state(
  p_due_date date,
  p_completed_date date,
  p_lead_time_days integer,
  p_as_of date default current_date
)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_completed_date is not null then 'Complete'
    when p_due_date < p_as_of then 'Overdue'
    when p_due_date <= p_as_of + coalesce(p_lead_time_days, 30) then 'Due soon'
    else 'Upcoming'
  end;
$$;

comment on function public.compliance_event_state(date, date, integer, date) is
  'Overdue / Due soon / Upcoming / Complete, from the due date, the completion date and '
  'the obligation''s own lead time. Verification status is deliberately not folded in.';

create or replace function public.compliance_state_rank(p_state text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_state
    when 'Overdue' then 1
    when 'Due soon' then 2
    when 'Upcoming' then 3
    when 'Complete' then 4
    else 5
  end;
$$;

comment on function public.compliance_state_rank(text) is
  'Sort key for the due state: what is late first, what is done last.';


-- ---------------------------------------------------------------------------
-- The generator
-- ---------------------------------------------------------------------------

-- SECURITY INVOKER (the default): it runs with the caller's own privileges, so RLS
-- decides which obligations are visible and the compliance_events triggers stamp
-- organization_id. There is no path here that reaches another tenant's rows.
create or replace function public.generate_compliance_events(
  p_obligation_id uuid,
  p_as_of date default current_date
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_ob public.compliance_obligations;
  v_step interval;
  v_anchor date;
  v_lookback interval;
  v_horizon interval;
  v_window_start date;
  v_window_end date;
  v_date date;
  v_n integer := 0;
  v_rows integer := 0;
  v_created integer := 0;
  v_guard integer := 0;
begin
  select * into v_ob
  from public.compliance_obligations
  where id = p_obligation_id;

  -- Not found covers both "no such obligation" and "another tenant's obligation": under
  -- RLS those are the same answer, which is the point.
  if not found then
    return 0;
  end if;

  -- No dated instances exist for these two, by definition.
  if v_ob.frequency in ('Ongoing', 'Per event') then
    return 0;
  end if;

  v_anchor := public.compliance_anchor_date(
    v_ob.due_date, v_ob.frequency, v_ob.recurrence_month, v_ob.recurrence_day, p_as_of);

  if v_anchor is null then
    return 0;
  end if;

  -- A one-time obligation is its due date and nothing else, however far out it sits.
  if v_ob.frequency = 'One-time' then
    insert into public.compliance_events (organization_id, obligation_id, due_date, status)
    values (v_ob.organization_id, v_ob.id, v_anchor, 'Not Started')
    on conflict (obligation_id, due_date) do nothing;
    get diagnostics v_created = row_count;
    return v_created;
  end if;

  v_step := public.compliance_recurrence_step(v_ob.frequency);
  if v_step is null then
    return 0;
  end if;

  select w.lookback, w.horizon into v_lookback, v_horizon
  from public.compliance_generation_window(v_ob.frequency) w;

  v_window_start := greatest(v_anchor, (p_as_of - v_lookback)::date);
  v_window_end := (p_as_of + v_horizon)::date;

  -- Instances sit on the lattice anchor + n × step, computed from the anchor every time
  -- rather than stepped from the previous instance. Postgres clamps 31 January + 1 month
  -- to 28 February, and stepping on from the clamped date would walk a monthly
  -- obligation off its own day of the month for good.
  --
  -- The first jump is an estimate -- the epoch of a month interval is a 30-day
  -- approximation -- so it is corrected in both directions afterwards.
  v_n := greatest(
    0,
    floor((v_window_start - v_anchor)::numeric * 86400 / extract(epoch from v_step))::integer
  );
  while v_n > 0 and (v_anchor + ((v_n - 1) * v_step))::date >= v_window_start loop
    v_n := v_n - 1;
  end loop;
  while (v_anchor + (v_n * v_step))::date < v_window_start loop
    v_n := v_n + 1;
  end loop;

  loop
    v_date := (v_anchor + (v_n * v_step))::date;
    exit when v_date > v_window_end;

    insert into public.compliance_events (organization_id, obligation_id, due_date, status)
    values (v_ob.organization_id, v_ob.id, v_date, 'Not Started')
    on conflict (obligation_id, due_date) do nothing;
    get diagnostics v_rows = row_count;
    v_created := v_created + v_rows;

    v_n := v_n + 1;
    v_guard := v_guard + 1;
    -- Structural stop. The windows above cap the real cases far below this; reaching it
    -- means the arithmetic is wrong, and looping forever would be the worse failure.
    exit when v_guard > 1000;
  end loop;

  return v_created;
end;
$$;

comment on function public.generate_compliance_events(uuid, date) is
  'Materialises the dated instances of one obligation across its generation window. '
  'Idempotent: ON CONFLICT (obligation_id, due_date) DO NOTHING means re-running it '
  'cannot duplicate an existing event or disturb a completed one. Returns the number of '
  'events created.';

-- Called after an obligation's schedule changes. Clears out the future instances that
-- nobody has touched, then regenerates from the new schedule.
--
-- "Untouched" is strict: still 'Not Started', no completion date, no completed_by, no
-- evidence notes. An event someone has started, annotated or closed is a record of work
-- done and survives the edit, even if its date is no longer on the lattice.
create or replace function public.regenerate_compliance_events(
  p_obligation_id uuid,
  p_as_of date default current_date
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_created integer;
begin
  delete from public.compliance_events ce
  where ce.obligation_id = p_obligation_id
    and ce.due_date > p_as_of
    and ce.completed_date is null
    and ce.completed_by is null
    and ce.evidence_notes is null
    and ce.status = 'Not Started';

  v_created := public.generate_compliance_events(p_obligation_id, p_as_of);
  return v_created;
end;
$$;

comment on function public.regenerate_compliance_events(uuid, date) is
  'Rebuilds the future instances of an obligation after its schedule changes. Removes '
  'only untouched future placeholders; completed and annotated history survives.';

-- Rolls the whole calendar forward. The generation window is relative to today, so a
-- calendar left alone eventually runs out of future instances; this tops it back up for
-- every obligation the caller can see.
create or replace function public.refresh_compliance_calendar(
  p_as_of date default current_date
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
  v_created integer := 0;
begin
  for v_id in select id from public.compliance_obligations loop
    v_created := v_created + public.generate_compliance_events(v_id, p_as_of);
  end loop;
  return v_created;
end;
$$;

comment on function public.refresh_compliance_calendar(date) is
  'Tops up the calendar for every obligation visible to the caller. RLS scopes the loop, '
  'so it can only ever extend the caller''s own organisation.';

revoke all on function public.generate_compliance_events(uuid, date) from public, anon;
revoke all on function public.regenerate_compliance_events(uuid, date) from public, anon;
revoke all on function public.refresh_compliance_calendar(date) from public, anon;
grant execute on function public.generate_compliance_events(uuid, date) to authenticated;
grant execute on function public.regenerate_compliance_events(uuid, date) to authenticated;
grant execute on function public.refresh_compliance_calendar(date) to authenticated;


-- ---------------------------------------------------------------------------
-- Keeping the calendar in step with the register
-- ---------------------------------------------------------------------------

create or replace function public.compliance_obligation_sync_events()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.generate_compliance_events(new.id);
  else
    perform public.regenerate_compliance_events(new.id);
  end if;
  return null;
end;
$$;

comment on function public.compliance_obligation_sync_events() is
  'AFTER INSERT/UPDATE on compliance_obligations: keeps the calendar in step with the '
  'register without the application having to remember to ask.';

create trigger compliance_obligations_generate_events
  after insert on public.compliance_obligations
  for each row execute function public.compliance_obligation_sync_events();

-- Only the fields that move dates trigger a rebuild. Editing a note or a responsible
-- party must not churn the calendar.
create trigger compliance_obligations_regenerate_events
  after update on public.compliance_obligations
  for each row
  when (
    old.due_date is distinct from new.due_date
    or old.frequency is distinct from new.frequency
    or old.recurrence_month is distinct from new.recurrence_month
    or old.recurrence_day is distinct from new.recurrence_day
  )
  execute function public.compliance_obligation_sync_events();

revoke all on function public.compliance_obligation_sync_events() from public, anon, authenticated;


-- ---------------------------------------------------------------------------
-- A completed event needs a completion date
-- ---------------------------------------------------------------------------
-- The same rule corrective_actions carries: "Compliant" with no date recorded is not an
-- audit trail, it is an assertion.

alter table public.compliance_events
  add constraint compliance_events_completed_requires_date
  check (status <> 'Compliant' or completed_date is not null);


-- ---------------------------------------------------------------------------
-- Views
-- ---------------------------------------------------------------------------
-- Both created WITH (security_invoker = on). A view without it runs as its owner and
-- serves every tenant's rows to every caller.

create view public.compliance_events_enriched
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
  (ce.due_date - current_date) as days_until_due

from public.compliance_events ce
  join public.compliance_obligations o on o.id = ce.obligation_id
  left join public.sites s on s.id = o.site_id;

comment on view public.compliance_events_enriched is
  'Calendar instances joined to their obligation, carrying the derived due state and the '
  'signed day count to the due date. security_invoker = on.';

create view public.compliance_obligations_enriched
with (security_invoker = on) as
select
  o.*,
  s.name as site_name,

  -- False for Ongoing and Per event: real obligations that simply have no dated
  -- instances. The register shows them; the calendar cannot, and says so.
  (o.frequency not in ('Ongoing', 'Per event')) as is_scheduled,

  n.next_due_date,
  n.next_event_id,
  case
    when n.next_due_date is null then null
    else public.compliance_event_state(n.next_due_date, null, o.lead_time_days, current_date)
  end as next_state,

  agg.open_events,
  agg.overdue_events,
  agg.completed_events,
  agg.last_completed_date

from public.compliance_obligations o
  left join public.sites s on s.id = o.site_id
  left join lateral (
    select ce.id as next_event_id, ce.due_date as next_due_date
    from public.compliance_events ce
    where ce.obligation_id = o.id
      and ce.completed_date is null
    order by ce.due_date
    limit 1
  ) n on true
  left join lateral (
    select
      count(*) filter (where ce.completed_date is null) as open_events,
      count(*) filter (where ce.completed_date is null and ce.due_date < current_date)
        as overdue_events,
      count(*) filter (where ce.completed_date is not null) as completed_events,
      max(ce.completed_date) as last_completed_date
    from public.compliance_events ce
    where ce.obligation_id = o.id
  ) agg on true;

comment on view public.compliance_obligations_enriched is
  'The obligation register with its next open instance, its open/overdue counts and the '
  'date it was last satisfied. security_invoker = on.';

revoke all on public.compliance_events_enriched from anon;
revoke all on public.compliance_obligations_enriched from anon;

grant select on public.compliance_events_enriched to authenticated;
grant select on public.compliance_obligations_enriched to authenticated;
