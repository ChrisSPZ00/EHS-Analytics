import Link from 'next/link';

import { IncidentFilterBar } from '@/components/incidents/incident-filter-bar';
import { IncidentTable } from '@/components/incidents/incident-table';
import { Pagination } from '@/components/incidents/pagination';
import { Button, buttonVariants } from '@/components/ui/button';
import { Callout, EmptyState } from '@/components/ui/callout';
import {
  applyIncidentFilters,
  hasActiveFilters,
  parseIncidentFilters,
  filtersToSearchParams,
  type RawSearchParams,
} from '@/lib/data/incident-filters';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function IncidentsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const params = await searchParams;
  const filters = parseIncidentFilters(params);
  const supabase = await createClient();

  const rangeFrom = (filters.page - 1) * filters.pageSize;
  const rangeTo = rangeFrom + filters.pageSize - 1;

  const [{ data: rows, count, error }, { data: sites }, { data: departments }, { data: orgRow }] =
    await Promise.all([
      applyIncidentFilters(supabase, filters, { count: 'exact' }).range(rangeFrom, rangeTo),
      supabase.from('sites').select('id, name').order('name'),
      supabase.from('departments').select('id, name, site_id').order('name'),
      supabase.from('organizations').select('anonymize_employees').maybeSingle(),
    ]);

  const total = count ?? 0;
  const anonymize = orgRow?.anonymize_employees ?? false;
  const filtered = hasActiveFilters(filters);

  const exportHref = `/incidents/export?${filtersToSearchParams(filters, {
    page: null,
    pageSize: null,
  }).toString()}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Incident Log</h1>
          <p className="text-sm text-muted-foreground">
            {total === 0
              ? 'No incidents match the current view.'
              : `${total.toLocaleString()} incident${total === 1 ? '' : 's'}${
                  filtered ? ' matching your filters' : ''
                }.`}
          </p>
        </div>
        <div className="flex gap-2">
          {total > 0 ? (
            <a
              href={exportHref}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              Export CSV
            </a>
          ) : null}
          <Link href="/incidents/import">
            <Button variant="outline" size="sm">
              Import
            </Button>
          </Link>
          <Link href="/incidents/new">
            <Button size="sm">Log an incident</Button>
          </Link>
        </div>
      </div>

      <IncidentFilterBar
        filters={filters}
        sites={sites ?? []}
        departments={departments ?? []}
      />

      {error ? (
        <Callout tone="danger" title="Could not load incidents">
          {error.message}
        </Callout>
      ) : total === 0 && !filtered ? (
        <EmptyState title="No incidents logged yet">
          <p>
            Most clients start by importing the spreadsheet they already keep — that brings
            their history across in one pass. You can also log a single incident by hand.
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <Link href="/incidents/import">
              <Button size="sm">Import a spreadsheet</Button>
            </Link>
            <Link href="/incidents/new">
              <Button size="sm" variant="outline">
                Log an incident
              </Button>
            </Link>
          </div>
        </EmptyState>
      ) : total === 0 ? (
        <EmptyState title="No incidents match these filters">
          <p>Try widening the date range or clearing a filter.</p>
        </EmptyState>
      ) : (
        <>
          <IncidentTable rows={rows ?? []} filters={filters} anonymize={anonymize} />
          <Pagination
            page={filters.page}
            pageSize={filters.pageSize}
            total={total}
            filters={filters}
          />
        </>
      )}
    </div>
  );
}
