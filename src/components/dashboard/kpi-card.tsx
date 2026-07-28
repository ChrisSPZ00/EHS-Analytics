'use client';

import { useState } from 'react';

import { Callout } from '@/components/ui/callout';
import type { MetricResult } from '@/lib/metrics/definitions';
import { cn } from '@/lib/utils';

/**
 * A metric, with its working shown.
 *
 * The formula, the actual input values used, and the citation are all one click away on
 * every card — the "glass box, not black box" rule. The panel is a disclosure rather
 * than a hover tooltip so the content is reachable on touch and by keyboard, and so it
 * survives into the printed PDF report.
 */
export function KpiCard({
  metric,
  badge,
}: {
  metric: MetricResult;
  badge?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className={cn(
        'flex flex-col rounded-lg border border-border bg-card p-4',
        metric.muted && 'opacity-70',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {metric.title}
        </p>
        {badge ? (
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {badge}
          </span>
        ) : null}
      </div>

      {/* Proportional figures: tabular-nums makes a standalone number read loose. */}
      <p
        className={cn(
          'mt-1 text-3xl font-semibold',
          metric.value === null && 'text-muted-foreground',
        )}
      >
        {metric.display}
      </p>

      {/* Denominator / coverage always sits directly beneath the value. */}
      {metric.subtext ? (
        <p className="mt-1 text-xs text-muted-foreground">{metric.subtext}</p>
      ) : null}

      {metric.unavailable ? (
        <p className="mt-1 text-xs font-medium text-warning">{metric.unavailable}</p>
      ) : null}

      {metric.caution ? (
        <p className="mt-2 text-xs font-medium text-warning">{metric.caution}</p>
      ) : null}

      <div className="mt-auto pt-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="text-xs font-medium text-primary hover:underline"
        >
          {open ? 'Hide how this is calculated' : 'How is this calculated?'}
        </button>
      </div>

      {open ? (
        <div className="mt-3 space-y-3 border-t border-border pt-3 text-xs">
          <div>
            <p className="font-semibold uppercase tracking-wide text-muted-foreground">Formula</p>
            <p className="mt-1 font-mono">{metric.formula}</p>
          </div>

          {metric.substituted ? (
            <div>
              <p className="font-semibold uppercase tracking-wide text-muted-foreground">
                With this period&apos;s numbers
              </p>
              <p className="mt-1 font-mono">{metric.substituted}</p>
            </div>
          ) : null}

          <div>
            <p className="font-semibold uppercase tracking-wide text-muted-foreground">Inputs</p>
            <dl className="mt-1 space-y-1">
              {metric.inputs.map((input) => (
                <div key={input.label} className="flex flex-wrap justify-between gap-2">
                  <dt className="text-muted-foreground">
                    {input.label}
                    {input.source ? (
                      <span className="block text-[11px] opacity-80">{input.source}</span>
                    ) : null}
                  </dt>
                  <dd className="font-mono tabular-nums">{input.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {metric.citation ? (
            <div>
              <p className="font-semibold uppercase tracking-wide text-muted-foreground">
                Citation
              </p>
              <p className="mt-1">{metric.citation}</p>
            </div>
          ) : null}

          {metric.interpretation ? (
            <div>
              <p className="font-semibold uppercase tracking-wide text-muted-foreground">
                How to read it
              </p>
              <p className="mt-1 leading-relaxed">{metric.interpretation}</p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Printed variant: the working is always expanded, since a PDF cannot be clicked. */
export function KpiCardPrint({ metric }: { metric: MetricResult }) {
  return (
    <div className="break-inside-avoid rounded border border-border p-3 text-xs">
      <p className="font-semibold uppercase tracking-wide text-muted-foreground">{metric.title}</p>
      <p className="mt-0.5 text-xl font-semibold">{metric.display}</p>
      {metric.subtext ? <p className="text-[11px] text-muted-foreground">{metric.subtext}</p> : null}
      {metric.unavailable ? (
        <p className="text-[11px] font-medium text-warning">{metric.unavailable}</p>
      ) : null}
      <p className="mt-1 font-mono text-[11px]">{metric.substituted ?? metric.formula}</p>
      {metric.citation ? (
        <p className="mt-1 text-[11px] text-muted-foreground">{metric.citation}</p>
      ) : null}
    </div>
  );
}

export function MetricSectionNote({ children }: { children: React.ReactNode }) {
  return (
    <Callout tone="info" className="text-xs">
      {children}
    </Callout>
  );
}
