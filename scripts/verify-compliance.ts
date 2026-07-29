/**
 * Asserts the compliance recurrence arithmetic and the due-state rules.
 *
 * A compliance calendar that is quietly wrong is worse than no calendar: a client stops
 * checking the permit because the software is watching, and the software is watching the
 * wrong date. So the dates are checked against worked examples rather than eyeballed on a
 * grid, and the last block cross-checks the TypeScript mirror against the dates the SQL
 * generator actually produced.
 *
 * The rules that carry the most weight here are the refusals: an obligation with nothing
 * to schedule from produces no dates at all, and 'Ongoing' and 'Per event' produce none
 * ever. Both are asserted explicitly, because the tempting bug in both cases is to invent
 * a plausible date.
 *
 * Run: npm run verify:compliance
 */

import {
  addDays,
  addMonths,
  anchorDate,
  calendarGap,
  complianceOccurrences,
  daysInMonth,
  diffDays,
  dueDescription,
  dueState,
  dueStateRank,
  generationWindow,
  isScheduledFrequency,
  monthDay,
  recurrenceStep,
  type ObligationFrequency,
  type RecurrenceInput,
} from '@/lib/domain/compliance';
import { buildComplianceMetrics, type ComplianceAggregate } from '@/lib/metrics/compliance';
import { monthGrid } from '@/lib/data/compliance';

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures += 1;
  console.log(
    `  ${ok ? 'ok  ' : 'FAIL'} ${label}` +
      (ok ? '' : `\n         expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`),
  );
}

/** Every SQL cross-check below was taken on this date, so the mirror uses it too. */
const AS_OF = '2026-07-29';

const obligation = (over: Partial<RecurrenceInput> = {}): RecurrenceInput => ({
  frequency: 'Annual',
  due_date: null,
  recurrence_month: null,
  recurrence_day: null,
  ...over,
});

// ---------------------------------------------------------------------------
console.log('\nDate arithmetic');

check('days in February 2026', daysInMonth(2026, 2), 28);
check('days in February 2028 (leap)', daysInMonth(2028, 2), 29);
check('31 February clamps to the 28th', monthDay(2026, 2, 31), '2026-02-28');
check('31 February 2028 clamps to the 29th', monthDay(2028, 2, 31), '2028-02-29');
check('day 0 clamps up to the 1st', monthDay(2026, 5, 0), '2026-05-01');

check('adding a month to 31 January clamps', addMonths('2026-01-31', 1), '2026-02-28');
check('adding two months to 31 January does not', addMonths('2026-01-31', 2), '2026-03-31');
check('a month back from 31 March clamps', addMonths('2026-03-31', -1), '2026-02-28');
check('twelve months is a year', addMonths('2026-07-29', 12), '2027-07-29');
check('adding days crosses a year boundary', addDays('2026-12-30', 3), '2027-01-02');
check('diffDays across a leap day', diffDays('2028-02-28', '2028-03-01'), 2);

// Dates are compared as strings throughout, which only works because they are zero-padded.
check('dates order lexically', ['2026-10-01', '2026-09-30'].sort(), ['2026-09-30', '2026-10-01']);

// ---------------------------------------------------------------------------
console.log('\nRecurrence steps and windows');

check('monthly steps by one month', recurrenceStep('Monthly'), { months: 1 });
check('quarterly steps by three', recurrenceStep('Quarterly'), { months: 3 });
check('a 5-year cycle steps by sixty months', recurrenceStep('5-year cycle'), { months: 60 });
check('weekly steps by seven days', recurrenceStep('Weekly'), { days: 7 });
check('one-time has no step', recurrenceStep('One-time'), null);
check('ongoing has no step', recurrenceStep('Ongoing'), null);
check('per event has no step', recurrenceStep('Per event'), null);

check('daily looks back a fortnight', generationWindow('Daily').lookback, { days: 14 });
check('a 5-year cycle looks ten years ahead', generationWindow('5-year cycle').horizon, {
  months: 120,
});

check('ongoing is not a scheduled frequency', isScheduledFrequency('Ongoing'), false);
check('per event is not a scheduled frequency', isScheduledFrequency('Per event'), false);
check('one-time is', isScheduledFrequency('One-time'), true);

// ---------------------------------------------------------------------------
console.log('\nAnchoring — the rules about refusing to guess');

check(
  'a due date is the anchor',
  anchorDate(obligation({ due_date: '2025-03-01' }), AS_OF),
  '2025-03-01',
);
check(
  'month + day anchor in the current year',
  anchorDate(obligation({ recurrence_month: 3, recurrence_day: 1 }), AS_OF),
  '2026-03-01',
);
check(
  'a day alone anchors in the current month',
  anchorDate(obligation({ frequency: 'Monthly', recurrence_day: 15 }), AS_OF),
  '2026-07-15',
);
check(
  'a 31st anchor clamps in a short month',
  anchorDate(obligation({ recurrence_month: 2, recurrence_day: 31 }), AS_OF),
  '2026-02-28',
);
check('no date and no anchor is NULL, not a guess', anchorDate(obligation(), AS_OF), null);
check(
  'a due date wins over a recurrence anchor',
  anchorDate(obligation({ due_date: '2025-12-25', recurrence_month: 3, recurrence_day: 1 }), AS_OF),
  '2025-12-25',
);

// ---------------------------------------------------------------------------
console.log('\nWhat generates nothing');

check(
  'an ongoing duty generates no dates',
  complianceOccurrences(obligation({ frequency: 'Ongoing', due_date: '2026-01-01' }), AS_OF),
  [],
);
check(
  'a per-event duty generates no dates, even with a date on it',
  complianceOccurrences(obligation({ frequency: 'Per event', due_date: '2026-01-01' }), AS_OF),
  [],
);
check(
  'an annual obligation with no anchor generates no dates',
  complianceOccurrences(obligation({ frequency: 'Annual' }), AS_OF),
  [],
);
check(
  'a weekly obligation with no anchor generates no dates',
  complianceOccurrences(obligation({ frequency: 'Weekly' }), AS_OF),
  [],
);
check(
  'ongoing explains itself rather than failing silently',
  calendarGap(obligation({ frequency: 'Ongoing' })),
  'Ongoing duties have no due date, so they do not appear on the calendar.',
);
check(
  'per event explains itself',
  calendarGap(obligation({ frequency: 'Per event' })),
  'Triggered by an event rather than a date, so it does not appear on the calendar.',
);
check(
  'an unanchored recurrence explains itself',
  calendarGap(obligation({ frequency: 'Quarterly' })),
  'No due date or recurrence day recorded, so no dates can be scheduled from it.',
);
check('an anchored recurrence has no gap', calendarGap(obligation({ due_date: '2026-02-01' })), null);

// ---------------------------------------------------------------------------
console.log('\nThe lattice');

const monthly31 = complianceOccurrences(
  obligation({ frequency: 'Monthly', due_date: '2026-01-31' }),
  AS_OF,
);

// The whole point of computing anchor + n × step rather than stepping from the previous
// instance: February clamps, and the following month must return to the 31st rather than
// inheriting the 28th for good.
check('a monthly-on-the-31st obligation does not drift off the 31st', monthly31, [
  '2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31', '2026-06-30',
  '2026-07-31', '2026-08-31', '2026-09-30', '2026-10-31', '2026-11-30', '2026-12-31',
  '2027-01-31', '2027-02-28', '2027-03-31', '2027-04-30', '2027-05-31', '2027-06-30',
]);

const oneTimeFarOut = complianceOccurrences(
  obligation({ frequency: 'One-time', due_date: '2031-04-15' }),
  AS_OF,
);
check('a one-time date beyond the horizon is still scheduled', oneTimeFarOut, ['2031-04-15']);

const daily = complianceOccurrences(
  obligation({ frequency: 'Daily', due_date: '2026-07-01' }),
  AS_OF,
);
check('a daily obligation is bounded by its window', daily.length, 60);
check('the daily window starts a fortnight back', daily[0], '2026-07-15');
check('and ends 45 days ahead', daily[daily.length - 1], '2026-09-12');

const fiveYear = complianceOccurrences(
  obligation({ frequency: '5-year cycle', due_date: '2024-09-30' }),
  AS_OF,
);
check('a five-year cycle spans its decade', fiveYear, ['2024-09-30', '2029-09-30', '2034-09-30']);

// An anchor far in the past must not produce a decade of history, nor skip the instance
// that is already overdue. The counts are cross-checked against SQL further down.
const oldMonthly = complianceOccurrences(
  obligation({ frequency: 'Monthly', due_date: '2019-04-10' }),
  AS_OF,
);
check('an old monthly anchor is trimmed to its window', oldMonthly.length, 24);
check('nothing before the lookback survives', oldMonthly.includes('2025-07-10'), false);
check('an already-overdue instance is included', oldMonthly.includes('2026-07-10'), true);

// ---------------------------------------------------------------------------
console.log('\nDue state');

check('past its date is overdue', dueState('2026-07-28', null, 30, AS_OF), 'Overdue');
check('due today is not overdue', dueState('2026-07-29', null, 30, AS_OF), 'Due soon');
check('exactly on the lead time boundary is due soon', dueState('2026-08-28', null, 30, AS_OF), 'Due soon');
check('one day past the boundary is upcoming', dueState('2026-08-29', null, 30, AS_OF), 'Upcoming');
check('a zero lead time still catches today', dueState('2026-07-29', null, 0, AS_OF), 'Due soon');
check('a zero lead time leaves tomorrow alone', dueState('2026-07-30', null, 0, AS_OF), 'Upcoming');
check('a long lead time reaches further out', dueState('2026-09-20', null, 90, AS_OF), 'Due soon');
check(
  'completion beats every date rule',
  dueState('2020-01-01', '2026-07-01', 30, AS_OF),
  'Complete',
);
check(
  'a missing lead time falls back to 30 days, never to zero',
  dueState('2026-08-20', null, null, AS_OF),
  'Due soon',
);

check('what is late sorts first', dueStateRank('Overdue'), 1);
check('what is done sorts last', dueStateRank('Complete'), 4);
check('an unknown state sorts after everything', dueStateRank('Something else'), 5);
check(
  'the states sort late-first',
  ['Complete', 'Upcoming', 'Overdue', 'Due soon'].sort((a, b) => dueStateRank(a) - dueStateRank(b)),
  ['Overdue', 'Due soon', 'Upcoming', 'Complete'],
);

// A signed number is a thing to decode; these are the words the UI shows instead.
check('today reads as today', dueDescription(0), 'Due today');
check('one day late is singular', dueDescription(-1), '1 day overdue');
check('nine days late is plural', dueDescription(-9), '9 days overdue');
check('one day out is singular', dueDescription(1), 'In 1 day');
check('twelve days out is plural', dueDescription(12), 'In 12 days');

// ---------------------------------------------------------------------------
console.log('\nMetrics');

const aggregate = (over: Partial<ComplianceAggregate> = {}): ComplianceAggregate => ({
  obligationsTotal: 0,
  obligationsVerified: 0,
  obligationsScheduled: 0,
  obligationsWithoutDates: 0,
  eventsOpen: 0,
  eventsOverdue: 0,
  eventsDueSoon: 0,
  eventsCompleted: 0,
  eventsCompletedOnTime: 0,
  periodFrom: '2026-01-01',
  periodTo: '2026-12-31',
  ...over,
});

const get = (a: ComplianceAggregate, key: string) => {
  const metric = buildComplianceMetrics(a).find((m) => m.key === key);
  if (!metric) throw new Error(`no metric ${key}`);
  return metric;
};

const nothingDone = get(aggregate({ eventsOpen: 12, eventsOverdue: 3 }), 'on-time');
check('no completions means no rate at all', nothingDone.value, null);
check('and it renders as an em dash, never 0%', nothingDone.display, '—');
check(
  'and it says why',
  nothingDone.unavailable,
  'Nothing has been recorded complete in this period.',
);

const mostlyOnTime = get(
  aggregate({ eventsCompleted: 40, eventsCompletedOnTime: 34 }),
  'on-time',
);
check('34 of 40 is 85%', mostlyOnTime.value, 85);
check('displayed to one decimal', mostlyOnTime.display, '85.0%');
check(
  'the working shows the actual numbers',
  mostlyOnTime.substituted,
  '(34 ÷ 40) × 100 = 85.0%',
);

const lowCoverage = get(aggregate({ obligationsTotal: 20, obligationsVerified: 6 }), 'verified');
check('6 of 20 is 30%', lowCoverage.value, 30);
check('below half is flagged', lowCoverage.muted, true);
check(
  'and the caution says what to do with it',
  lowCoverage.caution,
  'Low coverage — most of this calendar has not been checked against a source document.',
);

const goodCoverage = get(aggregate({ obligationsTotal: 20, obligationsVerified: 17 }), 'verified');
check('85% coverage is not flagged', goodCoverage.muted, false);
check('and carries no caution', goodCoverage.caution, undefined);

const emptyRegister = get(aggregate(), 'verified');
check('an empty register has no coverage figure', emptyRegister.value, null);
check('rather than a perfect or a zero one', emptyRegister.display, '—');

// Every metric has to be able to show its working -- the glass-box rule.
for (const metric of buildComplianceMetrics(
  aggregate({
    obligationsTotal: 20,
    obligationsVerified: 12,
    obligationsScheduled: 18,
    obligationsWithoutDates: 2,
    eventsOpen: 40,
    eventsOverdue: 5,
    eventsDueSoon: 7,
    eventsCompleted: 30,
    eventsCompletedOnTime: 27,
  }),
)) {
  check(`${metric.key} carries a formula`, metric.formula.length > 0, true);
  check(`${metric.key} carries its inputs`, metric.inputs.length > 0, true);
}

// ---------------------------------------------------------------------------
console.log('\nMonth grid');

const july = monthGrid('2026-07');
check('a month grid is six weeks', july.length, 42);
check('and starts on a Monday', july[0].date, '2026-06-29');
check('1 July 2026 is a Wednesday, so it is the third cell', july[2].date, '2026-07-01');
check('leading days are marked as outside the month', july[0].inMonth, false);
check('and the first of the month is not', july[2].inMonth, true);
check(
  'every day of the month appears exactly once',
  july.filter((d) => d.inMonth).length,
  31,
);

const february = monthGrid('2026-02');
check('February 2026 starts on a Sunday, six cells in', february[6].date, '2026-02-01');
check('and holds 28 days', february.filter((d) => d.inMonth).length, 28);

// ---------------------------------------------------------------------------
console.log('\nCross-check against the SQL generator');

// The generator that actually runs lives in SQL, inside the trigger that keeps the
// calendar in step with the register. These are the dates it produced on 2026-07-29,
// read back out of compliance_events. If the two sides ever disagree, the schedule
// preview on the form is lying about what the save will do.
const sqlCases: {
  label: string;
  frequency: ObligationFrequency;
  due_date: string;
  sql: { count: number; first: string; last: string };
}[] = [
  {
    label: 'monthly on the 31st',
    frequency: 'Monthly',
    due_date: '2026-01-31',
    sql: { count: 18, first: '2026-01-31', last: '2027-06-30' },
  },
  {
    label: 'daily walkaround',
    frequency: 'Daily',
    due_date: '2026-07-01',
    sql: { count: 60, first: '2026-07-15', last: '2026-09-12' },
  },
  {
    label: 'five-year permit',
    frequency: '5-year cycle',
    due_date: '2024-09-30',
    sql: { count: 3, first: '2024-09-30', last: '2034-09-30' },
  },
  {
    label: 'one-time, far out',
    frequency: 'One-time',
    due_date: '2031-04-15',
    sql: { count: 1, first: '2031-04-15', last: '2031-04-15' },
  },
  {
    label: 'annual filing',
    frequency: 'Annual',
    due_date: '2025-03-01',
    sql: { count: 5, first: '2025-03-01', last: '2029-03-01' },
  },
  {
    // The hardest case for the generator: the anchor is seven years behind the window, so
    // SQL has to jump to the right instance rather than walk to it. The epoch of a month
    // interval is a 30-day approximation, which is why that jump is corrected in both
    // directions -- and why this case is here.
    label: 'monthly anchored seven years back',
    frequency: 'Monthly',
    due_date: '2019-04-10',
    sql: { count: 24, first: '2025-08-10', last: '2027-07-10' },
  },
];

for (const testCase of sqlCases) {
  const dates = complianceOccurrences(
    obligation({ frequency: testCase.frequency, due_date: testCase.due_date }),
    AS_OF,
  );
  check(`${testCase.label}: count matches SQL`, dates.length, testCase.sql.count);
  check(`${testCase.label}: first date matches SQL`, dates[0], testCase.sql.first);
  check(`${testCase.label}: last date matches SQL`, dates[dates.length - 1], testCase.sql.last);
}

console.log(
  failures === 0 ? '\nAll compliance checks passed.\n' : `\n${failures} check(s) FAILED.\n`,
);
process.exit(failures === 0 ? 0 : 1);
