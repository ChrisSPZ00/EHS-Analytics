'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { HocBadge } from '@/components/hierarchy-of-controls/hoc-badge';
import type {
  CostPoint,
  CountPoint,
  HeatmapData,
  HocLevelPoint,
  MonthPoint,
  ParetoPoint,
} from '@/lib/data/dashboard';
import { cn } from '@/lib/utils';

/* --------------------------------------------------------------------------
 * Shared chrome
 *
 * Gridlines and axes are solid hairlines one shade off the surface — never dashed,
 * which reads as "threshold" when it is just a grid. Stacked fills are separated by a
 * gap in the surface colour rather than by a border.
 * -------------------------------------------------------------------------- */

const AXIS = { stroke: 'var(--chart-axis)', fontSize: 11, tickLine: false } as const;
const GRID = { stroke: 'var(--chart-grid)', strokeDasharray: '0' } as const;
const SURFACE_GAP = { stroke: 'var(--chart-surface)', strokeWidth: 1.5 } as const;

const SERIES = {
  recordable: 'var(--chart-1)',
  firstAid: 'var(--chart-2)',
  nearMiss: 'var(--chart-3)',
  propertyDamage: 'var(--chart-4)',
} as const;

function TooltipBox({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number | null; color?: string; dataKey?: string }[];
  label?: string | number;
  formatter?: (value: number | null, name: string) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-card px-2.5 py-2 text-xs shadow-sm">
      <p className="mb-1 font-medium">{label}</p>
      <ul className="space-y-0.5">
        {payload.map((entry, i) => (
          <li key={i} className="flex items-center gap-2">
            <span
              aria-hidden
              className="h-2 w-2 shrink-0 rounded-sm"
              style={{ background: entry.color }}
            />
            <span className="text-muted-foreground">{entry.name}</span>
            <span className="ml-auto font-medium tabular-nums">
              {formatter
                ? formatter(entry.value ?? null, entry.name ?? '')
                : (entry.value ?? '—')}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const shortMonth = (m: string) => `${m.slice(5)}/${m.slice(2, 4)}`;

/* --------------------------------------------------------------------------
 * Monthly trend
 * -------------------------------------------------------------------------- */

/**
 * Stacked monthly counts with TRIR overlaid on a secondary axis, as specified.
 *
 * Worth knowing: a second y-scale is an alignment chosen by the chart, not present in
 * the data, so the crossing points carry no meaning. The stack answers "what is the mix"
 * and the line answers "where is the rate going"; read them as two answers, not as a
 * correlation. Months with no hours entered leave a GAP in the line rather than dropping
 * it to zero.
 */
export function MonthlyTrendChart({ months }: { months: MonthPoint[] }) {
  const data = months.map((m) => ({ ...m, short: shortMonth(m.month) }));

  return (
    <ResponsiveContainer width="100%" height={320}>
      <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
        <CartesianGrid {...GRID} vertical={false} />
        <XAxis dataKey="short" {...AXIS} />
        <YAxis {...AXIS} allowDecimals={false} width={36} />
        <YAxis yAxisId="rate" orientation="right" {...AXIS} width={44} />
        <Tooltip
          content={<TooltipBox formatter={(v, n) => (v === null ? '—' : n === 'TRIR' ? v.toFixed(2) : String(v))} />}
          cursor={{ fill: 'var(--chart-grid)', opacity: 0.35 }}
        />
        <Legend iconType="square" wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
        <Bar dataKey="recordable" stackId="a" name="Recordable" fill={SERIES.recordable} {...SURFACE_GAP} />
        <Bar dataKey="firstAid" stackId="a" name="First aid" fill={SERIES.firstAid} {...SURFACE_GAP} />
        <Bar dataKey="nearMiss" stackId="a" name="Near miss" fill={SERIES.nearMiss} {...SURFACE_GAP} />
        <Bar
          dataKey="propertyDamage"
          stackId="a"
          name="Property damage"
          fill={SERIES.propertyDamage}
          radius={[4, 4, 0, 0]}
          {...SURFACE_GAP}
        />
        <Line
          yAxisId="rate"
          type="monotone"
          dataKey="trir"
          name="TRIR"
          stroke="var(--foreground)"
          strokeWidth={2}
          dot={{ r: 3 }}
          connectNulls={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/* --------------------------------------------------------------------------
 * Leading vs lagging
 * -------------------------------------------------------------------------- */

/**
 * Two panels sharing one time axis rather than six lines on one plot.
 *
 * Leading and lagging activity differ by an order of magnitude — inspections run in the
 * dozens, lost-time cases in ones — so a shared scale would flatten the lagging series
 * into the axis. Aligned panels keep both readable and keep the comparison honest.
 */
export function LeadingLaggingChart({ months }: { months: MonthPoint[] }) {
  const data = months.map((m) => ({ ...m, short: shortMonth(m.month) }));

  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Leading — activity
      </p>
      <ResponsiveContainer width="100%" height={190}>
        <LineChart data={data} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid {...GRID} vertical={false} />
          <XAxis dataKey="short" {...AXIS} tick={false} height={4} />
          <YAxis {...AXIS} allowDecimals={false} width={36} />
          <Tooltip content={<TooltipBox />} />
          <Legend iconType="plainline" wrapperStyle={{ fontSize: 11 }} />
          <Line type="monotone" dataKey="inspections" name="Inspections" stroke="var(--chart-1)" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="hazardsReported" name="Hazards reported" stroke="var(--chart-2)" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="gembaWalks" name="GEMBA walks" stroke="var(--chart-3)" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="trainings" name="Trainings" stroke="var(--chart-4)" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>

      <p className="pt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Lagging — outcomes
      </p>
      <ResponsiveContainer width="100%" height={170}>
        <LineChart data={data} margin={{ top: 4, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid {...GRID} vertical={false} />
          <XAxis dataKey="short" {...AXIS} />
          <YAxis {...AXIS} allowDecimals={false} width={36} />
          <Tooltip content={<TooltipBox />} />
          <Legend iconType="plainline" wrapperStyle={{ fontSize: 11 }} />
          <Line type="monotone" dataKey="recordable" name="Recordables" stroke="var(--chart-1)" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="lostTime" name="Lost time" stroke="var(--chart-2)" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/* --------------------------------------------------------------------------
 * Pareto
 * -------------------------------------------------------------------------- */

/** Counts descending with the cumulative share overlaid — the standard Pareto form. */
export function InjuryParetoChart({ data }: { data: ParetoPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 56, left: 0 }}>
        <CartesianGrid {...GRID} vertical={false} />
        <XAxis dataKey="label" {...AXIS} angle={-40} textAnchor="end" interval={0} height={56} />
        <YAxis {...AXIS} allowDecimals={false} width={36} />
        <YAxis
          yAxisId="pct"
          orientation="right"
          domain={[0, 100]}
          tickFormatter={(v) => `${v}%`}
          {...AXIS}
          width={44}
        />
        <Tooltip
          content={<TooltipBox formatter={(v, n) => (v === null ? '—' : n === 'Cumulative' ? `${v.toFixed(0)}%` : String(v))} />}
          cursor={{ fill: 'var(--chart-grid)', opacity: 0.35 }}
        />
        <Bar dataKey="count" name="Cases" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
        <Line
          yAxisId="pct"
          type="monotone"
          dataKey="cumulativePercent"
          name="Cumulative"
          stroke="var(--foreground)"
          strokeWidth={2}
          dot={{ r: 3 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/* --------------------------------------------------------------------------
 * Single-series bars
 * -------------------------------------------------------------------------- */

/** One series, one colour. Never a value-ramp — bar length already encodes magnitude. */
export function HorizontalCountChart({
  data,
  height = 320,
}: {
  data: CountPoint[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 32, bottom: 4, left: 8 }}>
        <CartesianGrid {...GRID} horizontal={false} />
        <XAxis type="number" {...AXIS} allowDecimals={false} />
        <YAxis type="category" dataKey="label" {...AXIS} width={110} />
        <Tooltip content={<TooltipBox />} cursor={{ fill: 'var(--chart-grid)', opacity: 0.35 }} />
        <Bar dataKey="count" name="Cases" fill="var(--chart-1)" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function VerticalCountChart({ data }: { data: CountPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 48, left: 0 }}>
        <CartesianGrid {...GRID} vertical={false} />
        <XAxis dataKey="label" {...AXIS} angle={-30} textAnchor="end" interval={0} height={48} />
        <YAxis {...AXIS} allowDecimals={false} width={36} />
        <Tooltip content={<TooltipBox />} cursor={{ fill: 'var(--chart-grid)', opacity: 0.35 }} />
        <Bar dataKey="count" name="Cases" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* --------------------------------------------------------------------------
 * Cost
 * -------------------------------------------------------------------------- */

export function CostChart({ data }: { data: CostPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 48, left: 8 }}>
        <CartesianGrid {...GRID} vertical={false} />
        <XAxis dataKey="label" {...AXIS} angle={-30} textAnchor="end" interval={0} height={48} />
        <YAxis {...AXIS} width={64} tickFormatter={(v) => `$${Number(v).toLocaleString()}`} />
        <Tooltip
          content={<TooltipBox formatter={(v) => (v === null ? '—' : `$${v.toLocaleString()}`)} />}
          cursor={{ fill: 'var(--chart-grid)', opacity: 0.35 }}
        />
        <Legend iconType="square" wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="expected" name="Expected" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="actual" name="Actual to date" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* --------------------------------------------------------------------------
 * Department heatmap
 * -------------------------------------------------------------------------- */

/**
 * Plain HTML rather than a charting library: a grid of counts is a table, and building
 * it as one means the numbers are present in the cells instead of encoded only as
 * colour.
 */
export function DepartmentHeatmap({ data }: { data: HeatmapData }) {
  const step = (value: number) => {
    if (value === 0 || data.max === 0) return 'transparent';
    const ratio = value / data.max;
    if (ratio <= 0.2) return 'var(--chart-seq-100)';
    if (ratio <= 0.4) return 'var(--chart-seq-250)';
    if (ratio <= 0.6) return 'var(--chart-seq-400)';
    if (ratio <= 0.8) return 'var(--chart-seq-550)';
    return 'var(--chart-seq-700)';
  };

  // The two darkest steps need light text to stay legible.
  const ink = (value: number) =>
    data.max > 0 && value / data.max > 0.6 ? '#ffffff' : 'var(--foreground)';

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-0.5 text-sm">
        <thead>
          <tr>
            <th className="px-2 py-1 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Department
            </th>
            {data.types.map((type) => (
              <th
                key={type}
                className="px-2 py-1 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                {type}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.departments.map((dept) => (
            <tr key={dept}>
              <td className="whitespace-nowrap px-2 py-1 font-medium">{dept}</td>
              {data.types.map((type) => {
                const value = data.cells[dept]?.[type] ?? 0;
                return (
                  <td
                    key={type}
                    className="rounded px-2 py-1 text-center tabular-nums"
                    style={{ background: step(value), color: ink(value) }}
                    title={`${dept} · ${type}: ${value}`}
                  >
                    {value || '·'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <span>Fewer</span>
        {['100', '250', '400', '550', '700'].map((s) => (
          <span
            key={s}
            aria-hidden
            className="h-3 w-6 rounded-sm"
            style={{ background: `var(--chart-seq-${s})` }}
          />
        ))}
        <span>More</span>
        <span className="ml-2">(peak {data.max})</span>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------------
 * Corrective actions by hierarchy level
 * -------------------------------------------------------------------------- */

const HOC_FILL: Record<number, string> = {
  0: 'var(--hoc-0-bg)',
  1: 'var(--hoc-1-bg)',
  2: 'var(--hoc-2-bg)',
  3: 'var(--hoc-3-bg)',
  4: 'var(--hoc-4-bg)',
  5: 'var(--hoc-5-bg)',
};

/**
 * Stacked horizontal bar across the six control tokens.
 *
 * Unclassified is always its own grey segment — never omitted, never folded into a
 * level — and sits outside the green ramp so it cannot read as a rung on the ladder.
 *
 * The ramp is a deliberate exception to the usual categorical colour rules: it is a
 * single-hue ordinal scale, which is not separable under red-green colour vision
 * deficiency, and its palest steps sit close to the page. Both are mitigated the same
 * way the spec requires — every segment is labelled, the legend carries rank and label
 * text, a surface-coloured gap gives the pale steps a visible edge, and the table view
 * holds every number.
 */
export function HocLevelChart({ data }: { data: HocLevelPoint[] }) {
  const total = data.reduce((sum, d) => sum + d.count, 0);
  if (total === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">No corrective actions in this period.</p>;
  }

  const row = Object.fromEntries(data.map((d) => [d.label, d.count]));

  return (
    <div className="space-y-4">
      <ResponsiveContainer width="100%" height={110}>
        <BarChart data={[row]} layout="vertical" margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <XAxis type="number" hide />
          <YAxis type="category" hide />
          <Tooltip
            content={<TooltipBox formatter={(v) => `${v} action${v === 1 ? '' : 's'}`} />}
            cursor={{ fill: 'transparent' }}
          />
          {data.map((level, i) => (
            <Bar
              key={level.label}
              dataKey={level.label}
              stackId="hoc"
              name={level.rank === null ? '— · Unclassified' : `${level.rank} · ${level.label}`}
              fill={HOC_FILL[level.token]}
              {...SURFACE_GAP}
              radius={i === 0 ? [4, 0, 0, 4] : i === data.length - 1 ? [0, 4, 4, 0] : 0}
            >
              <Cell fill={HOC_FILL[level.token]} />
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>

      {/* Legend carries rank + label text, so colour never has to be decoded alone. */}
      <ul className="flex flex-wrap gap-x-4 gap-y-2">
        {data.map((level) => (
          <li key={level.label} className="flex items-center gap-2 text-xs">
            <HocBadge
              value={
                level.rank === null
                  ? null
                  : (['elimination', 'substitution', 'engineering', 'administrative', 'ppe'][
                      level.rank - 1
                    ] as never)
              }
              density="dense"
            />
            <span className={cn('tabular-nums', level.count === 0 && 'text-muted-foreground')}>
              {level.count} ({total > 0 ? Math.round((level.count / total) * 100) : 0}%)
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
