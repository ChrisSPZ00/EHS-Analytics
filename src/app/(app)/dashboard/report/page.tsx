import Link from 'next/link';

import {
  CostChart,
  DepartmentHeatmap,
  HocLevelChart,
  HorizontalCountChart,
  InjuryParetoChart,
  MonthlyTrendChart,
  VerticalCountChart,
} from '@/components/dashboard/charts';
import { KpiCardPrint } from '@/components/dashboard/kpi-card';
import { PrintButton } from '@/components/dashboard/print-button';
import { buttonVariants } from '@/components/ui/button';
import { loadDashboard, type DashboardFilters } from '@/lib/data/dashboard';
import { buildMetrics } from '@/lib/metrics/definitions';
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

function Panel({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="break-inside-avoid rounded-lg border border-border p-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      {note ? <p className="mt-0.5 text-xs text-muted-foreground">{note}</p> : null}
      <div className="mt-3">{children}</div>
    </section>
  );
}

export default async function DashboardReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filters = parseFilters(params);

  const supabase = await createClient();
  const data = await loadDashboard(supabase, filters);
  const metrics = buildMetrics(data.aggregate);

  const generated = new Date().toISOString().replace('T', ' ').slice(0, 16);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <Link
          href={`/dashboard?${new URLSearchParams(
            Object.entries(params).flatMap(([k, v]) =>
              v === undefined ? [] : [[k, Array.isArray(v) ? v[0] : v] as [string, string]],
            ),
          ).toString()}`}
          className={buttonVariants({ variant: 'ghost', size: 'sm' })}
        >
          Back to dashboard
        </Link>
        <PrintButton />
      </div>

      {/* Header block: who, where, over what period, generated when. */}
      <header className="break-inside-avoid rounded-lg border border-border p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Incident performance report
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{data.meta.orgName}</h1>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Site</dt>
            <dd>{data.meta.siteName ?? 'All sites'}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Department</dt>
            <dd>{data.meta.departmentName ?? 'All departments'}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">
              Reporting period
            </dt>
            <dd>
              {data.meta.from} to {data.meta.to}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Generated</dt>
            <dd>{generated} UTC</dd>
          </div>
        </dl>
        <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
          All figures are actuals for the period shown. Nothing is annualised, projected or
          extrapolated. Where hours worked have not been entered, rates are shown as an em dash
          rather than as zero. Each figure below carries the formula and the inputs it was
          computed from.
        </p>
      </header>

      <section className="break-inside-avoid">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Metrics
        </h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {metrics.map((metric) => (
            <KpiCardPrint key={metric.key} metric={metric} />
          ))}
        </div>
      </section>

      <Panel title="Monthly trend" note="Incident mix by month, with TRIR overlaid.">
        <MonthlyTrendChart months={data.months} />
      </Panel>

      <Panel
        title="Corrective actions by hierarchy level"
        note="Unclassified is shown as its own segment, never folded into a level."
      >
        <HocLevelChart data={data.hocLevels} />
      </Panel>

      <Panel title="Injury type — Pareto">
        <InjuryParetoChart data={data.injuryPareto} />
      </Panel>

      <Panel title="Body part">
        <HorizontalCountChart data={data.bodyParts.slice(0, 14)} />
      </Panel>

      <Panel title="Root cause category">
        <VerticalCountChart data={data.rootCauses} />
      </Panel>

      <Panel
        title="Tenure at incident"
        note="A concentration in the first 90 days usually points at onboarding and job-specific training."
      >
        <VerticalCountChart data={data.tenure} />
      </Panel>

      <Panel title="Department × incident type">
        <DepartmentHeatmap data={data.heatmap} />
      </Panel>

      <Panel title="Cost by department" note="Actual cost to date is a running figure, not final.">
        <CostChart data={data.costs} />
      </Panel>

      <footer className="break-inside-avoid border-t border-border pt-3 text-xs text-muted-foreground">
        <p>
          Generated by SafePulse Analytics for {data.meta.orgName}. Rate definitions follow OSHA
          29 CFR 1904. Program signals (hazard yield, near miss ratio, control-level maturity) are
          not regulatory measures and should not be reported as though they were.
        </p>
      </footer>
    </div>
  );
}
