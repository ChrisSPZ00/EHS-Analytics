import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/supabase/database.types';
import {
  DEFAULT_PAGE_SIZE,
  INCIDENT_CLASSIFICATIONS,
  INCIDENT_SORT_COLUMNS,
  INCIDENT_TYPES,
  PAGE_SIZE_OPTIONS,
  SEVERITY_RATINGS,
  SHIFTS,
  type IncidentClassification,
  type IncidentSortColumn,
  type IncidentType,
  type SeverityRating,
  type ShiftType,
} from '@/lib/domain/incidents';

export interface IncidentFilters {
  from: string | null;
  to: string | null;
  siteId: string | null;
  departmentId: string | null;
  types: IncidentType[];
  classifications: IncidentClassification[];
  shifts: ShiftType[];
  severities: SeverityRating[];
  search: string | null;
  sort: IncidentSortColumn;
  dir: 'asc' | 'desc';
  page: number;
  pageSize: number;
}

export type RawSearchParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? null;

const many = (v: string | string[] | undefined): string[] => {
  if (v === undefined) return [];
  const list = Array.isArray(v) ? v : [v];
  return list.flatMap((item) => item.split(',')).filter(Boolean);
};

const isDate = (v: string | null): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
const isUuid = (v: string | null): v is string =>
  !!v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

/** Anything unrecognised is dropped rather than passed through to the query. */
const keepKnown = <T extends string>(values: string[], allowed: readonly T[]): T[] =>
  values.filter((v): v is T => (allowed as readonly string[]).includes(v));

export function parseIncidentFilters(params: RawSearchParams): IncidentFilters {
  const from = first(params.from);
  const to = first(params.to);
  const sort = first(params.sort);
  const dir = first(params.dir);
  const page = Number(first(params.page) ?? '1');
  const pageSize = Number(first(params.pageSize) ?? DEFAULT_PAGE_SIZE);
  const search = first(params.q)?.trim() || null;

  return {
    from: isDate(from) ? from : null,
    to: isDate(to) ? to : null,
    siteId: isUuid(first(params.site)) ? first(params.site) : null,
    departmentId: isUuid(first(params.department)) ? first(params.department) : null,
    types: keepKnown(many(params.type), INCIDENT_TYPES),
    classifications: keepKnown(many(params.classification), INCIDENT_CLASSIFICATIONS),
    shifts: keepKnown(many(params.shift), SHIFTS),
    severities: keepKnown(many(params.severity), SEVERITY_RATINGS),
    search,
    sort: (INCIDENT_SORT_COLUMNS as readonly string[]).includes(sort ?? '')
      ? (sort as IncidentSortColumn)
      : 'incident_date',
    dir: dir === 'asc' ? 'asc' : 'desc',
    page: Number.isFinite(page) && page > 0 ? Math.floor(page) : 1,
    pageSize: (PAGE_SIZE_OPTIONS as readonly number[]).includes(pageSize)
      ? pageSize
      : DEFAULT_PAGE_SIZE,
  };
}

export function hasActiveFilters(f: IncidentFilters): boolean {
  return Boolean(
    f.from ||
      f.to ||
      f.siteId ||
      f.departmentId ||
      f.search ||
      f.types.length ||
      f.classifications.length ||
      f.shifts.length ||
      f.severities.length,
  );
}

/** Rebuilds the query string, dropping empties so URLs stay readable and shareable. */
export function filtersToSearchParams(
  f: Partial<IncidentFilters>,
  overrides: Record<string, string | number | null> = {},
): URLSearchParams {
  const p = new URLSearchParams();
  if (f.from) p.set('from', f.from);
  if (f.to) p.set('to', f.to);
  if (f.siteId) p.set('site', f.siteId);
  if (f.departmentId) p.set('department', f.departmentId);
  if (f.search) p.set('q', f.search);
  for (const t of f.types ?? []) p.append('type', t);
  for (const c of f.classifications ?? []) p.append('classification', c);
  for (const s of f.shifts ?? []) p.append('shift', s);
  for (const s of f.severities ?? []) p.append('severity', s);
  if (f.sort && f.sort !== 'incident_date') p.set('sort', f.sort);
  if (f.dir && f.dir !== 'desc') p.set('dir', f.dir);
  if (f.page && f.page > 1) p.set('page', String(f.page));
  if (f.pageSize && f.pageSize !== DEFAULT_PAGE_SIZE) p.set('pageSize', String(f.pageSize));

  for (const [key, value] of Object.entries(overrides)) {
    if (value === null || value === '') p.delete(key);
    else p.set(key, String(value));
  }
  return p;
}

/**
 * Applies the filters to `incidents_enriched`.
 *
 * No organization_id predicate appears anywhere here, deliberately: RLS scopes the view
 * to the caller's tenant. Adding a client-side org filter would imply the isolation is
 * the application's job, which is exactly the assumption that produced the last bug.
 */
export function applyIncidentFilters(
  supabase: SupabaseClient<Database>,
  filters: IncidentFilters,
  { count }: { count?: 'exact' } = {},
) {
  let query = supabase
    .from('incidents_enriched')
    .select('*', count ? { count } : undefined);

  if (filters.from) query = query.gte('incident_date', filters.from);
  if (filters.to) query = query.lte('incident_date', filters.to);
  if (filters.siteId) query = query.eq('site_id', filters.siteId);
  if (filters.departmentId) query = query.eq('department_id', filters.departmentId);
  if (filters.types.length) query = query.in('incident_type', filters.types);
  if (filters.classifications.length) query = query.in('classification', filters.classifications);
  if (filters.shifts.length) query = query.in('shift', filters.shifts);
  if (filters.severities.length) query = query.in('severity_rating', filters.severities);

  if (filters.search) {
    // Escape PostgREST's or() delimiters so a comma or paren in the term cannot alter
    // the filter structure.
    const term = filters.search.replace(/[,()\\]/g, ' ').trim();
    if (term) {
      query = query.or(
        [
          `description.ilike.%${term}%`,
          `root_cause_detail.ilike.%${term}%`,
          `injury_type.ilike.%${term}%`,
          `body_part.ilike.%${term}%`,
          `claim_ref.ilike.%${term}%`,
        ].join(','),
      );
    }
  }

  return query.order(filters.sort, { ascending: filters.dir === 'asc', nullsFirst: false });
}
