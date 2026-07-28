-- Enum types and shared utility functions.
--
-- Every enum label below is quoted exactly as it appears in the product spec so that
-- application code, CSV import mappings and the database agree on a single spelling.

create type public.user_role as enum ('owner', 'admin', 'contributor', 'viewer');

create type public.incident_type as enum (
  'OSHA Recordable',
  'First Aid',
  'Near Miss',
  'Property Damage',
  'Hazard'
);

create type public.incident_classification as enum (
  'LTI',
  'MTI',
  'FAI',
  'Near Miss',
  'Property Damage',
  'Hazard'
);

create type public.shift_type as enum ('First', 'Second', 'Third');

create type public.root_cause_category as enum (
  'Unsafe Act',
  'Unsafe Condition',
  'Personnel/Behavioral',
  'Management System',
  'Environmental'
);

create type public.severity_rating as enum (
  '1 - Insignificant',
  '2 - Minor',
  '3 - Significant',
  '4 - Major',
  '5 - Severe'
);

create type public.corrective_action_status as enum (
  'Not Started',
  'In Progress',
  'Complete',
  'Overdue'
);

create type public.jurisdiction as enum ('Federal', 'State', 'Local/Regional');

create type public.obligation_frequency as enum (
  'One-time',
  'Daily',
  'Weekly',
  'Monthly',
  'Quarterly',
  'Semi-annual',
  'Annual',
  'Biennial',
  'Every 4 years',
  '5-year cycle',
  'Ongoing',
  'Per event'
);

create type public.obligation_status as enum (
  'Compliant',
  'In Progress',
  'Action Required',
  'Overdue',
  'Not Started',
  'N/A - Verify'
);

-- Keeps updated_at honest without the application having to remember.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'BEFORE UPDATE trigger: stamps updated_at with the transaction timestamp.';
