import Link from 'next/link';

import { Table, TableWrap, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { filtersToSearchParams, type IncidentFilters } from '@/lib/data/incident-filters';
import type { IncidentSortColumn } from '@/lib/domain/incidents';
import type { Database } from '@/lib/supabase/database.types';
import { cn } from '@/lib/utils';

type Row = Database['public']['Views']['incidents_enriched']['Row'];

const COLUMNS: { key: IncidentSortColumn | null; label: string; className?: string }[] = [
  { key: 'incident_date', label: 'Date' },
  { key: 'site_name', label: 'Site' },
  { key: 'department_name', label: 'Department' },
  { key: null, label: 'Employee' },
  { key: 'incident_type', label: 'Type' },
  { key: 'classification', label: 'Class' },
  { key: null, label: 'Injury' },
  { key: null, label: 'Body part' },
  { key: 'severity_rating', label: 'Severity' },
  { key: 'days_away', label: 'Away', className: 'text-right' },
  { key: null, label: 'Restricted', className: 'text-right' },
];

export function IncidentTable({
  rows,
  filters,
  anonymize,
}: {
  rows: Row[];
  filters: IncidentFilters;
  anonymize: boolean;
}) {
  return (
    <TableWrap>
      <Table>
        <THead>
          <TR>
            {COLUMNS.map((col) => (
              <TH key={col.label} className={col.className}>
                {col.key ? (
                  <SortLink column={col.key} label={col.label} filters={filters} />
                ) : (
                  col.label
                )}
              </TH>
            ))}
          </TR>
        </THead>
        <TBody>
          {rows.map((row) => (
            <TR key={row.id} className="hover:bg-muted/40">
              <TD className="whitespace-nowrap font-medium">
                <Link href={`/incidents/${row.id}`} className="text-primary hover:underline">
                  {row.incident_date}
                </Link>
              </TD>
              <TD className="whitespace-nowrap">{row.site_name ?? '—'}</TD>
              <TD className="whitespace-nowrap">{row.department_name ?? '—'}</TD>
              <TD className="whitespace-nowrap">
                {/*
                  The view already applies anonymize_employees; the flag is passed only so
                  the column header reads honestly when names are suppressed.
                */}
                {row.employee_display ?? (anonymize ? row.employee_ref ?? '—' : '—')}
              </TD>
              <TD className="whitespace-nowrap">{row.incident_type}</TD>
              <TD className="whitespace-nowrap">{row.classification ?? '—'}</TD>
              <TD className="whitespace-nowrap">{row.injury_type ?? '—'}</TD>
              <TD className="whitespace-nowrap">{row.body_part ?? '—'}</TD>
              <TD className="whitespace-nowrap">{row.severity_rating ?? '—'}</TD>
              <TD className="text-right tabular-nums">{row.days_away ?? 0}</TD>
              <TD className="text-right tabular-nums">{row.days_restricted ?? 0}</TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </TableWrap>
  );
}

function SortLink({
  column,
  label,
  filters,
}: {
  column: IncidentSortColumn;
  label: string;
  filters: IncidentFilters;
}) {
  const isActive = filters.sort === column;
  const nextDir = isActive && filters.dir === 'desc' ? 'asc' : 'desc';
  const params = filtersToSearchParams(filters, { sort: column, dir: nextDir, page: null });

  return (
    <Link
      href={`/incidents?${params.toString()}`}
      className={cn(
        'inline-flex items-center gap-1 hover:text-foreground',
        isActive && 'text-foreground',
      )}
      aria-sort={isActive ? (filters.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      {label}
      <span aria-hidden className={cn('text-[10px]', !isActive && 'opacity-30')}>
        {isActive ? (filters.dir === 'asc' ? '▲' : '▼') : '▼'}
      </span>
    </Link>
  );
}
