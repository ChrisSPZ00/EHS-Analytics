import type { MetricResult } from '@/lib/metrics/definitions';

/**
 * Compliance-calendar metrics.
 *
 * Same contract as the incident metric layer: pure functions over an aggregate, each
 * carrying its formula and the actual numbers it was computed from, so every figure can
 * show its working. None of these is a regulatory rate — they are program signals about
 * how the calendar is being kept, and the UI says so rather than letting them sit next to
 * TRIR as though they were the same kind of thing.
 *
 * The two rules from the incident layer carry over unchanged:
 *
 *   1. Nothing is annualised, projected or extrapolated.
 *   2. A missing denominator is `null`, never zero. A client who has completed nothing
 *      yet has no on-time rate — that is not 0%, and rendering it as 0% would put a
 *      damning number in front of them that the data does not support.
 */

export interface ComplianceAggregate {
  /** Register-wide, unfiltered by date. */
  obligationsTotal: number;
  obligationsVerified: number;
  /** Frequencies that produce dated instances at all. */
  obligationsScheduled: number;
  /** Scheduled frequency, but no due date and no recurrence anchor to schedule from. */
  obligationsWithoutDates: number;

  /** Calendar entries not yet recorded complete, at today's date. */
  eventsOpen: number;
  eventsOverdue: number;
  eventsDueSoon: number;

  /** Completions inside the reporting period. */
  eventsCompleted: number;
  eventsCompletedOnTime: number;

  periodFrom: string;
  periodTo: string;
}

const int = (n: number) => n.toLocaleString();
const pct = (n: number) => `${n.toFixed(1)}%`;

export function buildComplianceMetrics(a: ComplianceAggregate): MetricResult[] {
  const period = `${a.periodFrom} to ${a.periodTo}`;

  const overdue: MetricResult = {
    key: 'overdue',
    title: 'Overdue',
    value: a.eventsOverdue,
    display: int(a.eventsOverdue),
    subtext:
      a.eventsOpen > 0
        ? `Of ${int(a.eventsOpen)} open calendar entr${a.eventsOpen === 1 ? 'y' : 'ies'}`
        : 'No open calendar entries',
    formula: 'Count of open entries where due date < today',
    substituted: `${int(a.eventsOverdue)} of ${int(a.eventsOpen)} open entries are past their due date`,
    inputs: [
      { label: 'Open entries', value: int(a.eventsOpen), source: 'No completion date recorded' },
      { label: 'Past their due date', value: int(a.eventsOverdue) },
    ],
    interpretation:
      'A count of dates that have passed without a completion recorded. It counts entries, ' +
      'not obligations: a monthly filing missed three times shows as three.',
  };

  const dueSoon: MetricResult = {
    key: 'due-soon',
    title: 'Due soon',
    value: a.eventsDueSoon,
    display: int(a.eventsDueSoon),
    subtext: 'Within each obligation’s own lead time',
    formula: 'Count of open entries where today ≤ due date ≤ today + that obligation’s lead time',
    substituted: `${int(a.eventsDueSoon)} of ${int(a.eventsOpen)} open entries fall inside their lead time`,
    inputs: [
      { label: 'Open entries', value: int(a.eventsOpen) },
      { label: 'Inside their lead time', value: int(a.eventsDueSoon) },
      {
        label: 'Lead time',
        value: 'Per obligation',
        source: 'Set on the obligation; 30 days by default',
      },
    ],
    interpretation:
      'Lead time is per obligation because the notice a filing needs is not the notice a ' +
      'monthly inspection needs. A Tier II report with a 60-day lead appears two months out; ' +
      'a weekly eyewash flush does not.',
  };

  // No completions in the period means no on-time rate. Not 0%.
  const onTime: MetricResult =
    a.eventsCompleted === 0
      ? {
          key: 'on-time',
          title: 'Completed on time',
          value: null,
          display: '—',
          unavailable: 'Nothing has been recorded complete in this period.',
          formula: 'Entries completed on or before their due date ÷ entries completed × 100',
          inputs: [
            { label: 'Entries completed', value: '0', source: period },
            { label: 'Of those, on or before the due date', value: '0' },
          ],
          interpretation:
            'A rate needs completions to divide by. With none recorded, the honest answer ' +
            'is that there is no rate yet — not that it is zero.',
        }
      : (() => {
          const value = (a.eventsCompletedOnTime / a.eventsCompleted) * 100;
          return {
            key: 'on-time',
            title: 'Completed on time',
            value,
            display: pct(value),
            subtext: `Based on ${int(a.eventsCompleted)} completion${
              a.eventsCompleted === 1 ? '' : 's'
            } in this period`,
            formula: 'Entries completed on or before their due date ÷ entries completed × 100',
            substituted: `(${int(a.eventsCompletedOnTime)} ÷ ${int(a.eventsCompleted)}) × 100 = ${pct(value)}`,
            inputs: [
              { label: 'Entries completed', value: int(a.eventsCompleted), source: period },
              {
                label: 'Of those, on or before the due date',
                value: int(a.eventsCompletedOnTime),
              },
            ],
            interpretation:
              'Measured against the date recorded as completed, so a late completion counts ' +
              'as late rather than disappearing once the box is ticked.',
          } satisfies MetricResult;
        })();

  const verificationValue =
    a.obligationsTotal === 0 ? null : (a.obligationsVerified / a.obligationsTotal) * 100;

  const verification: MetricResult = {
    key: 'verified',
    title: 'Verified against source',
    value: verificationValue,
    display: verificationValue === null ? '—' : pct(verificationValue),
    subtext:
      a.obligationsTotal === 0
        ? undefined
        : `${int(a.obligationsVerified)} of ${int(a.obligationsTotal)} obligations checked against the permit or rule text`,
    unavailable: a.obligationsTotal === 0 ? 'No obligations in the register yet.' : undefined,
    muted: verificationValue !== null && verificationValue < 50,
    caution:
      verificationValue !== null && verificationValue < 50
        ? 'Low coverage — most of this calendar has not been checked against a source document.'
        : undefined,
    formula: 'Obligations marked verified ÷ obligations in the register × 100',
    substituted:
      verificationValue === null
        ? undefined
        : `(${int(a.obligationsVerified)} ÷ ${int(a.obligationsTotal)}) × 100 = ${pct(verificationValue)}`,
    inputs: [
      { label: 'Obligations in the register', value: int(a.obligationsTotal) },
      {
        label: 'Marked verified',
        value: int(a.obligationsVerified),
        source: 'A human has confirmed the entry against the permit or rule text',
      },
    ],
    interpretation:
      'A calendar built from memory rather than from the permit text is a liability, not an ' +
      'asset. This is the share that somebody has actually checked — it says nothing about ' +
      'whether the work is being done, only about whether the list is trustworthy.',
  };

  const unscheduled: MetricResult = {
    key: 'unscheduled',
    title: 'Not on the calendar',
    value: a.obligationsWithoutDates,
    display: int(a.obligationsWithoutDates),
    subtext:
      a.obligationsWithoutDates === 0
        ? 'Every dated obligation has something to schedule from'
        : 'Recurring obligations with no date to schedule from',
    formula:
      'Count of obligations with a recurring frequency but neither a due date nor a recurrence day',
    substituted: `${int(a.obligationsWithoutDates)} of ${int(a.obligationsScheduled)} dated obligations cannot be scheduled`,
    inputs: [
      {
        label: 'Obligations with a dated frequency',
        value: int(a.obligationsScheduled),
        source: 'Excludes Ongoing and Per event, which have no dates by definition',
      },
      { label: 'Of those, with no anchor date', value: int(a.obligationsWithoutDates) },
    ],
    interpretation:
      'These are recorded but invisible on the calendar. The generator will not invent a ' +
      'date for them, so they need one entering before they can be tracked.',
  };

  return [overdue, dueSoon, onTime, verification, unscheduled];
}
