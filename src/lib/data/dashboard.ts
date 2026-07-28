import type { SupabaseClient } from '@supabase/supabase-js';

import type { DashboardAggregate, HoursCoverage } from '@/lib/metrics/definitions';
import type { Database } from '@/lib/supabase/database.types';

type IncidentRow = Database['public']['Views']['incidents_enriched']['Row'];

export interface DashboardFilters {
  year: number | null;
  from: string | null;
  to: string | null;
  siteId: string | null;
  departmentId: string | null;
}

export interface MonthPoint {
  month: string;
  recordable: number;
  firstAid: number;
  nearMiss: number;
  propertyDamage: number;
  hazard: number;
  lostTime: number;
  inspections: number;
  hazardsReported: number;
  gembaWalks: number;
  trainings: number;
  safetyMeetings: number;
  hours: number | null;
  /** null when the month has no hours row — the line breaks rather than dropping to 0. */
  trir: number | null;
}

export interface CountPoint {
  label: string;
  count: number;
}

export interface ParetoPoint extends CountPoint {
  cumulativePercent: number;
}

export interface HeatmapData {
  departments: string[];
  types: string[];
  cells: Record<string, Record<string, number>>;
  max: number;
}

export interface CostPoint {
  label: string;
  expected: number;
  actual: number;
}

export interface HocLevelPoint {
  token: number;
  label: string;
  rank: number | null;
  count: number;
}

export interface DashboardData {
  aggregate: DashboardAggregate;
  months: MonthPoint[];
  injuryPareto: ParetoPoint[];
  bodyParts: CountPoint[];
  rootCauses: CountPoint[];
  tenure: CountPoint[];
  heatmap: HeatmapData;
  costs: CostPoint[];
  hocLevels: HocLevelPoint[];
  meta: {
    from: string;
    to: string;
    siteName: string | null;
    departmentName: string | null;
    availableYears: number[];
    orgName: string;
    truncated: boolean;
  };
}

const MAX_ROWS = 20_000;
const PAGE = 1000;

const monthKey = (isoDate: string) => isoDate.slice(0, 7);

/**
 * Inclusive list of YYYY-MM between two YYYY-MM bounds.
 *
 * This drives the hours denominator: one row is expected per site per month in the list,
 * and any month without one is a real gap that stops a rate from being computed.
 * Exported so the count is asserted rather than assumed.
 */
export function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  const [fy, fm] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  let y = fy;
  let m = fm;
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

export function resolveRange(filters: DashboardFilters, fallbackYear: number) {
  if (filters.from && filters.to) return { from: filters.from, to: filters.to };
  const year = filters.year ?? fallbackYear;
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

export async function loadDashboard(
  supabase: SupabaseClient<Database>,
  filters: DashboardFilters,
): Promise<DashboardData> {
  const [{ data: org }, { data: sites }, { data: departments }, { data: yearRows }] =
    await Promise.all([
      supabase.from('organizations').select('name').maybeSingle(),
      supabase.from('sites').select('id, name').order('name'),
      supabase.from('departments').select('id, name, site_id').order('name'),
      supabase
        .from('incidents')
        .select('incident_date')
        .order('incident_date', { ascending: false })
        .limit(1),
    ]);

  const latestYear = yearRows?.[0]?.incident_date
    ? Number(yearRows[0].incident_date.slice(0, 4))
    : new Date().getUTCFullYear();

  const { from, to } = resolveRange(filters, latestYear);
  const rangeMonths = monthsBetween(monthKey(from), monthKey(to));

  // Sites in scope for the hours denominator.
  const scopedSites = filters.siteId
    ? (sites ?? []).filter((s) => s.id === filters.siteId)
    : (sites ?? []);

  // ---- incidents --------------------------------------------------------
  const incidents: IncidentRow[] = [];
  let truncated = false;

  for (let offset = 0; offset < MAX_ROWS; offset += PAGE) {
    let query = supabase
      .from('incidents_enriched')
      .select('*')
      .gte('incident_date', from)
      .lte('incident_date', to)
      .order('incident_date', { ascending: true })
      .range(offset, offset + PAGE - 1);

    if (filters.siteId) query = query.eq('site_id', filters.siteId);
    if (filters.departmentId) query = query.eq('department_id', filters.departmentId);

    const { data, error } = await query;
    if (error || !data?.length) break;
    incidents.push(...data);
    if (data.length < PAGE) break;
    if (offset + PAGE >= MAX_ROWS) truncated = true;
  }

  // ---- hours and leading indicators -------------------------------------
  const [fromYear, toYear] = [Number(from.slice(0, 4)), Number(to.slice(0, 4))];

  let hoursQuery = supabase
    .from('hours_worked')
    .select('site_id, period_year, period_month, hours')
    .gte('period_year', fromYear)
    .lte('period_year', toYear);
  if (filters.siteId) hoursQuery = hoursQuery.eq('site_id', filters.siteId);

  let leadingQuery = supabase
    .from('leading_indicators')
    .select('*')
    .gte('period_year', fromYear)
    .lte('period_year', toYear);
  if (filters.siteId) leadingQuery = leadingQuery.eq('site_id', filters.siteId);

  const [{ data: hoursRows }, { data: leadingRows }, { data: caRows }] = await Promise.all([
    hoursQuery,
    leadingQuery,
    supabase
      .from('corrective_actions_enriched')
      .select('id, status, due_date, completed_date, hoc_rank, incident_date, site_id, department_id')
      .gte('incident_date', from)
      .lte('incident_date', to),
  ]);

  const inRange = (year: number, month: number) =>
    rangeMonths.includes(`${year}-${String(month).padStart(2, '0')}`);

  const hoursInRange = (hoursRows ?? []).filter((r) => inRange(r.period_year, r.period_month));
  const leadingInRange = (leadingRows ?? []).filter((r) => inRange(r.period_year, r.period_month));

  // ---- hours coverage ----------------------------------------------------
  // One row is expected per site per month in range. A month without a row is a real
  // gap, never a zero: rate metrics refuse to compute rather than mislead.
  const siteNameById = new Map((sites ?? []).map((s) => [s.id, s.name] as const));
  const enteredKeys = new Set(
    hoursInRange.map((r) => `${r.site_id}|${r.period_year}-${String(r.period_month).padStart(2, '0')}`),
  );

  const missingLabels: string[] = [];
  for (const site of scopedSites) {
    for (const month of rangeMonths) {
      if (!enteredKeys.has(`${site.id}|${month}`)) {
        missingLabels.push(scopedSites.length > 1 ? `${month} (${site.name})` : month);
      }
    }
  }

  const hours: HoursCoverage = {
    expectedPeriods: scopedSites.length * rangeMonths.length,
    enteredPeriods: enteredKeys.size,
    totalHours: hoursInRange.reduce((sum, r) => sum + Number(r.hours ?? 0), 0),
    missingLabels,
  };

  // ---- monthly series ----------------------------------------------------
  const monthMap = new Map<string, MonthPoint>(
    rangeMonths.map((month) => [
      month,
      {
        month,
        recordable: 0,
        firstAid: 0,
        nearMiss: 0,
        propertyDamage: 0,
        hazard: 0,
        lostTime: 0,
        inspections: 0,
        hazardsReported: 0,
        gembaWalks: 0,
        trainings: 0,
        safetyMeetings: 0,
        hours: null,
        trir: null,
      },
    ]),
  );

  for (const row of hoursInRange) {
    const key = `${row.period_year}-${String(row.period_month).padStart(2, '0')}`;
    const point = monthMap.get(key);
    if (point) point.hours = (point.hours ?? 0) + Number(row.hours ?? 0);
  }

  for (const row of leadingInRange) {
    const key = `${row.period_year}-${String(row.period_month).padStart(2, '0')}`;
    const point = monthMap.get(key);
    if (!point) continue;
    point.inspections += row.inspections_completed ?? 0;
    point.hazardsReported += row.hazards_reported ?? 0;
    point.gembaWalks += row.gemba_walks ?? 0;
    point.trainings += row.trainings_delivered ?? 0;
    point.safetyMeetings += row.safety_meetings ?? 0;
  }

  const aggregate: DashboardAggregate = {
    recordables: 0,
    firstAids: 0,
    nearMisses: 0,
    propertyDamage: 0,
    hazards: 0,
    dartCases: 0,
    lostTimeCases: 0,
    totalDaysAway: 0,
    totalIncidents: incidents.length,
    hours,
    inspectionsCompleted: leadingInRange.reduce((s, r) => s + (r.inspections_completed ?? 0), 0),
    hazardsReported: leadingInRange.reduce((s, r) => s + (r.hazards_reported ?? 0), 0),
    daysSinceLastLti: null,
    daysSinceLastMti: null,
    lastLtiDate: null,
    lastMtiDate: null,
    correctiveActionsTotal: 0,
    correctiveActionsComplete: 0,
    correctiveActionsPastDue: 0,
    hocCounts: { rank1: 0, rank2: 0, rank3: 0, rank4: 0, rank5: 0, unclassified: 0 },
  };

  const injuryCounts = new Map<string, number>();
  const bodyPartCounts = new Map<string, number>();
  const rootCauseCounts = new Map<string, number>();
  const tenureCounts = new Map<string, { count: number; rank: number }>();
  const heatCells: Record<string, Record<string, number>> = {};
  const costTotals = new Map<string, { expected: number; actual: number }>();

  const types = ['OSHA Recordable', 'First Aid', 'Near Miss', 'Property Damage', 'Hazard'];

  for (const row of incidents) {
    const key = monthKey(row.incident_date ?? '');
    const point = monthMap.get(key);

    switch (row.incident_type) {
      case 'OSHA Recordable':
        aggregate.recordables += 1;
        if (point) point.recordable += 1;
        break;
      case 'First Aid':
        aggregate.firstAids += 1;
        if (point) point.firstAid += 1;
        break;
      case 'Near Miss':
        aggregate.nearMisses += 1;
        if (point) point.nearMiss += 1;
        break;
      case 'Property Damage':
        aggregate.propertyDamage += 1;
        if (point) point.propertyDamage += 1;
        break;
      case 'Hazard':
        aggregate.hazards += 1;
        if (point) point.hazard += 1;
        break;
    }

    if (row.is_dart_case) aggregate.dartCases += 1;
    if (row.is_lost_time || row.classification === 'LTI') {
      aggregate.lostTimeCases += 1;
      if (point) point.lostTime += 1;
    }
    aggregate.totalDaysAway += row.days_away ?? 0;

    if (row.is_lost_time || row.classification === 'LTI') {
      if (!aggregate.lastLtiDate || (row.incident_date ?? '') > aggregate.lastLtiDate) {
        aggregate.lastLtiDate = row.incident_date;
      }
    }
    if (row.classification === 'MTI') {
      if (!aggregate.lastMtiDate || (row.incident_date ?? '') > aggregate.lastMtiDate) {
        aggregate.lastMtiDate = row.incident_date;
      }
    }

    if (row.injury_type) injuryCounts.set(row.injury_type, (injuryCounts.get(row.injury_type) ?? 0) + 1);
    if (row.body_part) bodyPartCounts.set(row.body_part, (bodyPartCounts.get(row.body_part) ?? 0) + 1);
    if (row.root_cause_category)
      rootCauseCounts.set(row.root_cause_category, (rootCauseCounts.get(row.root_cause_category) ?? 0) + 1);

    if (row.tenure_bucket && row.tenure_bucket_rank !== null) {
      const existing = tenureCounts.get(row.tenure_bucket) ?? { count: 0, rank: row.tenure_bucket_rank };
      existing.count += 1;
      tenureCounts.set(row.tenure_bucket, existing);
    }

    const dept = row.department_name ?? 'Unassigned';
    heatCells[dept] ??= Object.fromEntries(types.map((t) => [t, 0]));
    if (row.incident_type) heatCells[dept][row.incident_type] += 1;

    const cost = costTotals.get(dept) ?? { expected: 0, actual: 0 };
    cost.expected += Number(row.expected_cost ?? 0);
    cost.actual += Number(row.actual_cost_to_date ?? 0);
    costTotals.set(dept, cost);
  }

  // Per-month TRIR for the overlay line. Months without hours stay null so the line
  // breaks rather than implying a rate of zero.
  for (const point of monthMap.values()) {
    if (point.hours && point.hours > 0) {
      point.trir = (point.recordable * 200_000) / point.hours;
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const daysBetween = (a: string, b: string) =>
    Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
  if (aggregate.lastLtiDate) aggregate.daysSinceLastLti = daysBetween(aggregate.lastLtiDate, today);
  if (aggregate.lastMtiDate) aggregate.daysSinceLastMti = daysBetween(aggregate.lastMtiDate, today);

  // ---- corrective actions -------------------------------------------------
  const scopedActions = (caRows ?? []).filter(
    (r) =>
      (!filters.siteId || r.site_id === filters.siteId) &&
      (!filters.departmentId || r.department_id === filters.departmentId),
  );

  aggregate.correctiveActionsTotal = scopedActions.length;
  for (const action of scopedActions) {
    if (action.status === 'Complete') aggregate.correctiveActionsComplete += 1;
    else if (action.due_date && action.due_date < today) aggregate.correctiveActionsPastDue += 1;

    switch (action.hoc_rank) {
      case 1: aggregate.hocCounts.rank1 += 1; break;
      case 2: aggregate.hocCounts.rank2 += 1; break;
      case 3: aggregate.hocCounts.rank3 += 1; break;
      case 4: aggregate.hocCounts.rank4 += 1; break;
      case 5: aggregate.hocCounts.rank5 += 1; break;
      default: aggregate.hocCounts.unclassified += 1;
    }
  }

  // ---- derived chart series ----------------------------------------------
  const sortedInjuries = [...injuryCounts.entries()].sort((a, b) => b[1] - a[1]);
  const injuryTotal = sortedInjuries.reduce((s, [, c]) => s + c, 0);
  let running = 0;
  const injuryPareto: ParetoPoint[] = sortedInjuries.map(([label, count]) => {
    running += count;
    return {
      label,
      count,
      cumulativePercent: injuryTotal > 0 ? (running / injuryTotal) * 100 : 0,
    };
  });

  const hocLevels: HocLevelPoint[] = [
    { token: 1, rank: 1, label: 'Elimination', count: aggregate.hocCounts.rank1 },
    { token: 2, rank: 2, label: 'Substitution', count: aggregate.hocCounts.rank2 },
    { token: 3, rank: 3, label: 'Engineering', count: aggregate.hocCounts.rank3 },
    { token: 4, rank: 4, label: 'Administrative', count: aggregate.hocCounts.rank4 },
    { token: 5, rank: 5, label: 'PPE', count: aggregate.hocCounts.rank5 },
    // Always present, always its own segment, never folded into a level.
    { token: 0, rank: null, label: 'Unclassified', count: aggregate.hocCounts.unclassified },
  ];

  const heatDepartments = Object.keys(heatCells).sort();
  const heatMax = Math.max(
    0,
    ...heatDepartments.flatMap((d) => types.map((t) => heatCells[d][t] ?? 0)),
  );

  return {
    aggregate,
    months: [...monthMap.values()],
    injuryPareto,
    bodyParts: [...bodyPartCounts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count),
    rootCauses: [...rootCauseCounts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count),
    tenure: [...tenureCounts.entries()]
      .map(([label, v]) => ({ label, count: v.count, rank: v.rank }))
      .sort((a, b) => a.rank - b.rank)
      .map(({ label, count }) => ({ label, count })),
    heatmap: { departments: heatDepartments, types, cells: heatCells, max: heatMax },
    costs: [...costTotals.entries()]
      .map(([label, v]) => ({ label, ...v }))
      .filter((c) => c.expected > 0 || c.actual > 0)
      .sort((a, b) => b.actual - a.actual),
    hocLevels,
    meta: {
      from,
      to,
      siteName: filters.siteId ? (siteNameById.get(filters.siteId) ?? null) : null,
      departmentName: filters.departmentId
        ? ((departments ?? []).find((d) => d.id === filters.departmentId)?.name ?? null)
        : null,
      availableYears: Array.from(
        { length: 6 },
        (_, i) => latestYear - i,
      ),
      orgName: org?.name ?? 'Your organization',
      truncated,
    },
  };
}
