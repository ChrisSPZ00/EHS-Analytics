/**
 * Asserts the metric formulas against known inputs.
 *
 * These are the numbers a CSP will put in front of a client, so they are checked
 * arithmetically rather than eyeballed on a chart. The data-integrity rules get as much
 * attention as the formulas: a missing denominator must produce an em dash, never a
 * zero, and unclassified corrective actions must leave the maturity denominator rather
 * than counting as a miss.
 *
 * Run: npm run verify:metrics
 */

import {
  buildMetrics,
  OSHA_RATE_BASE,
  type DashboardAggregate,
  type HoursCoverage,
} from '@/lib/metrics/definitions';
import { monthsBetween } from '@/lib/data/dashboard';

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures += 1;
  console.log(
    `  ${ok ? 'ok  ' : 'FAIL'} ${label}` +
      (ok ? '' : `\n         expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`),
  );
}

function near(label: string, actual: number | null, expected: number, tolerance = 1e-9) {
  const ok = actual !== null && Math.abs(actual - expected) < tolerance;
  if (!ok) failures += 1;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : `\n         expected ${expected}, got ${actual}`}`);
}

const fullHours = (totalHours: number, periods = 12): HoursCoverage => ({
  expectedPeriods: periods,
  enteredPeriods: periods,
  totalHours,
  missingLabels: [],
});

function aggregate(overrides: Partial<DashboardAggregate> = {}): DashboardAggregate {
  return {
    recordables: 0,
    firstAids: 0,
    nearMisses: 0,
    propertyDamage: 0,
    hazards: 0,
    dartCases: 0,
    lostTimeCases: 0,
    totalDaysAway: 0,
    totalIncidents: 0,
    hours: fullHours(0),
    inspectionsCompleted: 0,
    hazardsReported: 0,
    daysSinceLastLti: null,
    daysSinceLastMti: null,
    lastLtiDate: null,
    lastMtiDate: null,
    correctiveActionsTotal: 0,
    correctiveActionsComplete: 0,
    correctiveActionsPastDue: 0,
    hocCounts: { rank1: 0, rank2: 0, rank3: 0, rank4: 0, rank5: 0, unclassified: 0 },
    ...overrides,
  };
}

const get = (a: DashboardAggregate, key: string) => {
  const metric = buildMetrics(a).find((m) => m.key === key);
  if (!metric) throw new Error(`no metric ${key}`);
  return metric;
};

// ---------------------------------------------------------------------------
console.log('\nOSHA rate arithmetic');

// A textbook case: 12 recordables over 500,000 hours = 4.80.
const base = aggregate({
  recordables: 12,
  dartCases: 7,
  lostTimeCases: 3,
  totalDaysAway: 96,
  hours: fullHours(500_000),
});

near('TRIR = (12 × 200,000) ÷ 500,000 = 4.80', get(base, 'trir').value, 4.8);
check('TRIR displays to 2dp', get(base, 'trir').display, '4.80');
near('DART = (7 × 200,000) ÷ 500,000 = 2.80', get(base, 'dart').value, 2.8);
near('LTIFR = (3 × 200,000) ÷ 500,000 = 1.20', get(base, 'ltifr').value, 1.2);
near('Severity = (96 × 200,000) ÷ 500,000 = 38.40', get(base, 'severity').value, 38.4);
check('rate base constant is 200,000', OSHA_RATE_BASE, 200_000);

check(
  'TRIR shows its denominator alongside the value',
  get(base, 'trir').subtext,
  '12 cases ÷ 500,000 hours worked',
);
check(
  'TRIR shows the substituted formula',
  get(base, 'trir').substituted,
  '(12 × 200,000) ÷ 500,000 = 4.80',
);
check(
  'TRIR carries its citation',
  get(base, 'trir').citation,
  'OSHA 29 CFR 1904 — Recording and Reporting Occupational Injuries and Illnesses',
);

// ---------------------------------------------------------------------------
console.log('\nMissing hours: an em dash, never a zero, never an estimate');

const noHours = aggregate({ recordables: 12, hours: fullHours(0, 12) });
// enteredPeriods 12 but zero hours is still not a usable denominator.
const zeroHours = aggregate({
  recordables: 12,
  hours: { expectedPeriods: 12, enteredPeriods: 0, totalHours: 0, missingLabels: ['2024-01'] },
});

check('no hours entered -> value is null', get(zeroHours, 'trir').value, null);
check('no hours entered -> displays an em dash', get(zeroHours, 'trir').display, '—');
check('no hours entered -> says why', get(zeroHours, 'trir').unavailable, 'Hours not entered for this period.');
check('zero-hour denominator is not treated as computable', get(noHours, 'trir').value, null);

const partial = aggregate({
  recordables: 12,
  hours: {
    expectedPeriods: 12,
    enteredPeriods: 9,
    totalHours: 380_000,
    missingLabels: ['2024-10', '2024-11', '2024-12'],
  },
});
check('partial hours -> still refuses to compute', get(partial, 'trir').value, null);
check(
  'partial hours -> names the gap',
  get(partial, 'trir').unavailable,
  'Hours not entered for 3 of 12 months in this period.',
);
check('partial hours -> lists the missing months', get(partial, 'trir').subtext, 'Missing: 2024-10, 2024-11, 2024-12');

// A rate is never annualised up from a partial period: with full-year coverage of only
// half the hours, the rate reflects the actual hours, not a projected year.
const halfYear = aggregate({ recordables: 6, hours: fullHours(250_000, 6) });
near('half a year of actual hours is used as-is', get(halfYear, 'trir').value, 4.8);

// ---------------------------------------------------------------------------
console.log('\nHierarchy-of-controls maturity');

// 10 classified (4 at engineering or above), 2 unclassified.
const maturity = aggregate({
  correctiveActionsTotal: 12,
  hocCounts: { rank1: 1, rank2: 1, rank3: 2, rank4: 3, rank5: 3, unclassified: 2 },
});
const m = get(maturity, 'hoc-maturity');

near('(1 + 1 + 2) ÷ 10 classified = 0.40', m.value, 0.4);
check('displays as a percentage', m.display, '40%');
check(
  'coverage line sits under the value',
  m.subtext,
  'Based on 10 of 12 actions classified (83%).',
);
check('unclassified is NOT in the denominator', m.substituted, '(1 + 1 + 2) ÷ 10 = 40%');
check('good coverage is not muted', m.muted, false);
check('no caution at 83% coverage', m.caution, undefined);

// Same ratio, but most actions unclassified -> low-coverage treatment.
const lowCoverage = aggregate({
  correctiveActionsTotal: 30,
  hocCounts: { rank1: 1, rank2: 1, rank3: 2, rank4: 3, rank5: 3, unclassified: 20 },
});
const low = get(lowCoverage, 'hoc-maturity');
near('ratio is unchanged by unclassified volume', low.value, 0.4);
check('coverage below 50% -> muted', low.muted, true);
check('coverage below 50% -> caution text', low.caution, 'Low coverage — interpret with caution.');
check('coverage line reports 33%', low.subtext, 'Based on 10 of 30 actions classified (33%).');

// Exactly 50% is not "low".
const halfCoverage = aggregate({
  correctiveActionsTotal: 20,
  hocCounts: { rank1: 0, rank2: 0, rank3: 10, rank4: 0, rank5: 0, unclassified: 10 },
});
check('exactly 50% coverage is not flagged low', get(halfCoverage, 'hoc-maturity').muted, false);

const noneClassified = aggregate({
  correctiveActionsTotal: 8,
  hocCounts: { rank1: 0, rank2: 0, rank3: 0, rank4: 0, rank5: 0, unclassified: 8 },
});
const none = get(noneClassified, 'hoc-maturity');
check('nothing classified -> null, not 0%', none.value, null);
check('nothing classified -> em dash', none.display, '—');
check('nothing classified -> coverage still stated', none.subtext, 'Based on 0 of 8 actions classified (0%).');

check(
  'tooltip is the specified wording',
  m.interpretation,
  'Programs that resolve findings mainly through PPE and administrative controls are relying on worker behavior to hold the fix in place. A higher share of Elimination, Substitution, and Engineering controls indicates hazards are being designed out rather than managed around.',
);
check('maturity signal carries no regulatory citation', m.citation, undefined);

// ---------------------------------------------------------------------------
console.log('\nLeading indicators and ratios');

const yieldZero = aggregate({ inspectionsCompleted: 40, hazardsReported: 0 });
const hz = get(yieldZero, 'hazard-yield');
check('zero findings across 40 inspections computes to 0%', hz.display, '0%');
check('...and is flagged as an inspection-quality problem', hz.muted, true);
check(
  '...with the reason spelled out',
  hz.caution,
  'Inspections are being completed but finding nothing. Check inspection quality before reading this as good news.',
);

const noInspections = aggregate({ inspectionsCompleted: 0, hazardsReported: 5 });
check('no inspections -> null rather than divide by zero', get(noInspections, 'hazard-yield').value, null);

const yieldNormal = aggregate({ inspectionsCompleted: 20, hazardsReported: 35 });
near('35 ÷ 20 = 1.75', get(yieldNormal, 'hazard-yield').value, 1.75);
check('displays as 175%', get(yieldNormal, 'hazard-yield').display, '175%');

const nearMiss = aggregate({ nearMisses: 45, recordables: 9 });
near('45 ÷ 9 = 5', get(nearMiss, 'near-miss-ratio').value, 5);
check('displays as a ratio', get(nearMiss, 'near-miss-ratio').display, '5.0:1');
check(
  'no recordables -> null, not infinity',
  get(aggregate({ nearMisses: 4, recordables: 0 }), 'near-miss-ratio').value,
  null,
);

// ---------------------------------------------------------------------------
console.log('\nCorrective action closure');

const closure = aggregate({
  correctiveActionsTotal: 40,
  correctiveActionsComplete: 26,
  correctiveActionsPastDue: 5,
});
const cl = get(closure, 'ca-closure');
near('26 ÷ 40 = 0.65', cl.value, 0.65);
check('displays as 65%', cl.display, '65%');
check('past due is surfaced alongside', cl.subtext, '26 of 40 complete · 5 past due');
check('past due raises a caution', cl.caution, '5 action(s) are past their due date.');
check(
  'no actions -> null rather than 0%',
  get(aggregate({ correctiveActionsTotal: 0 }), 'ca-closure').value,
  null,
);

// ---------------------------------------------------------------------------
console.log('\nCounters');

const counters = aggregate({ daysSinceLastLti: 212, lastLtiDate: '2024-01-05' });
check('days since last LTI', get(counters, 'days-since-lti').display, '212');
check('shows the date it counts from', get(counters, 'days-since-lti').subtext, 'Last on 2024-01-05');
check(
  'no LTI on record -> em dash with a reason',
  get(aggregate(), 'days-since-lti').unavailable,
  'No lost time case on record.',
);

// ---------------------------------------------------------------------------
console.log('\nEvery metric can show its working');

for (const metric of buildMetrics(base)) {
  const hasFormula = typeof metric.formula === 'string' && metric.formula.length > 0;
  const hasInputs = Array.isArray(metric.inputs) && metric.inputs.length > 0;
  if (!hasFormula || !hasInputs) {
    failures += 1;
    console.log(`  FAIL ${metric.key} is missing a formula or its inputs`);
  }
}
console.log(`  ok   all ${buildMetrics(base).length} metrics carry a formula and their inputs`);

const regulatory = ['trir', 'dart', 'ltifr', 'severity'];
for (const key of regulatory) {
  const metric = get(base, key);
  if (!metric.citation) {
    failures += 1;
    console.log(`  FAIL ${key} has no regulatory citation`);
  }
}
console.log('  ok   every regulatory rate carries a citation');

// ---------------------------------------------------------------------------
console.log('\nHours-coverage month maths');

check('a full year is 12 months', monthsBetween('2024-01', '2024-12').length, 12);
check('single month', monthsBetween('2024-06', '2024-06'), ['2024-06']);
check('crosses a year boundary', monthsBetween('2023-11', '2024-02'), [
  '2023-11',
  '2023-12',
  '2024-01',
  '2024-02',
]);
check('five years is 60 months', monthsBetween('2020-01', '2024-12').length, 60);
check('inverted range yields nothing rather than looping', monthsBetween('2024-06', '2024-01'), []);

// Two sites over a full year expect 24 hours rows; one missing is still a gap.
const twoSitePartial = aggregate({
  recordables: 5,
  hours: {
    expectedPeriods: 2 * 12,
    enteredPeriods: 23,
    totalHours: 900_000,
    missingLabels: ['2024-07 (Plant 2)'],
  },
});
check(
  'one missing site-month blocks the rate',
  get(twoSitePartial, 'trir').unavailable,
  'Hours not entered for 1 of 24 months in this period.',
);

// ---------------------------------------------------------------------------
console.log('\nCross-check against figures computed in SQL on the seeded database');

/*
 * These inputs were produced by aggregating the demo data in Postgres for calendar
 * 2025 — counting recordables by incident_type, DART cases off the view's own
 * is_dart_case expression, and control levels off hoc_rank — and the expected TRIR was
 * computed there too. Running the same inputs through the TypeScript formulas proves the
 * two sides agree rather than each being internally consistent but different.
 *
 *   SQL: 7 recordables × 200,000 ÷ 444,668.01 hours = 3.1484
 */
const seeded2025 = aggregate({
  totalIncidents: 62,
  recordables: 7,
  firstAids: 27,
  nearMisses: 21,
  propertyDamage: 7,
  dartCases: 7,
  lostTimeCases: 5,
  totalDaysAway: 41,
  hours: {
    expectedPeriods: 24, // 2 sites × 12 months
    enteredPeriods: 24,
    totalHours: 444_668.01,
    missingLabels: [],
  },
  inspectionsCompleted: 265,
  hazardsReported: 506,
  correctiveActionsTotal: 10,
  hocCounts: { rank1: 0, rank2: 1, rank3: 1, rank4: 4, rank5: 1, unclassified: 3 },
});

near('TRIR matches the SQL figure', get(seeded2025, 'trir').value, 3.1484, 5e-5);
check('TRIR displays as 3.15', get(seeded2025, 'trir').display, '3.15');
near('DART matches SQL', get(seeded2025, 'dart').value, (7 * 200_000) / 444_668.01, 1e-9);
near('LTIFR matches SQL', get(seeded2025, 'ltifr').value, (5 * 200_000) / 444_668.01, 1e-9);
near('Severity matches SQL', get(seeded2025, 'severity').value, (41 * 200_000) / 444_668.01, 1e-9);

// 2 of 7 classified actions sit at Engineering or above; 3 are unclassified.
near('maturity = 2 ÷ 7 classified', get(seeded2025, 'hoc-maturity').value, 2 / 7, 1e-9);
check('maturity displays as 29%', get(seeded2025, 'hoc-maturity').display, '29%');
check(
  'coverage excludes the 3 unclassified from the denominator',
  get(seeded2025, 'hoc-maturity').subtext,
  'Based on 7 of 10 actions classified (70%).',
);
check('70% coverage is not flagged low', get(seeded2025, 'hoc-maturity').muted, false);

near('hazard yield = 506 ÷ 265', get(seeded2025, 'hazard-yield').value, 506 / 265, 1e-9);
near('near miss ratio = 21 ÷ 7', get(seeded2025, 'near-miss-ratio').value, 3, 1e-9);
check('a full year of both sites leaves no hours gap', get(seeded2025, 'trir').unavailable, undefined);

console.log(
  failures === 0 ? '\nAll metric checks passed.\n' : `\n${failures} check(s) FAILED.\n`,
);
process.exit(failures === 0 ? 0 : 1);
