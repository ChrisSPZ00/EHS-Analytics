/**
 * The metric layer.
 *
 * "Glass box, not black box": every metric carries its formula, the actual input values
 * it was computed from, and its regulatory citation, so the UI can always show its
 * working. The calculators are pure functions over an aggregate — no database access —
 * which is what makes them directly testable against known inputs.
 *
 * Two rules run through all of this:
 *
 *   1. Nothing is ever annualised, projected or extrapolated. Every figure is an actual
 *      for the filtered period.
 *   2. A missing denominator is never treated as zero and never estimated. A rate with
 *      no hours behind it is `null`, which the UI renders as an em dash with the reason,
 *      not as 0.00.
 */

/** OSHA rate base: 100 full-time equivalents working 2,000 hours a year. */
export const OSHA_RATE_BASE = 200_000;

export interface MetricInputValue {
  label: string;
  value: string;
  /** Where the number came from, for the "show your working" panel. */
  source?: string;
}

export interface MetricResult {
  key: string;
  title: string;
  /** null means "cannot be computed", never "zero". */
  value: number | null;
  display: string;
  /** Shown under the value, e.g. the denominator a rate was divided by. */
  subtext?: string;
  /** Set when the metric could not be computed; explains why, in the client's terms. */
  unavailable?: string;
  formula: string;
  /** The formula with this period's actual numbers substituted in. */
  substituted?: string;
  inputs: MetricInputValue[];
  citation?: string;
  interpretation?: string;
  /** Muted rendering, for figures that are real but should be read with caution. */
  muted?: boolean;
  caution?: string;
}

export interface HoursCoverage {
  /** Months in the filtered range, for the filtered sites. */
  expectedPeriods: number;
  /** Months that actually have an hours_worked row. */
  enteredPeriods: number;
  totalHours: number;
  missingLabels: string[];
}

export interface DashboardAggregate {
  recordables: number;
  firstAids: number;
  nearMisses: number;
  propertyDamage: number;
  hazards: number;
  dartCases: number;
  lostTimeCases: number;
  totalDaysAway: number;
  totalIncidents: number;

  hours: HoursCoverage;

  inspectionsCompleted: number;
  hazardsReported: number;

  daysSinceLastLti: number | null;
  daysSinceLastMti: number | null;
  lastLtiDate: string | null;
  lastMtiDate: string | null;

  correctiveActionsTotal: number;
  correctiveActionsComplete: number;
  correctiveActionsPastDue: number;

  /** Corrective actions by control rank; `unclassified` is deliberately separate. */
  hocCounts: { rank1: number; rank2: number; rank3: number; rank4: number; rank5: number; unclassified: number };
}

const fmt = (n: number, digits = 2) =>
  n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });

const int = (n: number) => n.toLocaleString();

/**
 * Rates share a shape: (count × 200,000) ÷ hours worked.
 *
 * When hours are incomplete for the filtered period the result is `null`. This is the
 * non-negotiable: no zero substitution, no estimate, no annualising a partial year up to
 * a full one. The card says which months are missing so the gap is actionable rather
 * than mysterious.
 */
function rateMetric({
  key,
  title,
  count,
  countLabel,
  hours,
  citation,
  interpretation,
  countSource,
}: {
  key: string;
  title: string;
  count: number;
  countLabel: string;
  hours: HoursCoverage;
  citation?: string;
  interpretation?: string;
  countSource?: string;
}): MetricResult {
  const formula = `(${countLabel} × ${int(OSHA_RATE_BASE)}) ÷ Hours worked`;

  const inputs: MetricInputValue[] = [
    { label: countLabel, value: int(count), source: countSource },
    {
      label: 'Hours worked',
      value: hours.enteredPeriods > 0 ? int(hours.totalHours) : 'not entered',
      source: `${hours.enteredPeriods} of ${hours.expectedPeriods} month(s) entered`,
    },
    { label: 'Rate base', value: int(OSHA_RATE_BASE), source: '100 FTE × 2,000 hours' },
  ];

  const missing = hours.expectedPeriods - hours.enteredPeriods;
  if (missing > 0 || hours.totalHours <= 0) {
    return {
      key,
      title,
      value: null,
      display: '—',
      unavailable:
        hours.enteredPeriods === 0
          ? 'Hours not entered for this period.'
          : `Hours not entered for ${missing} of ${hours.expectedPeriods} months in this period.`,
      subtext:
        hours.missingLabels.length > 0
          ? `Missing: ${hours.missingLabels.slice(0, 6).join(', ')}${
              hours.missingLabels.length > 6 ? `, +${hours.missingLabels.length - 6} more` : ''
            }`
          : undefined,
      formula,
      inputs,
      citation,
      interpretation,
    };
  }

  const value = (count * OSHA_RATE_BASE) / hours.totalHours;

  return {
    key,
    title,
    value,
    display: fmt(value),
    // Every rate card shows its denominator alongside the value.
    subtext: `${int(count)} case${count === 1 ? '' : 's'} ÷ ${int(hours.totalHours)} hours worked`,
    formula,
    substituted: `(${int(count)} × ${int(OSHA_RATE_BASE)}) ÷ ${int(hours.totalHours)} = ${fmt(value)}`,
    inputs,
    citation,
    interpretation,
  };
}

export function buildMetrics(a: DashboardAggregate): MetricResult[] {
  const metrics: MetricResult[] = [];

  metrics.push(
    rateMetric({
      key: 'trir',
      title: 'TRIR',
      count: a.recordables,
      countLabel: 'Recordable cases',
      countSource: "Incidents with type 'OSHA Recordable'",
      hours: a.hours,
      citation: 'OSHA 29 CFR 1904 — Recording and Reporting Occupational Injuries and Illnesses',
      interpretation:
        'Total Recordable Incident Rate: recordable cases per 100 full-time employees per year, computed from actual hours for this period only.',
    }),
  );

  metrics.push(
    rateMetric({
      key: 'dart',
      title: 'DART Rate',
      count: a.dartCases,
      countLabel: 'DART cases',
      countSource: 'Incidents with days away > 0 OR days restricted > 0',
      hours: a.hours,
      citation: 'OSHA 29 CFR 1904.7 — Days Away, Restricted, or Transferred',
      interpretation:
        'Cases serious enough to keep someone off their normal job. A DART rate close to TRIR means most recordables are consequential, not minor.',
    }),
  );

  metrics.push(
    rateMetric({
      key: 'ltifr',
      title: 'LTIFR',
      count: a.lostTimeCases,
      countLabel: 'Lost time cases',
      countSource: "Incidents flagged 'lost time' or classified LTI",
      hours: a.hours,
      citation: 'OSHA 29 CFR 1904.7(b)(3) — Days away from work',
      interpretation: 'Lost Time Injury Frequency Rate.',
    }),
  );

  metrics.push(
    rateMetric({
      key: 'severity',
      title: 'Severity Rate',
      count: a.totalDaysAway,
      countLabel: 'Total days away',
      countSource: 'Sum of days away across all incidents in this period',
      hours: a.hours,
      citation: 'OSHA 29 CFR 1904.7(b)(3)',
      interpretation:
        'Days lost per 100 full-time employees per year. Read alongside LTIFR: a high severity rate with a low LTIFR means few injuries, but serious ones.',
    }),
  );

  // --- Days since ---------------------------------------------------------
  metrics.push(daysSinceMetric('days-since-lti', 'Days Since Last LTI', a.daysSinceLastLti, a.lastLtiDate, 'lost time'));
  metrics.push(daysSinceMetric('days-since-mti', 'Days Since Last MTI', a.daysSinceLastMti, a.lastMtiDate, 'medical treatment'));

  // --- Hazard yield -------------------------------------------------------
  metrics.push(hazardYieldMetric(a));

  // --- Near miss ratio ----------------------------------------------------
  metrics.push(nearMissRatioMetric(a));

  // --- Corrective action closure -----------------------------------------
  metrics.push(closureRateMetric(a));

  // --- Hierarchy of controls maturity ------------------------------------
  metrics.push(engineeringOrAboveMetric(a));

  return metrics;
}

function daysSinceMetric(
  key: string,
  title: string,
  days: number | null,
  date: string | null,
  what: string,
): MetricResult {
  return {
    key,
    title,
    value: days,
    display: days === null ? '—' : int(days),
    subtext: date ? `Last on ${date}` : undefined,
    unavailable: days === null ? `No ${what} case on record.` : undefined,
    formula: 'Today − date of most recent matching incident',
    substituted: date ? `Today − ${date} = ${int(days ?? 0)} days` : undefined,
    inputs: [{ label: 'Most recent case', value: date ?? 'none on record' }],
    interpretation:
      'A counter, not a performance measure. It resets on a single event and says nothing about exposure — never use it as a target on its own.',
  };
}

/**
 * Hazards reported ÷ inspections completed.
 *
 * This is a leading-indicator engagement measure. A yield near zero usually means the
 * inspections are not finding anything, which is an inspection-quality problem rather
 * than evidence of a safe site — the tooltip says so explicitly.
 */
function hazardYieldMetric(a: DashboardAggregate): MetricResult {
  const formula = 'Hazards reported ÷ Inspections completed';
  const inputs: MetricInputValue[] = [
    { label: 'Hazards reported', value: int(a.hazardsReported), source: 'Leading indicators for this period' },
    { label: 'Inspections completed', value: int(a.inspectionsCompleted), source: 'Leading indicators for this period' },
  ];

  const interpretation =
    'Findings per inspection. A yield near zero means inspections are being done but are not surfacing anything — that is usually a problem with inspection quality, not evidence of a safe site. Read a very high yield as either a genuinely hazardous area or a backlog being worked through.';

  if (a.inspectionsCompleted <= 0) {
    return {
      key: 'hazard-yield',
      title: '% Hazard Yield',
      value: null,
      display: '—',
      unavailable: 'No inspections recorded for this period.',
      formula,
      inputs,
      interpretation,
    };
  }

  const value = a.hazardsReported / a.inspectionsCompleted;
  return {
    key: 'hazard-yield',
    title: '% Hazard Yield',
    value,
    display: `${fmt(value * 100, 0)}%`,
    subtext: `${int(a.hazardsReported)} hazards ÷ ${int(a.inspectionsCompleted)} inspections`,
    formula,
    substituted: `${int(a.hazardsReported)} ÷ ${int(a.inspectionsCompleted)} = ${fmt(value)} (${fmt(value * 100, 0)}%)`,
    inputs,
    interpretation,
    muted: value === 0,
    caution:
      value === 0 && a.inspectionsCompleted > 0
        ? 'Inspections are being completed but finding nothing. Check inspection quality before reading this as good news.'
        : undefined,
  };
}

function nearMissRatioMetric(a: DashboardAggregate): MetricResult {
  const formula = 'Near misses ÷ Total recordables';
  const inputs: MetricInputValue[] = [
    { label: 'Near misses', value: int(a.nearMisses) },
    { label: 'Recordables', value: int(a.recordables) },
  ];
  const interpretation =
    'Reporting-culture signal. A low ratio rarely means few near misses happened — it usually means they are not being reported.';

  if (a.recordables <= 0) {
    return {
      key: 'near-miss-ratio',
      title: 'Near Miss Ratio',
      value: null,
      display: '—',
      unavailable: 'No recordable cases in this period, so there is nothing to compare against.',
      formula,
      inputs,
      interpretation,
    };
  }

  const value = a.nearMisses / a.recordables;
  return {
    key: 'near-miss-ratio',
    title: 'Near Miss Ratio',
    value,
    display: `${fmt(value, 1)}:1`,
    subtext: `${int(a.nearMisses)} near misses ÷ ${int(a.recordables)} recordables`,
    formula,
    substituted: `${int(a.nearMisses)} ÷ ${int(a.recordables)} = ${fmt(value, 1)}`,
    inputs,
    interpretation,
  };
}

function closureRateMetric(a: DashboardAggregate): MetricResult {
  const formula = 'Complete corrective actions ÷ Total corrective actions';
  const inputs: MetricInputValue[] = [
    { label: 'Complete', value: int(a.correctiveActionsComplete) },
    { label: 'Total', value: int(a.correctiveActionsTotal) },
    { label: 'Past due', value: int(a.correctiveActionsPastDue), source: 'Due date passed and not complete' },
  ];

  if (a.correctiveActionsTotal <= 0) {
    return {
      key: 'ca-closure',
      title: 'Corrective Action Closure',
      value: null,
      display: '—',
      unavailable: 'No corrective actions recorded for this period.',
      formula,
      inputs,
    };
  }

  const value = a.correctiveActionsComplete / a.correctiveActionsTotal;
  return {
    key: 'ca-closure',
    title: 'Corrective Action Closure',
    value,
    display: `${fmt(value * 100, 0)}%`,
    subtext: `${int(a.correctiveActionsComplete)} of ${int(a.correctiveActionsTotal)} complete · ${int(a.correctiveActionsPastDue)} past due`,
    formula,
    substituted: `${int(a.correctiveActionsComplete)} ÷ ${int(a.correctiveActionsTotal)} = ${fmt(value * 100, 0)}%`,
    inputs,
    caution:
      a.correctiveActionsPastDue > 0
        ? `${int(a.correctiveActionsPastDue)} action(s) are past their due date.`
        : undefined,
  };
}

/**
 * Share of corrective actions at Engineering or above (ranks 1–3).
 *
 * Unclassified actions are EXCLUDED FROM THE DENOMINATOR, not counted as a miss. A
 * programme should not score badly merely for not having finished classifying, and the
 * coverage line under the value makes the size of the classified base explicit.
 *
 * This is a programme-maturity signal, not a compliance metric. Nothing regulatory
 * depends on it and it must not be read as a rate.
 */
export function engineeringOrAboveMetric(a: DashboardAggregate): MetricResult {
  const h = a.hocCounts;
  const classified = h.rank1 + h.rank2 + h.rank3 + h.rank4 + h.rank5;
  const designedOut = h.rank1 + h.rank2 + h.rank3;
  const total = classified + h.unclassified;

  const formula =
    '(Elimination + Substitution + Engineering) ÷ Corrective actions that have a classification';

  const inputs: MetricInputValue[] = [
    { label: 'Elimination (rank 1)', value: int(h.rank1) },
    { label: 'Substitution (rank 2)', value: int(h.rank2) },
    { label: 'Engineering (rank 3)', value: int(h.rank3) },
    { label: 'Administrative (rank 4)', value: int(h.rank4) },
    { label: 'PPE (rank 5)', value: int(h.rank5) },
    {
      label: 'Unclassified',
      value: int(h.unclassified),
      source: 'Excluded from the denominator — not counted as a miss',
    },
  ];

  const interpretation =
    'Programs that resolve findings mainly through PPE and administrative controls are relying on worker behavior to hold the fix in place. A higher share of Elimination, Substitution, and Engineering controls indicates hazards are being designed out rather than managed around.';

  if (classified === 0) {
    return {
      key: 'hoc-maturity',
      title: '% at Engineering or above',
      value: null,
      display: '—',
      unavailable:
        total === 0
          ? 'No corrective actions recorded for this period.'
          : `None of the ${int(total)} corrective actions have been classified yet.`,
      subtext: `Based on 0 of ${int(total)} actions classified (0%).`,
      formula,
      inputs,
      interpretation,
    };
  }

  const value = designedOut / classified;
  const coverage = total > 0 ? classified / total : 0;
  const lowCoverage = coverage < 0.5;

  return {
    key: 'hoc-maturity',
    title: '% at Engineering or above',
    value,
    display: `${fmt(value * 100, 0)}%`,
    // Coverage is shown directly beneath the value, always.
    subtext: `Based on ${int(classified)} of ${int(total)} actions classified (${fmt(coverage * 100, 0)}%).`,
    formula,
    substituted: `(${int(h.rank1)} + ${int(h.rank2)} + ${int(h.rank3)}) ÷ ${int(classified)} = ${fmt(value * 100, 0)}%`,
    inputs,
    interpretation,
    muted: lowCoverage,
    caution: lowCoverage ? 'Low coverage — interpret with caution.' : undefined,
  };
}

/** Marks the maturity signal apart from the regulatory rates in the UI. */
export const PROGRAM_MATURITY_KEYS = new Set(['hoc-maturity', 'hazard-yield', 'near-miss-ratio']);
export const REGULATORY_RATE_KEYS = new Set(['trir', 'dart', 'ltifr', 'severity']);
