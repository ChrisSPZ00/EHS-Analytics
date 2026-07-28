'use client';

import { useState } from 'react';

import { Table, TableWrap, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { cn } from '@/lib/utils';

/**
 * Every chart ships a table-view twin.
 *
 * Two reasons, both required rather than nice-to-have: a tooltip must never be the only
 * way to read a value, and several of our series sit below 3:1 against the surface, which
 * obligates a WCAG-clean equivalent.
 */
export function ChartCard({
  title,
  description,
  footnote,
  tableHeaders,
  tableRows,
  children,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  footnote?: React.ReactNode;
  tableHeaders: string[];
  tableRows: (string | number)[][];
  children: React.ReactNode;
  className?: string;
}) {
  const [view, setView] = useState<'chart' | 'table'>('chart');

  return (
    <section className={cn('rounded-lg border border-border bg-card', className)}>
      <header className="flex flex-wrap items-start justify-between gap-2 border-b border-border p-4">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 rounded-md border border-border p-0.5" role="group">
          {(['chart', 'table'] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setView(option)}
              aria-pressed={view === option}
              className={cn(
                'rounded px-2 py-1 text-xs font-medium capitalize transition-colors',
                view === option
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {option}
            </button>
          ))}
        </div>
      </header>

      <div className="p-4">
        {view === 'chart' ? (
          tableRows.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No data for this period.
            </p>
          ) : (
            children
          )
        ) : (
          <TableWrap>
            <Table>
              <THead>
                <TR>
                  {tableHeaders.map((h, i) => (
                    <TH key={h} className={i > 0 ? 'text-right' : undefined}>
                      {h}
                    </TH>
                  ))}
                </TR>
              </THead>
              <TBody>
                {tableRows.map((row, i) => (
                  <TR key={i}>
                    {row.map((cell, j) => (
                      <TD key={j} className={j > 0 ? 'text-right tabular-nums' : undefined}>
                        {cell}
                      </TD>
                    ))}
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableWrap>
        )}

        {footnote ? (
          <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
            {footnote}
          </p>
        ) : null}
      </div>
    </section>
  );
}
