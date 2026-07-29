import Link from 'next/link';

import { ComplianceEventTable } from '@/components/compliance/compliance-event-table';
import { ComplianceFilterBar } from '@/components/compliance/compliance-filter-bar';
import { ComplianceNav, MonthNav } from '@/components/compliance/compliance-nav';
import { RefreshCalendarButton } from '@/components/compliance/refresh-calendar-button';
import { MonthCalendar } from '@/components/compliance/month-calendar';
import { KpiCard, MetricSectionNote } from '@/components/dashboard/kpi-card';
import { buttonVariants } from '@/components/ui/button';
import { Callout, EmptyState } from '@/components/ui/callout';
import { loadComplianceCalendar } from '@/lib/data/compliance';
import {
  complianceFiltersToSearchParams,
  parseComplianceFilters,
  type RawSearchParams,
} from '@/lib/data/compliance-filters';
import { buildComplianceMetrics } from '@/lib/metrics/compliance';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function CompliancePage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const params = await searchParams;
  const filters = parseComplianceFilters(params);
  const supabase = await createClient();

  const [data, { data: user }] = await Promise.all([
    loadComplianceCalendar(supabase, filters),
    supabase.auth.getUser(),
  ]);

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.user?.id ?? '')
    .maybeSingle();

  const completedBy = profile?.full_name || user.user?.email || null;
  const metrics = buildComplianceMetrics(data.aggregate);

  const exportHref = `/compliance/export?${complianceFiltersToSearchParams(filters).toString()}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Compliance Calendar</h1>
          <p className="text-sm text-muted-foreground">
            Every dated obligation the register can schedule, {data.range.from} to {data.range.to}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <RefreshCalendarButton />
          <a href={exportHref} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            Export CSV
          </a>
          <Link
            href="/compliance/obligations/new"
            className={buttonVariants({ variant: 'default', size: 'sm' })}
          >
            Add an obligation
          </Link>
        </div>
      </div>

      <ComplianceNav filters={filters} />

      <section className="space-y-2">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {metrics.map((metric) => (
            <KpiCard key={metric.key} metric={metric} />
          ))}
        </div>
        <MetricSectionNote>
          These counts cover the whole register for the current site, jurisdiction, area and
          search filters — not only the dates on screen. Completions are counted within the
          period shown. None of them is a regulatory metric: they describe how the calendar
          is being kept.
        </MetricSectionNote>
      </section>

      <ComplianceFilterBar
        filters={filters}
        sites={data.sites}
        programAreas={data.programAreas}
      />

      {data.error ? (
        <Callout tone="danger" title="Could not load the calendar">
          {data.error}
        </Callout>
      ) : null}

      {data.aggregate.obligationsWithoutDates > 0 ? (
        <Callout
          tone="warning"
          title={`${data.aggregate.obligationsWithoutDates} obligation${
            data.aggregate.obligationsWithoutDates === 1 ? '' : 's'
          } cannot be scheduled`}
          action={
            <Link
              href="/compliance/register"
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              Open the register
            </Link>
          }
        >
          They recur, but carry no due date and no recurrence day, so there is nothing to
          schedule from. Nothing has been guessed on their behalf.
        </Callout>
      ) : null}

      <MonthNav filters={filters} />

      {filters.view === 'calendar' ? (
        <div className="hidden md:block">
          <MonthCalendar month={filters.month} events={data.events} />
        </div>
      ) : null}

      {data.events.length === 0 ? (
        <EmptyState title="Nothing falls due in this period">
          <p>
            {data.aggregate.obligationsTotal === 0
              ? 'The register is empty. Add the obligations from your permits and rule set, and the calendar builds itself from their recurrence.'
              : 'Try a different month, widen the range, or clear a filter.'}
          </p>
          {data.aggregate.obligationsTotal === 0 ? (
            <div className="mt-4 flex justify-center">
              <Link
                href="/compliance/obligations/new"
                className={buttonVariants({ variant: 'default', size: 'sm' })}
              >
                Add the first obligation
              </Link>
            </div>
          ) : null}
        </EmptyState>
      ) : (
        <>
          <ComplianceEventTable rows={data.events} completedBy={completedBy} />
          {data.truncated ? (
            <Callout tone="warning" title="Showing the first 500 entries">
              Narrow the range or add a filter to see the rest.
            </Callout>
          ) : null}
        </>
      )}
    </div>
  );
}
