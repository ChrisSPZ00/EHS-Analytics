import type { SupabaseClient } from '@supabase/supabase-js';

import {
  anchorDate,
  isScheduledFrequency,
  today,
  type DueState,
} from '@/lib/domain/compliance';
import type { ComplianceAggregate } from '@/lib/metrics/compliance';
import type { Database } from '@/lib/supabase/database.types';
import {
  complianceEventQuery,
  complianceRange,
  type ComplianceFilters,
} from './compliance-filters';

export type ComplianceEventRow = Database['public']['Views']['compliance_events_enriched']['Row'];
export type ObligationRow = Database['public']['Views']['compliance_obligations_enriched']['Row'];

/** A month's worth of dates is bounded; a filtered list needs a ceiling. */
const MAX_EVENTS = 500;

export interface ComplianceCalendarData {
  events: ComplianceEventRow[];
  aggregate: ComplianceAggregate;
  range: { from: string; to: string };
  sites: { id: string; name: string }[];
  programAreas: string[];
  /** True when the range holds more entries than the page will render. */
  truncated: boolean;
  error: string | null;
}

export async function loadComplianceCalendar(
  supabase: SupabaseClient<Database>,
  filters: ComplianceFilters,
): Promise<ComplianceCalendarData> {
  const range = complianceRange(filters);
  const asOf = today();

  // The KPI counts follow the scope filters (site, jurisdiction, programme area, text)
  // but not the two narrowing toggles: filtering the list down to unverified rows must
  // not make verification coverage read 0%, and filtering to "Overdue" must not make the
  // overdue count equal the total.
  const scope: ComplianceFilters = { ...filters, unverifiedOnly: false, states: [] };

  let eventsQuery = complianceEventQuery(supabase, filters)
    .gte('due_date', range.from)
    .lte('due_date', range.to);

  if (filters.states.length) eventsQuery = eventsQuery.in('state', filters.states);

  // The completion counts come back as two counts rather than as rows: completed_on_time
  // is derived by the view, so "on time" has one definition and the arithmetic here is
  // just a division.
  const completedInPeriod = () =>
    complianceEventQuery(supabase, scope, { count: 'exact', head: true })
      .not('completed_date', 'is', null)
      .gte('completed_date', range.from)
      .lte('completed_date', range.to);

  const [
    { data: events, error },
    { count: openCount },
    { count: overdueCount },
    { count: dueSoonCount },
    { count: completedCount },
    { count: onTimeCount },
    { data: obligations },
    { data: sites },
  ] = await Promise.all([
    eventsQuery
      .order('due_date', { ascending: true })
      .order('state_rank', { ascending: true })
      .limit(MAX_EVENTS + 1),

    complianceEventQuery(supabase, scope, { count: 'exact', head: true }).is('completed_date', null),
    complianceEventQuery(supabase, scope, { count: 'exact', head: true }).eq('state', 'Overdue'),
    complianceEventQuery(supabase, scope, { count: 'exact', head: true }).eq('state', 'Due soon'),

    completedInPeriod(),
    completedInPeriod().eq('completed_on_time', true),

    supabase
      .from('compliance_obligations_enriched')
      .select('id, frequency, is_verified, due_date, recurrence_month, recurrence_day, program_area')
      .order('program_area', { nullsFirst: false }),

    supabase.from('sites').select('id, name').order('name'),
  ]);

  const obligationRows = obligations ?? [];

  const scheduled = obligationRows.filter((o) => o.frequency && isScheduledFrequency(o.frequency));

  const aggregate: ComplianceAggregate = {
    obligationsTotal: obligationRows.length,
    obligationsVerified: obligationRows.filter((o) => o.is_verified).length,
    obligationsScheduled: scheduled.length,
    obligationsWithoutDates: scheduled.filter(
      (o) =>
        anchorDate(
          {
            frequency: o.frequency!,
            due_date: o.due_date,
            recurrence_month: o.recurrence_month,
            recurrence_day: o.recurrence_day,
          },
          asOf,
        ) === null,
    ).length,

    eventsOpen: openCount ?? 0,
    eventsOverdue: overdueCount ?? 0,
    eventsDueSoon: dueSoonCount ?? 0,

    eventsCompleted: completedCount ?? 0,
    eventsCompletedOnTime: onTimeCount ?? 0,

    periodFrom: range.from,
    periodTo: range.to,
  };

  const rows = (events ?? []) as ComplianceEventRow[];

  return {
    events: rows.slice(0, MAX_EVENTS),
    aggregate,
    range,
    sites: sites ?? [],
    programAreas: [
      ...new Set(obligationRows.map((o) => o.program_area).filter((a): a is string => !!a)),
    ].sort(),
    truncated: rows.length > MAX_EVENTS,
    error: error?.message ?? null,
  };
}

/**
 * Groups events by ISO date, for the month grid.
 */
export function groupEventsByDate(
  events: ComplianceEventRow[],
): Map<string, ComplianceEventRow[]> {
  const map = new Map<string, ComplianceEventRow[]>();
  for (const event of events) {
    if (!event.due_date) continue;
    const list = map.get(event.due_date);
    if (list) list.push(event);
    else map.set(event.due_date, [event]);
  }
  return map;
}

/**
 * The 6×7 grid a month is drawn on, Monday-first, including the leading and trailing days
 * that belong to the neighbouring months.
 */
export function monthGrid(month: string): { date: string; inMonth: boolean }[] {
  const first = `${month}-01`;
  const firstDow = new Date(Date.parse(`${first}T00:00:00Z`)).getUTCDay(); // 0 = Sunday
  const leading = (firstDow + 6) % 7; // Monday-first
  const start = new Date(Date.parse(`${first}T00:00:00Z`) - leading * 86_400_000);

  return Array.from({ length: 42 }, (_, i) => {
    const date = new Date(start.getTime() + i * 86_400_000).toISOString().slice(0, 10);
    return { date, inMonth: date.slice(0, 7) === month };
  });
}

export const STATE_ORDER: DueState[] = ['Overdue', 'Due soon', 'Upcoming', 'Complete'];
