import Link from 'next/link';

import {
  complianceFiltersToSearchParams,
  complianceRange,
  type ComplianceFilters,
} from '@/lib/data/compliance-filters';
import { addMonths, today } from '@/lib/domain/compliance';
import { cn } from '@/lib/utils';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const monthLabel = (month: string) =>
  `${MONTH_NAMES[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;

const tab =
  'rounded-md px-3 py-1.5 text-sm font-medium transition-colors border border-transparent';

/** Calendar / list / register. The three ways an EHS manager looks at the same set. */
export function ComplianceNav({ filters }: { filters: ComplianceFilters }) {
  const calendarHref = `/compliance?${complianceFiltersToSearchParams({
    ...filters,
    view: 'calendar',
  }).toString()}`;
  const listHref = `/compliance?${complianceFiltersToSearchParams({
    ...filters,
    view: 'list',
  }).toString()}`;

  return (
    <nav className="flex flex-wrap items-center gap-1 border-b border-border pb-2">
      <Link
        href={calendarHref}
        aria-current={filters.view === 'calendar' ? 'page' : undefined}
        className={cn(tab, filters.view === 'calendar' ? 'border-border bg-muted' : 'text-muted-foreground hover:bg-muted')}
      >
        Month
      </Link>
      <Link
        href={listHref}
        aria-current={filters.view === 'list' ? 'page' : undefined}
        className={cn(tab, filters.view === 'list' ? 'border-border bg-muted' : 'text-muted-foreground hover:bg-muted')}
      >
        Ahead
      </Link>
      <span aria-hidden className="mx-1 h-5 w-px bg-border" />
      <Link href="/compliance/register" className={cn(tab, 'text-muted-foreground hover:bg-muted')}>
        Obligation register
      </Link>
    </nav>
  );
}

/**
 * Month stepper for the grid, or the range for the look-ahead list. Both write to the
 * URL, so a particular month is a link somebody can send to a colleague.
 */
export function MonthNav({ filters }: { filters: ComplianceFilters }) {
  const range = complianceRange(filters);

  if (filters.view === 'list') {
    return (
      <p className="text-sm text-muted-foreground">
        Everything due between <span className="tabular-nums">{range.from}</span> and{' '}
        <span className="tabular-nums">{range.to}</span>.
      </p>
    );
  }

  const previous = addMonths(`${filters.month}-01`, -1).slice(0, 7);
  const next = addMonths(`${filters.month}-01`, 1).slice(0, 7);
  const thisMonth = today().slice(0, 7);

  const href = (month: string) =>
    `/compliance?${complianceFiltersToSearchParams({ ...filters, month }).toString()}`;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-base font-semibold">{monthLabel(filters.month)}</h2>
      <div className="flex items-center gap-1">
        <Link href={href(previous)} className={cn(tab, 'border-border hover:bg-muted')}>
          ← {monthLabel(previous)}
        </Link>
        {filters.month === thisMonth ? null : (
          <Link href={href(thisMonth)} className={cn(tab, 'border-border hover:bg-muted')}>
            This month
          </Link>
        )}
        <Link href={href(next)} className={cn(tab, 'border-border hover:bg-muted')}>
          {monthLabel(next)} →
        </Link>
      </div>
    </div>
  );
}
