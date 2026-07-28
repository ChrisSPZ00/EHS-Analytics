import Link from 'next/link';

import { ChartCard } from '@/components/dashboard/chart-card';
import {
  CostChart,
  DepartmentHeatmap,
  HocLevelChart,
  HorizontalCountChart,
  InjuryParetoChart,
  LeadingLaggingChart,
  MonthlyTrendChart,
  VerticalCountChart,
} from '@/components/dashboard/charts';
import { DashboardFilterBar } from '@/components/dashboard/dashboard-filters';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { buttonVariants } from '@/components/ui/button';
import { Callout, EmptyState } from '@/components/ui/callout';
import { loadDashboard, type DashboardFilters } from '@/lib/data/dashboard';
import { buildMetrics, PROGRAM_MATURITY_KEYS } from '@/lib/metrics/definitions';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

function parseFilters(params: Record<string, string | string[] | undefined>): DashboardFilters {
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? null;
  const isDate = (v: string | null) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
  const year = Number(first(params.year));

  return {
    year: Number.isFinite(year) && year > 1900 ? year : null,
    from: isDate(first(params.from)) ? first(params.from) : null,
    to: isDate(first(params.to)) ? first(params.to) : null,
    siteId: first(params.site),
    departmentId: first(params.department),
  };
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filters = parseFilters(params);

  const supabase = await createClient();
  const [data, { data: sites }, { data: departments }] = await Promise.all([
    loadDashboard(supabase, filters),
    supabase.from('sites').select('id, name').order('name'),
    supabase.from('departments').select('id, name, site_id').order('name'),
  ]);

  const metrics = buildMetrics(data.aggregate);
  const byKey = Object.fromEntries(metrics.map((m) => [m.key, m]));

  const rateKeys = ['trir', 'dart', 'ltifr', 'severity'];
  const counterKeys = ['days-since-lti', 'days-since-mti'];
  const programKeys = ['hazard-yield', 'near-miss-ratio', 'ca-closure', 'hoc-maturity'];

  const unclassified = data.aggregate.hocCounts.unclassified;
  const hasData = data.aggregate.totalIncidents > 0;

  const reportHref = `/dashboard/report?${new URLSearchParams(
    Object.entries(params).flatMap(([k, v]) =>
      v === undefined ? [] : [[k, Array.isArray(v) ? v[0] : v] as [string, string]],
    ),
  ).toString()}`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Incident Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {data.meta.from} to {data.meta.to}
            {data.meta.siteName ? ` · ${data.meta.siteName}` : ' · all sites'}
            {data.meta.departmentName ? ` · ${data.meta.departmentName}` : ''} ·{' '}
            {data.aggregate.totalIncidents.toLocaleString()} incidents
          </p>
        </div>
        <Link href={reportHref} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          Export report (PDF)
        </Link>
      </div>

      <DashboardFilterBar
        filters={{ ...filters, year: filters.year ?? data.meta.availableYears[0] }}
        sites={sites ?? []}
        departments={departments ?? []}
        availableYears={data.meta.availableYears}
      />

      {unclassified > 0 ? (
        <Callout
          tone="info"
          title={`${unclassified} corrective action${unclassified === 1 ? '' : 's'} not yet classified`}
          action={
            <Link
              href="/corrective-actions/needs-classification"
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              Classify them
            </Link>
          }
        >
          Assigning a control level is what turns a closed action into an auditable one. It also
          widens the base the maturity signal below is computed from.
        </Callout>
      ) : null}

      {!hasData ? (
        <EmptyState title="No incidents in this period">
          <p>Widen the date range, or import your history to see the dashboard populate.</p>
          <div className="mt-4 flex justify-center">
            <Link href="/incidents/import" className={buttonVariants({ size: 'sm' })}>
              Import a spreadsheet
            </Link>
          </div>
        </EmptyState>
      ) : (
        <>
          <section className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Regulatory rates
            </h2>
            <p className="text-xs text-muted-foreground">
              Actuals for the selected period. Nothing here is annualised, projected or
              extrapolated — a rate with no hours behind it shows an em dash rather than a zero.
            </p>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {rateKeys.map((key) => (
                <KpiCard key={key} metric={byKey[key]} badge="OSHA" />
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Program signals
            </h2>
            <p className="text-xs text-muted-foreground">
              Not compliance metrics and not regulatory rates — these describe how the program is
              behaving, and should never be reported as though a regulator defined them.
            </p>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {counterKeys.map((key) => (
                <KpiCard key={key} metric={byKey[key]} badge="Counter" />
              ))}
              {programKeys.map((key) => (
                <KpiCard
                  key={key}
                  metric={byKey[key]}
                  badge={PROGRAM_MATURITY_KEYS.has(key) ? 'Maturity' : undefined}
                />
              ))}
            </div>
          </section>

          <div className="grid gap-4 xl:grid-cols-2">
            <ChartCard
              className="xl:col-span-2"
              title="Monthly trend"
              description="Incident mix by month, with TRIR overlaid."
              footnote="The TRIR line breaks where hours have not been entered — it is never drawn to zero. The right-hand rate scale is an alignment chosen for readability, so where the line crosses the bars carries no meaning; read the stack for mix and the line for rate."
              tableHeaders={['Month', 'Recordable', 'First aid', 'Near miss', 'Property damage', 'Hours', 'TRIR']}
              tableRows={data.months.map((m) => [
                m.month,
                m.recordable,
                m.firstAid,
                m.nearMiss,
                m.propertyDamage,
                m.hours === null ? '—' : m.hours.toLocaleString(),
                m.trir === null ? '—' : m.trir.toFixed(2),
              ])}
            >
              <MonthlyTrendChart months={data.months} />
            </ChartCard>

            <ChartCard
              className="xl:col-span-2"
              title="Leading vs lagging"
              description="Activity above, outcomes below, on one time axis."
              footnote="Shown as two aligned panels rather than one plot: inspections run in the dozens while lost-time cases run in ones, and a shared scale would flatten the outcomes into the axis."
              tableHeaders={['Month', 'Inspections', 'Hazards', 'GEMBA', 'Trainings', 'Recordables', 'Lost time']}
              tableRows={data.months.map((m) => [
                m.month,
                m.inspections,
                m.hazardsReported,
                m.gembaWalks,
                m.trainings,
                m.recordable,
                m.lostTime,
              ])}
            >
              <LeadingLaggingChart months={data.months} />
            </ChartCard>

            <ChartCard
              className="xl:col-span-2"
              title="Corrective actions by hierarchy level"
              description="Where fixes are landing on the hierarchy of controls."
              footnote="Unclassified is its own segment and is never folded into a level. It sits outside the green ramp because it is the absence of a classification, not a position on the ladder."
              tableHeaders={['Control level', 'Rank', 'Actions', 'Share']}
              tableRows={(() => {
                const total = data.hocLevels.reduce((s, l) => s + l.count, 0);
                return data.hocLevels.map((l) => [
                  l.label,
                  l.rank ?? '—',
                  l.count,
                  total > 0 ? `${Math.round((l.count / total) * 100)}%` : '0%',
                ]);
              })()}
            >
              <HocLevelChart data={data.hocLevels} />
            </ChartCard>

            <ChartCard
              title="Injury type — Pareto"
              description="Counts descending, with cumulative share."
              tableHeaders={['Injury type', 'Cases', 'Cumulative']}
              tableRows={data.injuryPareto.map((p) => [
                p.label,
                p.count,
                `${p.cumulativePercent.toFixed(0)}%`,
              ])}
            >
              <InjuryParetoChart data={data.injuryPareto} />
            </ChartCard>

            <ChartCard
              title="Body part"
              description="Descending by case count."
              tableHeaders={['Body part', 'Cases']}
              tableRows={data.bodyParts.map((b) => [b.label, b.count])}
            >
              <HorizontalCountChart data={data.bodyParts.slice(0, 14)} />
            </ChartCard>

            <ChartCard
              title="Root cause category"
              tableHeaders={['Root cause', 'Cases']}
              tableRows={data.rootCauses.map((r) => [r.label, r.count])}
            >
              <VerticalCountChart data={data.rootCauses} />
            </ChartCard>

            <ChartCard
              title="Tenure at incident"
              description="How long the person had been with the company."
              footnote="A concentration in the first 90 days is a standard finding and usually points at onboarding and job-specific training rather than at the individuals."
              tableHeaders={['Tenure band', 'Cases']}
              tableRows={data.tenure.map((t) => [t.label, t.count])}
            >
              <VerticalCountChart data={data.tenure} />
            </ChartCard>

            <ChartCard
              className="xl:col-span-2"
              title="Department × incident type"
              tableHeaders={['Department', ...data.heatmap.types]}
              tableRows={data.heatmap.departments.map((d) => [
                d,
                ...data.heatmap.types.map((t) => data.heatmap.cells[d]?.[t] ?? 0),
              ])}
            >
              <DepartmentHeatmap data={data.heatmap} />
            </ChartCard>

            <ChartCard
              className="xl:col-span-2"
              title="Cost by department"
              description="Expected against actual to date."
              footnote="Actual cost to date is a running figure, not a final one — an open claim will keep moving."
              tableHeaders={['Department', 'Expected', 'Actual to date']}
              tableRows={data.costs.map((c) => [
                c.label,
                `$${c.expected.toLocaleString()}`,
                `$${c.actual.toLocaleString()}`,
              ])}
            >
              <CostChart data={data.costs} />
            </ChartCard>
          </div>
        </>
      )}

      {data.meta.truncated ? (
        <Callout tone="warning" title="Large result set">
          This period contains more incidents than the dashboard aggregates in one pass. Narrow the
          range for exact figures.
        </Callout>
      ) : null}
    </div>
  );
}
