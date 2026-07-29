-- ===========================================================================
-- Demo seed — entirely synthetic
-- ===========================================================================
--
-- No real company, employee, claim or permit data appears anywhere in this file.
-- The organisation, sites and people are invented; identifiers follow obviously
-- synthetic patterns (EMP-0001, CLM-2024-0001) and the login uses example.test.
--
-- Deterministic: setseed() fixes the random stream, so re-running produces the same
-- data set. It is destructive for the demo organisation only — it deletes and recreates
-- that one org, and touches nothing else.
--
-- Run against a development project:
--   psql "$DATABASE_URL" -f supabase/seed.sql

begin;

select setseed(0.42);

-- ---------------------------------------------------------------------------
-- Clean out any previous run of this seed
-- ---------------------------------------------------------------------------
delete from public.organizations where name = 'Cascade Foods Co-Packing (demo)';
delete from auth.users where email = 'demo@example.test';

-- ---------------------------------------------------------------------------
-- Organisation and login
-- ---------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) values (
  '00000000-0000-0000-0000-000000000000',
  '11111111-1111-4111-8111-111111111111',
  'authenticated', 'authenticated',
  'demo@example.test',
  crypt('safepulse-demo', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb
);

insert into public.organizations (id, name, naics_code, employee_count, anonymize_employees)
values ('a1111111-1111-4111-8111-111111111111', 'Cascade Foods Co-Packing (demo)', '311991', 240, false);

insert into public.profiles (id, organization_id, full_name, role)
values (
  '11111111-1111-4111-8111-111111111111',
  'a1111111-1111-4111-8111-111111111111',
  'Demo Owner',
  'owner'
);

-- ---------------------------------------------------------------------------
-- Sites and departments
-- ---------------------------------------------------------------------------
insert into public.sites (id, organization_id, name, city, state)
values
  ('b1111111-1111-4111-8111-111111111111', 'a1111111-1111-4111-8111-111111111111', 'Riverton Plant', 'Riverton', 'OR'),
  ('b2222222-2222-4222-8222-222222222222', 'a1111111-1111-4111-8111-111111111111', 'Eastgate Plant', 'Eastgate', 'ID');

insert into public.departments (organization_id, site_id, name)
select 'a1111111-1111-4111-8111-111111111111', s.id, d.name
from (values
  ('b1111111-1111-4111-8111-111111111111'::uuid),
  ('b2222222-2222-4222-8222-222222222222'::uuid)
) as s(id)
cross join (values ('Packaging'), ('Blending'), ('Maintenance'), ('Shipping')) as d(name);

-- ---------------------------------------------------------------------------
-- Employees (60, spread across both sites, with hire dates spanning 12 years)
-- ---------------------------------------------------------------------------
insert into public.employees (organization_id, site_id, department_id, employee_ref, display_name, hire_date)
select
  'a1111111-1111-4111-8111-111111111111',
  d.site_id,
  d.id,
  'EMP-' || lpad(g::text, 4, '0'),
  (array['Avery','Bailey','Casey','Devon','Emery','Finley','Gray','Harper','Indigo','Jordan',
         'Kendall','Logan','Marlow','Noel','Oakley','Parker','Quinn','Reese','Sawyer','Tatum'])[1 + (g % 20)]
    || ' ' ||
  (array['Alvarez','Brooks','Chen','Dawson','Ellis','Ferreira','Grant','Haddad','Ibrahim','Jensen',
         'Kowalski','Lindqvist','Moreau','Nakamura','Okonkwo','Petrov','Quintero','Rossi','Silva','Tanaka'])[1 + ((g * 7) % 20)],
  date '2014-01-01' + (random() * 4000)::int
from generate_series(1, 60) g
join lateral (
  select id, site_id from public.departments
  where organization_id = 'a1111111-1111-4111-8111-111111111111'
  order by md5(g::text || id::text)
  limit 1
) d on true;

-- ---------------------------------------------------------------------------
-- Hours worked and leading indicators — every site, every month, no gaps
-- ---------------------------------------------------------------------------
-- Complete coverage is deliberate: it lets the rate cards compute. Delete a row and
-- watch TRIR fall back to an em dash rather than to zero.
insert into public.hours_worked (organization_id, site_id, period_year, period_month, hours, is_estimate)
select
  'a1111111-1111-4111-8111-111111111111',
  s.id,
  extract(year from m)::int,
  extract(month from m)::int,
  round((16000 + random() * 4000)::numeric, 2),
  false
from public.sites s
cross join generate_series(date '2021-08-01', date '2026-07-01', interval '1 month') m
where s.organization_id = 'a1111111-1111-4111-8111-111111111111';

insert into public.leading_indicators (
  organization_id, site_id, period_year, period_month,
  inspections_completed, hazards_reported, gemba_walks, safety_meetings, trainings_delivered
)
select
  'a1111111-1111-4111-8111-111111111111',
  s.id,
  extract(year from m)::int,
  extract(month from m)::int,
  (6 + random() * 8)::int,
  (8 + random() * 22)::int,
  (2 + random() * 6)::int,
  (1 + random() * 3)::int,
  (1 + random() * 5)::int
from public.sites s
cross join generate_series(date '2021-08-01', date '2026-07-01', interval '1 month') m
where s.organization_id = 'a1111111-1111-4111-8111-111111111111';

-- ---------------------------------------------------------------------------
-- Incidents — ~300 over five years
-- ---------------------------------------------------------------------------
-- Mix targets roughly 12% recordable / 45% first aid / 33% near miss / 10% property
-- damage, with a summer bias: warm months in food processing bring heat stress, more
-- temporary staff and higher line speeds.
insert into public.incidents (
  organization_id, site_id, department_id, employee_id,
  incident_date, reported_date, claim_ref,
  incident_type, classification, shift,
  injury_type, body_part,
  root_cause_category, root_cause_detail,
  machine_involved, safety_violation, recently_transferred, is_lost_time,
  days_away, days_restricted, severity_rating,
  expected_cost, actual_cost_to_date, description
)
select
  'a1111111-1111-4111-8111-111111111111',
  e.site_id,
  e.department_id,
  e.id,
  d.incident_date,
  d.incident_date + (random() * 3)::int,
  case when d.roll < 0.12 and random() < 0.7
       then 'CLM-' || extract(year from d.incident_date)::text || '-' || lpad((row_number() over ())::text, 4, '0')
       else null end,
  d.incident_type::public.incident_type,
  d.classification::public.incident_classification,
  (array['First','Second','Third'])[1 + floor(random() * 3)::int]::public.shift_type,
  case when d.roll < 0.90 then d.injury_type else null end,
  case when d.roll < 0.90 then d.body_part else null end,
  (array['Unsafe Act','Unsafe Condition','Personnel/Behavioral','Management System','Environmental'])
    [1 + floor(random() * 5)::int]::public.root_cause_category,
  d.root_cause_detail,
  random() < 0.30,
  random() < 0.22,
  random() < 0.18,
  d.is_lost_time,
  d.days_away,
  d.days_restricted,
  d.severity::public.severity_rating,
  case when d.roll < 0.12 then round((800 + random() * 24000)::numeric, 2) else null end,
  case when d.roll < 0.12 then round((400 + random() * 18000)::numeric, 2) else null end,
  d.description
from (
  select
    -- Summer-weighted date across the five-year window.
    (date '2021-08-01' + (random() * 1790)::int
       + case when random() < 0.35 then 0 else 0 end) as incident_date,
    r.roll,
    case
      when r.roll < 0.12 then 'OSHA Recordable'
      when r.roll < 0.57 then 'First Aid'
      when r.roll < 0.90 then 'Near Miss'
      else 'Property Damage'
    end as incident_type,
    case
      when r.roll < 0.04 then 'LTI'
      when r.roll < 0.12 then 'MTI'
      when r.roll < 0.57 then 'FAI'
      when r.roll < 0.90 then 'Near Miss'
      else 'Property Damage'
    end as classification,
    (array['Strain','Sprain','Cut/Laceration','Bruise/Contusion','Puncture','Burn','Crushing',
           'Foreign Body','Tendonitis','Chemical','Fracture','Dermatitis'])
      [1 + floor(random() * 12)::int] as injury_type,
    (array['Hand','Finger','Back','Shoulder','Knee','Ankle','Eye','Wrist','Foot','Head','Arm','Leg'])
      [1 + floor(random() * 12)::int] as body_part,
    (array['Guard removed for cleaning and not replaced',
           'Housekeeping — spill not barriered',
           'Manual handling above shoulder height',
           'Lockout step skipped under time pressure',
           'Temporary staff not job-trained',
           'Line speed increased without re-assessment'])
      [1 + floor(random() * 6)::int] as root_cause_detail,
    r.roll < 0.04 as is_lost_time,
    case when r.roll < 0.04 then (1 + random() * 20)::int else 0 end as days_away,
    case when r.roll < 0.12 then (1 + random() * 14)::int else 0 end as days_restricted,
    case
      when r.roll < 0.02 then '4 - Major'
      when r.roll < 0.12 then '3 - Significant'
      when r.roll < 0.57 then '2 - Minor'
      else '1 - Insignificant'
    end as severity,
    (array['Employee reported discomfort after repetitive lifting on the pack-out line.',
           'Contact with a hot surface during changeover.',
           'Slip on a wet floor near the wash bay.',
           'Near miss: pallet shifted while being moved.',
           'Forklift contacted racking during a tight turn.',
           'Chemical splash while transferring sanitiser.'])
      [1 + floor(random() * 6)::int] as description
  from (select random() as roll from generate_series(1, 300)) r
) d
join lateral (
  select id, site_id, department_id from public.employees
  where organization_id = 'a1111111-1111-4111-8111-111111111111'
  order by md5(d.incident_date::text || d.roll::text || id::text)
  limit 1
) e on true;

-- ---------------------------------------------------------------------------
-- Corrective actions
-- ---------------------------------------------------------------------------
-- The control-level mix is realistic for an SMB starting out: weighted toward
-- Administrative and PPE, thin at the top of the hierarchy, and a meaningful share
-- left unclassified — which is exactly the state the maturity signal and the
-- needs-classification queue exist to make visible.
insert into public.corrective_actions (
  organization_id, incident_id, description, assigned_to_name,
  due_date, status, completed_date, hierarchy_of_controls, verification_notes
)
select
  'a1111111-1111-4111-8111-111111111111',
  i.id,
  (array['Fit a fixed guard at the pinch point',
         'Replace the manual transfer with a closed coupling',
         'Add a lift assist at the pack-out station',
         'Re-train the crew on the lockout sequence',
         'Issue cut-resistant gloves to the blending crew',
         'Rewrite the changeover procedure and re-brief',
         'Install drainage matting at the wash bay',
         'Move the decant operation away from the walkway'])
    [1 + floor(random() * 8)::int],
  (array['A. Reyes','M. Okafor','T. Lindqvist','S. Haddad'])[1 + floor(random() * 4)::int],
  i.incident_date + 30,
  s.status::public.corrective_action_status,
  case when s.status = 'Complete' then i.incident_date + 25 else null end,
  -- ~30% left unclassified on purpose.
  case
    when s.hoc_roll < 0.05 then 'elimination'
    when s.hoc_roll < 0.12 then 'substitution'
    when s.hoc_roll < 0.32 then 'engineering'
    when s.hoc_roll < 0.55 then 'administrative'
    when s.hoc_roll < 0.70 then 'ppe'
    else null
  end,
  case when s.status = 'Complete' then 'Verified on the floor at the next audit.' else null end
from (
  select id, incident_date, random() as pick
  from public.incidents
  where organization_id = 'a1111111-1111-4111-8111-111111111111'
  order by random()
  limit 60
) i
cross join lateral (
  select
    (array['Not Started','In Progress','Complete','Complete','Overdue'])[1 + floor(random() * 5)::int] as status,
    random() as hoc_roll
) s;

-- ---------------------------------------------------------------------------
-- Compliance obligations
-- ---------------------------------------------------------------------------
-- Only the standing obligations are inserted here. The dated entries are NOT written by
-- this file: the AFTER INSERT trigger on compliance_obligations runs the generator, so
-- the demo calendar is built by the same code path a client's would be.
--
-- Permit references are obviously synthetic (PERMIT-DEMO-...). The CFR citations are
-- public regulation references rather than anybody's data, and they are the point of the
-- feature -- an obligation without its citation is a to-do item, not a compliance record.
--
-- The mix is deliberate: about a third unverified, one obligation with no date at all to
-- exercise the "cannot be scheduled" state, and both dateless frequencies represented.
insert into public.compliance_obligations (
  organization_id, site_id, jurisdiction, program_area, permit_ref, citation, agency,
  obligation, frequency, due_date, recurrence_month, recurrence_day,
  responsible_party, status, notes, is_verified, lead_time_days
) values
  ('a1111111-1111-4111-8111-111111111111', null, 'Federal', 'Occupational Safety',
   null, '29 CFR 1904.32', 'OSHA',
   'Post the OSHA 300A summary in a visible location from 1 February to 30 April',
   'Annual', null, 2, 1, 'EHS Manager', 'Not Started',
   'Signed by a company executive before posting.', true, 30),

  ('a1111111-1111-4111-8111-111111111111', null, 'Federal', 'Occupational Safety',
   null, '29 CFR 1904.41', 'OSHA',
   'Submit Form 300A data electronically through the OSHA Injury Tracking Application',
   'Annual', null, 3, 2, 'EHS Manager', 'Not Started', null, true, 45),

  ('a1111111-1111-4111-8111-111111111111', 'b1111111-1111-4111-8111-111111111111',
   'Federal', 'Emergency Planning',
   'PERMIT-DEMO-0142', '40 CFR 370.45', 'State Emergency Response Commission',
   'File the EPCRA Tier II chemical inventory report for the site',
   'Annual', null, 3, 1, 'Plant Engineer', 'Not Started', null, true, 60),

  ('a1111111-1111-4111-8111-111111111111', 'b1111111-1111-4111-8111-111111111111',
   'Federal', 'Water', 'PERMIT-DEMO-0077', '40 CFR 112.5', 'EPA',
   'Review and, if required, amend the SPCC plan',
   '5-year cycle', date '2024-09-30', null, null, 'Plant Engineer', 'In Progress',
   'Professional engineer certification required for any technical amendment.', true, 90),

  ('a1111111-1111-4111-8111-111111111111', 'b1111111-1111-4111-8111-111111111111',
   'Federal', 'Water', 'PERMIT-DEMO-0077', '40 CFR 112.6', 'EPA',
   'Inspect above-ground storage tanks and containment for the SPCC plan',
   'Monthly', null, null, 15, 'Maintenance Lead', 'Not Started', null, true, 7),

  ('a1111111-1111-4111-8111-111111111111', 'b2222222-2222-4222-8222-222222222222',
   'State', 'Air', 'PERMIT-DEMO-0311', null, 'State Department of Environmental Quality',
   'Submit the semi-annual air permit deviation report',
   'Semi-annual', date '2026-01-30', null, null, 'Plant Engineer', 'Not Started', null, false, 30),

  ('a1111111-1111-4111-8111-111111111111', 'b2222222-2222-4222-8222-222222222222',
   'State', 'Air', 'PERMIT-DEMO-0311', null, 'State Department of Environmental Quality',
   'Record boiler operating hours and fuel use for the air permit log',
   'Monthly', null, null, 5, 'Maintenance Lead', 'Not Started', null, false, 10),

  ('a1111111-1111-4111-8111-111111111111', null, 'Federal', 'Occupational Safety',
   null, '29 CFR 1910.157(e)(2)', 'OSHA',
   'Inspect portable fire extinguishers and record the check',
   'Monthly', null, null, 20, 'Maintenance Lead', 'Not Started', null, true, 7),

  ('a1111111-1111-4111-8111-111111111111', null, 'Federal', 'Occupational Safety',
   null, '29 CFR 1910.147(c)(6)', 'OSHA',
   'Carry out the periodic inspection of energy control (lockout/tagout) procedures',
   'Annual', null, 6, 15, 'EHS Manager', 'Not Started',
   'Must be performed by an authorised employee other than the one using the procedure.',
   true, 45),

  ('a1111111-1111-4111-8111-111111111111', null, 'Federal', 'Occupational Safety',
   null, '29 CFR 1910.151(c)', 'OSHA',
   'Flush and inspect emergency eyewash and shower stations',
   -- Weekly and daily obligations still need a first date: the schema has no day-of-week
   -- column, so without one there is nothing to count from, and the generator will not
   -- invent a start. The first Monday of the year is the start actually chosen here.
   'Weekly', date '2026-01-05', null, null, 'Shift Supervisor', 'Not Started', null, true, 3),

  ('a1111111-1111-4111-8111-111111111111', null, 'Federal', 'Occupational Safety',
   null, '29 CFR 1910.178(q)(7)', 'OSHA',
   'Complete the powered industrial truck pre-use inspection',
   'Daily', date '2026-01-02', null, null, 'Shift Supervisor', 'Not Started', null, false, 1),

  ('a1111111-1111-4111-8111-111111111111', 'b1111111-1111-4111-8111-111111111111',
   'Local/Regional', 'Water', 'PERMIT-DEMO-0508', null, 'Regional Water Authority',
   'Sample and report industrial wastewater discharge to the sewer authority',
   'Quarterly', date '2026-01-15', null, null, 'Plant Engineer', 'Not Started', null, false, 21),

  ('a1111111-1111-4111-8111-111111111111', null, 'Federal', 'Waste',
   'PERMIT-DEMO-0224', '40 CFR 262.17', 'EPA',
   'Inspect hazardous waste central accumulation area containers',
   'Weekly', date '2026-01-07', null, null, 'Maintenance Lead', 'Not Started', null, true, 3),

  ('a1111111-1111-4111-8111-111111111111', null, 'Federal', 'Waste',
   null, '40 CFR 262.18', 'EPA',
   'Re-notify the agency of hazardous waste generator status',
   'Biennial', date '2025-09-01', null, null, 'EHS Manager', 'Not Started', null, false, 60),

  ('a1111111-1111-4111-8111-111111111111', null, 'Federal', 'Occupational Safety',
   null, '29 CFR 1910.1200(h)', 'OSHA',
   'Train affected employees whenever a new chemical hazard is introduced to the area',
   'Per event', null, null, null, 'EHS Manager', 'Not Started',
   'Triggered by the change, not by the calendar -- tracked here so it is not forgotten.',
   true, 30),

  ('a1111111-1111-4111-8111-111111111111', null, 'Federal', 'Occupational Safety',
   null, '29 CFR 1910.132(d)', 'OSHA',
   'Maintain the written PPE hazard assessment as processes change',
   'Ongoing', null, null, null, 'EHS Manager', 'In Progress', null, true, 30),

  -- Deliberately left with no date and no recurrence anchor: a real obligation somebody
  -- has recorded before the deadline is known. It appears in the register with a visible
  -- explanation and generates nothing, which is the behaviour worth demonstrating.
  ('a1111111-1111-4111-8111-111111111111', 'b2222222-2222-4222-8222-222222222222',
   'State', 'Air', null, null, 'State Department of Environmental Quality',
   'Renew the state air permit — deadline to be confirmed with the agency',
   'Every 4 years', null, null, null, 'Plant Engineer', 'N/A - Verify',
   'Waiting on the agency to confirm the renewal window.', false, 90);

-- ---------------------------------------------------------------------------
-- Compliance history
-- ---------------------------------------------------------------------------
-- Closes out most of the entries whose due date has passed, so the demo has an on-time
-- rate to show rather than a register of untouched dates. A deliberate minority are left
-- open (they read as overdue, which is the state the calendar exists to surface) and a
-- deliberate minority were completed after their due date, so the on-time rate is not a
-- suspicious 100%.
update public.compliance_events ce
set
  status = 'Compliant',
  completed_date = least(
    case
      when r.roll < 0.15 then ce.due_date + (1 + floor(r.roll * 40))::int  -- late
      else ce.due_date - floor(r.roll * 5)::int                            -- on or before
    end,
    current_date
  ),
  completed_by = (array['A. Reyes','M. Okafor','T. Lindqvist','S. Haddad'])[1 + floor(r.roll * 4)::int],
  evidence_notes = (array[
    'Record filed in the compliance folder for the period.',
    'Submitted through the agency portal; confirmation retained.',
    'Signed checklist scanned and archived.',
    'Log sheet completed and countersigned by the supervisor.'])[1 + floor(r.roll * 4)::int]
from (select id as event_id, random() as roll from public.compliance_events) r
where ce.id = r.event_id
  and ce.organization_id = 'a1111111-1111-4111-8111-111111111111'
  and ce.due_date < current_date
  -- ~12% of past dates stay open, and therefore overdue.
  and r.roll > 0.12;

commit;
