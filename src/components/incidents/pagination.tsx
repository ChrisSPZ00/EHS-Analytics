import Link from 'next/link';

import { buttonVariants } from '@/components/ui/button';
import { filtersToSearchParams, type IncidentFilters } from '@/lib/data/incident-filters';
import { PAGE_SIZE_OPTIONS } from '@/lib/domain/incidents';
import { cn } from '@/lib/utils';

/** Server-side pagination: the page never holds more than one page of rows in memory. */
export function Pagination({
  page,
  pageSize,
  total,
  filters,
}: {
  page: number;
  pageSize: number;
  total: number;
  filters: IncidentFilters;
}) {
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  const firstRow = (page - 1) * pageSize + 1;
  const lastRow = Math.min(page * pageSize, total);

  const href = (targetPage: number) =>
    `/incidents?${filtersToSearchParams(filters, { page: targetPage }).toString()}`;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <p className="text-muted-foreground">
        Showing <span className="tabular-nums">{firstRow.toLocaleString()}</span>–
        <span className="tabular-nums">{lastRow.toLocaleString()}</span> of{' '}
        <span className="tabular-nums">{total.toLocaleString()}</span>
      </p>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground">Per page</span>
          {PAGE_SIZE_OPTIONS.map((size) => (
            <Link
              key={size}
              href={`/incidents?${filtersToSearchParams(filters, {
                pageSize: size,
                page: null,
              }).toString()}`}
              className={cn(
                'rounded px-2 py-1 tabular-nums',
                size === pageSize ? 'bg-muted font-medium' : 'text-muted-foreground hover:bg-muted/60',
              )}
            >
              {size}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-1">
          {page > 1 ? (
            <Link href={href(page - 1)} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              Previous
            </Link>
          ) : (
            <span className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'opacity-40')}>
              Previous
            </span>
          )}
          <span className="px-2 text-muted-foreground tabular-nums">
            {page} / {lastPage}
          </span>
          {page < lastPage ? (
            <Link href={href(page + 1)} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              Next
            </Link>
          ) : (
            <span className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'opacity-40')}>
              Next
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
