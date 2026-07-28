import { z } from 'zod';

import { Constants, type Database } from '@/lib/supabase/database.types';
import { HOC_CODES } from './hierarchy-of-controls';

type Enums = Database['public']['Enums'];

export type IncidentType = Enums['incident_type'];
export type IncidentClassification = Enums['incident_classification'];
export type ShiftType = Enums['shift_type'];
export type RootCauseCategory = Enums['root_cause_category'];
export type SeverityRating = Enums['severity_rating'];
export type CorrectiveActionStatus = Enums['corrective_action_status'];

/**
 * Enum option lists come from the generated Constants, so they cannot drift from the
 * database. Adding a value to an enum in a migration surfaces it here automatically.
 */
export const INCIDENT_TYPES = Constants.public.Enums.incident_type;
export const INCIDENT_CLASSIFICATIONS = Constants.public.Enums.incident_classification;
export const SHIFTS = Constants.public.Enums.shift_type;
export const ROOT_CAUSE_CATEGORIES = Constants.public.Enums.root_cause_category;
export const SEVERITY_RATINGS = Constants.public.Enums.severity_rating;
export const CORRECTIVE_ACTION_STATUSES = Constants.public.Enums.corrective_action_status;

/** `OSHA Recordable` is the recordability test for TRIR (29 CFR 1904). */
export const RECORDABLE_TYPE: IncidentType = 'OSHA Recordable';

/** An empty <select> option submits '', which must become NULL rather than an enum error. */
const emptyToNull = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (v === '' || v === undefined ? null : v), schema.nullable());

const optionalText = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
  z.string().trim().nullable(),
);

const optionalDate = z.preprocess(
  (v) => (v === '' || v === undefined ? null : v),
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD.')
    .nullable(),
);

const nonNegativeInt = z.preprocess(
  (v) => (v === '' || v === undefined || v === null ? 0 : Number(v)),
  z.number().int('Whole days only.').min(0, 'Cannot be negative.'),
);

const optionalMoney = z.preprocess(
  (v) => (v === '' || v === undefined || v === null ? null : Number(v)),
  z.number().min(0, 'Cannot be negative.').nullable(),
);

/**
 * Note what is absent: organization_id. It is never part of any client payload -- the
 * database assigns it by trigger. Adding it here would be the beginning of the bug this
 * schema exists to prevent.
 */
export const incidentSchema = z
  .object({
    site_id: z.string().uuid('Select a site.'),
    department_id: emptyToNull(z.string().uuid()),
    employee_id: emptyToNull(z.string().uuid()),

    incident_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter the date the incident occurred.'),
    reported_date: optionalDate,

    claim_ref: optionalText,

    incident_type: z.enum(INCIDENT_TYPES),
    classification: emptyToNull(z.enum(INCIDENT_CLASSIFICATIONS)),
    shift: emptyToNull(z.enum(SHIFTS)),

    injury_type: optionalText,
    body_part: optionalText,

    root_cause_category: emptyToNull(z.enum(ROOT_CAUSE_CATEGORIES)),
    root_cause_detail: optionalText,

    machine_involved: z.coerce.boolean(),
    safety_violation: z.coerce.boolean(),
    recently_transferred: z.coerce.boolean(),
    is_lost_time: z.coerce.boolean(),

    days_away: nonNegativeInt,
    days_restricted: nonNegativeInt,

    severity_rating: emptyToNull(z.enum(SEVERITY_RATINGS)),

    expected_cost: optionalMoney,
    actual_cost_to_date: optionalMoney,

    description: optionalText,
  })
  .refine(
    (v) => !v.reported_date || v.reported_date >= v.incident_date,
    { message: 'An incident cannot be reported before it happened.', path: ['reported_date'] },
  );

export type IncidentInput = z.infer<typeof incidentSchema>;

/**
 * hierarchy_of_controls is nullable with no fallback and no default. It never blocks a
 * save -- that is the whole point of the field being optional.
 */
export const correctiveActionSchema = z
  .object({
    incident_id: z.string().uuid(),
    description: z.string().trim().min(1, 'Describe the corrective action.'),
    assigned_to_profile_id: emptyToNull(z.string().uuid()),
    assigned_to_name: optionalText,
    due_date: optionalDate,
    status: z.enum(CORRECTIVE_ACTION_STATUSES),
    completed_date: optionalDate,
    hierarchy_of_controls: emptyToNull(z.enum(HOC_CODES)),
    verification_notes: optionalText,
  })
  .refine((v) => v.status !== 'Complete' || !!v.completed_date, {
    message: 'A completed action needs a completion date.',
    path: ['completed_date'],
  });

export type CorrectiveActionInput = z.infer<typeof correctiveActionSchema>;

export const INCIDENT_SORT_COLUMNS = [
  'incident_date',
  'reported_date',
  'incident_type',
  'classification',
  'severity_rating',
  'site_name',
  'department_name',
  'days_away',
] as const;

export type IncidentSortColumn = (typeof INCIDENT_SORT_COLUMNS)[number];

export const DEFAULT_PAGE_SIZE = 25;
export const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
