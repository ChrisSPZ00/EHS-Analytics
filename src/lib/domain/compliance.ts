import { z } from 'zod';

import { Constants, type Database } from '@/lib/supabase/database.types';

type Enums = Database['public']['Enums'];

export type Jurisdiction = Enums['jurisdiction'];
export type ObligationFrequency = Enums['obligation_frequency'];
export type ObligationStatus = Enums['obligation_status'];

/**
 * Option lists come from the generated Constants, so they cannot drift from the database.
 */
export const JURISDICTIONS = Constants.public.Enums.jurisdiction;
export const OBLIGATION_FREQUENCIES = Constants.public.Enums.obligation_frequency;
export const OBLIGATION_STATUSES = Constants.public.Enums.obligation_status;

/**
 * Two frequencies describe a standing duty rather than a dated task: 'Ongoing' (a
 * condition you are either meeting or not) and 'Per event' (triggered by a spill, an
 * injury, a process change). Both are real obligations and belong in the register; what
 * they do not have is a due date. The calendar shows nothing for them rather than
 * inventing an instance, and the register says so in words.
 */
export const UNSCHEDULED_FREQUENCIES: readonly ObligationFrequency[] = ['Ongoing', 'Per event'];

export const isScheduledFrequency = (f: ObligationFrequency): boolean =>
  !UNSCHEDULED_FREQUENCIES.includes(f);

// ---------------------------------------------------------------------------
// Due state
// ---------------------------------------------------------------------------

export const DUE_STATES = ['Overdue', 'Due soon', 'Upcoming', 'Complete'] as const;
export type DueState = (typeof DUE_STATES)[number];

/**
 * Mirror of `public.compliance_event_state`. The database derives this for every row it
 * serves; this exists so the client can derive it for a date it is only previewing — a
 * date the user has typed but not yet saved — without a round trip.
 *
 * Verification status is deliberately not folded in here. Whether a human has checked an
 * obligation against the permit text is a separate fact, carried by its own badge: an
 * unverified obligation is not "less overdue", and an obligation marked "N/A - Verify"
 * is precisely the one that should not be quietly read as compliant.
 */
export function dueState(
  dueDate: string,
  completedDate: string | null,
  leadTimeDays: number | null,
  asOf: string,
): DueState {
  if (completedDate) return 'Complete';
  if (dueDate < asOf) return 'Overdue';
  if (dueDate <= addDays(asOf, leadTimeDays ?? 30)) return 'Due soon';
  return 'Upcoming';
}

/** Sort key: what is late first, what is done last. Mirrors `compliance_state_rank`. */
export function dueStateRank(state: DueState | string | null): number {
  switch (state) {
    case 'Overdue':
      return 1;
    case 'Due soon':
      return 2;
    case 'Upcoming':
      return 3;
    case 'Complete':
      return 4;
    default:
      return 5;
  }
}

export const DUE_STATE_TONE: Record<DueState, 'danger' | 'warning' | 'success' | 'info'> = {
  Overdue: 'danger',
  'Due soon': 'warning',
  Upcoming: 'info',
  Complete: 'success',
};

/**
 * "in 12 days" / "9 days overdue" / "due today".
 *
 * Signed day counts render as words rather than as a minus sign in front of a number:
 * "-9 days" is a figure a reader has to decode, and this is the field that decides
 * whether someone acts today.
 */
export function dueDescription(daysUntilDue: number): string {
  if (daysUntilDue === 0) return 'Due today';
  if (daysUntilDue < 0) {
    const n = Math.abs(daysUntilDue);
    return `${n} day${n === 1 ? '' : 's'} overdue`;
  }
  return `In ${daysUntilDue} day${daysUntilDue === 1 ? '' : 's'}`;
}

// ---------------------------------------------------------------------------
// Date arithmetic
// ---------------------------------------------------------------------------
//
// Plain YYYY-MM-DD strings throughout, compared lexically and stepped in UTC. A due date
// is a calendar date, not an instant: parsing it into a local Date shifts it by a day for
// anyone west of Greenwich, and a compliance date that moves with the reader's timezone
// is a bug that only shows up in production.

const pad = (n: number) => String(n).padStart(2, '0');
const isoDate = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

/** Days in a 1-indexed month. */
export const daysInMonth = (year: number, month: number): number =>
  new Date(Date.UTC(year, month, 0)).getUTCDate();

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Adds whole months, clamping to the end of the target month — the same rule Postgres
 * applies, so the two sides agree on what 31 January + 1 month means.
 */
export function addMonths(date: string, months: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return isoDate(ny, nm, Math.min(d, daysInMonth(ny, nm)));
}

export function diffDays(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** Mirror of `public.compliance_month_day`: the 31st of February is the 28th. */
export function monthDay(year: number, month: number, day: number): string {
  return isoDate(year, month, Math.min(Math.max(day, 1), daysInMonth(year, month)));
}

export const today = (): string => new Date().toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// Recurrence
// ---------------------------------------------------------------------------

export type Interval = { days: number } | { months: number };

const add = (date: string, n: number, step: Interval): string =>
  'days' in step ? addDays(date, n * step.days) : addMonths(date, n * step.months);

/** Mirror of `public.compliance_recurrence_step`. */
export function recurrenceStep(frequency: ObligationFrequency): Interval | null {
  switch (frequency) {
    case 'Daily':
      return { days: 1 };
    case 'Weekly':
      return { days: 7 };
    case 'Monthly':
      return { months: 1 };
    case 'Quarterly':
      return { months: 3 };
    case 'Semi-annual':
      return { months: 6 };
    case 'Annual':
      return { months: 12 };
    case 'Biennial':
      return { months: 24 };
    case 'Every 4 years':
      return { months: 48 };
    case '5-year cycle':
      return { months: 60 };
    default:
      return null;
  }
}

/** Mirror of `public.compliance_generation_window`. */
export function generationWindow(frequency: ObligationFrequency): {
  lookback: Interval;
  horizon: Interval;
} {
  switch (frequency) {
    case 'Daily':
      return { lookback: { days: 14 }, horizon: { days: 45 } };
    case 'Weekly':
      return { lookback: { days: 56 }, horizon: { days: 182 } };
    case 'Monthly':
      return { lookback: { months: 12 }, horizon: { months: 12 } };
    case 'Quarterly':
      return { lookback: { months: 12 }, horizon: { months: 24 } };
    case 'Semi-annual':
      return { lookback: { months: 24 }, horizon: { months: 24 } };
    case 'Annual':
      return { lookback: { months: 24 }, horizon: { months: 36 } };
    case 'Biennial':
      return { lookback: { months: 48 }, horizon: { months: 60 } };
    case 'Every 4 years':
      return { lookback: { months: 96 }, horizon: { months: 120 } };
    case '5-year cycle':
      return { lookback: { months: 120 }, horizon: { months: 120 } };
    default:
      return { lookback: { days: 0 }, horizon: { days: 0 } };
  }
}

export interface RecurrenceInput {
  frequency: ObligationFrequency;
  due_date: string | null;
  recurrence_month: number | null;
  recurrence_day: number | null;
}

/** Mirror of `public.compliance_anchor_date`. NULL in, nothing out — never a guess. */
export function anchorDate(input: RecurrenceInput, asOf: string): string | null {
  if (input.due_date) return input.due_date;
  const year = Number(asOf.slice(0, 4));
  if (input.recurrence_month != null && input.recurrence_day != null) {
    return monthDay(year, input.recurrence_month, input.recurrence_day);
  }
  if (input.recurrence_day != null) {
    return monthDay(year, Number(asOf.slice(5, 7)), input.recurrence_day);
  }
  return null;
}

/**
 * The dates `generate_compliance_events` would materialise, computed here.
 *
 * The generator itself lives in SQL — it has to, because it runs inside the trigger that
 * keeps the calendar in step with the register. This mirror exists for two reasons: the
 * form can show a client exactly which dates their obligation will land on before they
 * save it, and `npm run verify:compliance` can assert the arithmetic against worked
 * examples and then cross-check that SQL produces the identical list.
 */
export function complianceOccurrences(input: RecurrenceInput, asOf: string): string[] {
  if (!isScheduledFrequency(input.frequency)) return [];

  const anchor = anchorDate(input, asOf);
  if (!anchor) return [];

  // A one-time obligation is its due date and nothing else, however far out it sits.
  if (input.frequency === 'One-time') return [anchor];

  const step = recurrenceStep(input.frequency);
  if (!step) return [];

  const { lookback, horizon } = generationWindow(input.frequency);
  const lookbackStart = add(asOf, -1, lookback);
  const windowStart = anchor > lookbackStart ? anchor : lookbackStart;
  const windowEnd = add(asOf, 1, horizon);

  const out: string[] = [];
  for (let n = 0; n <= 1000; n += 1) {
    const date = add(anchor, n, step);
    if (date > windowEnd) break;
    if (date >= windowStart) out.push(date);
  }
  return out;
}

/**
 * Why an obligation contributes nothing to the calendar, or null when it does.
 *
 * This is surfaced as a note on the register rather than as a validation error: an
 * obligation transcribed from a permit before its deadline is known is still worth
 * recording, and refusing the save would just push it back into the spreadsheet we are
 * trying to replace.
 */
export function calendarGap(input: RecurrenceInput): string | null {
  if (!isScheduledFrequency(input.frequency)) {
    return input.frequency === 'Ongoing'
      ? 'Ongoing duties have no due date, so they do not appear on the calendar.'
      : 'Triggered by an event rather than a date, so it does not appear on the calendar.';
  }
  if (anchorDate(input, today()) === null) {
    return 'No due date or recurrence day recorded, so no dates can be scheduled from it.';
  }
  return null;
}

export function frequencyDescription(input: RecurrenceInput): string {
  const gap = calendarGap(input);
  if (!isScheduledFrequency(input.frequency)) return input.frequency;
  if (input.frequency === 'One-time') {
    return input.due_date ? `One-time, due ${input.due_date}` : 'One-time, no date set';
  }
  if (gap) return `${input.frequency} — not scheduled`;

  const anchor = anchorDate(input, today());
  return anchor ? `${input.frequency}, from ${anchor}` : input.frequency;
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

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

const optionalInt = (min: number, max: number, message: string) =>
  z.preprocess(
    (v) => (v === '' || v === undefined || v === null ? null : Number(v)),
    z.number().int(message).min(min, message).max(max, message).nullable(),
  );

/**
 * Note what is absent: organization_id. It is never part of any client payload — the
 * database assigns it by trigger.
 *
 * Note also what is *not* required: a due date. An obligation with no date still belongs
 * in the register, and the calendar simply has nothing to show for it — see calendarGap().
 */
export const obligationSchema = z.object({
  site_id: emptyToNull(z.string().uuid()),

  jurisdiction: z.enum(JURISDICTIONS),
  program_area: optionalText,
  permit_ref: optionalText,
  citation: optionalText,
  agency: optionalText,

  obligation: z.string().trim().min(1, 'Describe what has to be done.'),

  frequency: z.enum(OBLIGATION_FREQUENCIES),
  due_date: optionalDate,
  recurrence_month: optionalInt(1, 12, 'Month must be 1–12.'),
  recurrence_day: optionalInt(1, 31, 'Day must be 1–31.'),

  responsible_party: optionalText,
  status: z.enum(OBLIGATION_STATUSES),
  notes: optionalText,

  is_verified: z.coerce.boolean(),
  lead_time_days: z.preprocess(
    (v) => (v === '' || v === undefined || v === null ? 30 : Number(v)),
    z.number().int('Whole days only.').min(0, 'Cannot be negative.'),
  ),
});

export type ObligationInput = z.infer<typeof obligationSchema>;

/**
 * Completing a calendar event. The completion date is required once the status says
 * Compliant — the same rule the database enforces with a check constraint, and the same
 * one corrective actions carry. "Done" with no date is an assertion, not an audit trail.
 */
export const complianceEventSchema = z
  .object({
    status: z.enum(OBLIGATION_STATUSES),
    completed_date: optionalDate,
    completed_by: optionalText,
    evidence_notes: optionalText,
  })
  .refine((v) => v.status !== 'Compliant' || !!v.completed_date, {
    message: 'Record the date this was satisfied.',
    path: ['completed_date'],
  })
  .refine((v) => v.status === 'Compliant' || !v.completed_date, {
    message: 'Clear the completion date, or set the status to Compliant.',
    path: ['completed_date'],
  });

export type ComplianceEventInput = z.infer<typeof complianceEventSchema>;
