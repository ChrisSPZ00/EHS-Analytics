import Link from 'next/link';

import type { ComplianceEventRow } from '@/lib/data/compliance';
import { groupEventsByDate, monthGrid } from '@/lib/data/compliance';
import { today, type DueState } from '@/lib/domain/compliance';
import { cn } from '@/lib/utils';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * Each entry keeps a coloured rule down its left edge and its text. The rule is
 * reinforcement: the obligation is named in the cell, the state is spelled out in the
 * accessible label, and the table below holds every field. Nothing on this grid is
 * reachable by colour alone.
 */
const RULE: Record<DueState, string> = {
  Overdue: 'border-l-danger bg-danger-bg/60',
  'Due soon': 'border-l-warning bg-warning-bg/60',
  Upcoming: 'border-l-border bg-muted',
  Complete: 'border-l-success bg-success-bg/60',
};

export function MonthCalendar({
  month,
  events,
}: {
  month: string;
  events: ComplianceEventRow[];
}) {
  const grid = monthGrid(month);
  const byDate = groupEventsByDate(events);
  const now = today();

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="grid grid-cols-7 border-b border-border bg-muted/60">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {grid.map(({ date, inMonth }) => {
          const dayEvents = byDate.get(date) ?? [];
          return (
            <div
              key={date}
              className={cn(
                'min-h-24 border-b border-r border-border p-1.5 last:border-r-0',
                !inMonth && 'bg-muted/40',
              )}
            >
              <div className="flex items-baseline justify-between">
                <span
                  className={cn(
                    'text-xs tabular-nums',
                    inMonth ? 'text-foreground' : 'text-muted-foreground',
                    date === now && 'rounded bg-primary px-1.5 py-0.5 font-semibold text-primary-foreground',
                  )}
                >
                  {Number(date.slice(8, 10))}
                </span>
                {date === now ? (
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Today
                  </span>
                ) : null}
              </div>

              <ul className="mt-1 space-y-1">
                {dayEvents.slice(0, 3).map((event) => (
                  <li key={event.id}>
                    <Link
                      href={`/compliance/obligations/${event.obligation_id}#event-${event.id}`}
                      className={cn(
                        'block rounded-sm border-l-2 px-1.5 py-1 text-[11px] leading-tight hover:underline',
                        RULE[(event.state ?? 'Upcoming') as DueState] ?? RULE.Upcoming,
                      )}
                    >
                      <span className="line-clamp-2">{event.obligation}</span>
                      <span className="sr-only"> — {event.state}</span>
                      {event.is_verified === false ? (
                        <span className="mt-0.5 block text-[10px] font-medium text-warning">
                          Unverified
                        </span>
                      ) : null}
                    </Link>
                  </li>
                ))}
                {dayEvents.length > 3 ? (
                  <li className="px-1.5 text-[11px] text-muted-foreground">
                    +{dayEvents.length - 3} more — see the table below
                  </li>
                ) : null}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
