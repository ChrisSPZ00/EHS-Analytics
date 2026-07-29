import type { SupabaseClient } from '@supabase/supabase-js';

import {
  DUE_STATES,
  JURISDICTIONS,
  addMonths,
  today,
  type DueState,
  type Jurisdiction,
} from '@/lib/domain/compliance';
import type { Database } from '@/lib/supabase/database.types';

export type ComplianceView = 'calendar' | 'list';

export interface ComplianceFilters {
  /** Calendar view: the month on screen, as YYYY-MM. */
  month: string;
  /** List view: an explicit range, defaulting to the next quarter. */
  from: string | null;
  to: string | null;
  view: ComplianceView;
  siteId: string | null;
  /** Organisation-wide obligations only (site_id IS NULL). */
  orgWideOnly: boolean;
  jurisdictions: Jurisdiction[];
  states: DueState[];
  programArea: string | null;
  unverifiedOnly: boolean;
  search: string | null;
}

export type RawSearchParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? null;

const many = (v: string | string[] | undefined): string[] => {
  if (v === undefined) return [];
  const list = Array.isArray(v) ? v : [v];
  return list.flatMap((item) => item.split(',')).filter(Boolean);
};

const isDate = (v: string | null): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
const isMonth = (v: string | null): v is string => !!v && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
const isUuid = (v: string | null): v is string =>
  !!v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

/** Anything unrecognised is dropped rather than passed through to the query. */
const keepKnown = <T extends string>(values: string[], allowed: readonly T[]): T[] =>
  values.filter((v): v is T => (allowed as readonly string[]).includes(v));

/** The list view's default horizon: the quarter ahead, which is what a monthly review looks at. */
export const DEFAULT_LIST_HORIZON_MONTHS = 3;

export function parseComplianceFilters(params: RawSearchParams): ComplianceFilters {
  const month = first(params.month);
  const from = first(params.from);
  const to = first(params.to);
  const view = first(params.view);
  const site = first(params.site);

  const now = today();

  return {
    month: isMonth(month) ? month : now.slice(0, 7),
    from: isDate(from) ? from : null,
    to: isDate(to) ? to : null,
    view: view === 'list' ? 'list' : 'calendar',
    siteId: isUuid(site) ? site : null,
    orgWideOnly: first(params.site) === 'org',
    jurisdictions: keepKnown(many(params.jurisdiction), JURISDICTIONS),
    states: keepKnown(many(params.state), DUE_STATES),
    programArea: first(params.area)?.trim() || null,
    unverifiedOnly: first(params.unverified) === '1',
    search: first(params.q)?.trim() || null,
  };
}

/** The date span the current view is showing, whichever view that is. */
export function complianceRange(f: ComplianceFilters): { from: string; to: string } {
  if (f.view === 'calendar') {
    const start = `${f.month}-01`;
    // The last day of the month is the day before the first of the next one.
    const nextMonth = addMonths(start, 1);
    return { from: start, to: new Date(Date.parse(`${nextMonth}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10) };
  }
  const from = f.from ?? today();
  const to = f.to ?? addMonths(from, DEFAULT_LIST_HORIZON_MONTHS);
  return { from, to };
}

export function hasActiveComplianceFilters(f: ComplianceFilters): boolean {
  return Boolean(
    f.siteId ||
      f.orgWideOnly ||
      f.programArea ||
      f.unverifiedOnly ||
      f.search ||
      f.jurisdictions.length ||
      f.states.length,
  );
}

/** Rebuilds the query string, dropping empties so URLs stay readable and shareable. */
export function complianceFiltersToSearchParams(
  f: Partial<ComplianceFilters>,
  overrides: Record<string, string | number | null> = {},
): URLSearchParams {
  const p = new URLSearchParams();
  if (f.view && f.view !== 'calendar') p.set('view', f.view);
  if (f.month) p.set('month', f.month);
  if (f.from) p.set('from', f.from);
  if (f.to) p.set('to', f.to);
  if (f.orgWideOnly) p.set('site', 'org');
  else if (f.siteId) p.set('site', f.siteId);
  if (f.programArea) p.set('area', f.programArea);
  if (f.unverifiedOnly) p.set('unverified', '1');
  if (f.search) p.set('q', f.search);
  for (const j of f.jurisdictions ?? []) p.append('jurisdiction', j);
  for (const s of f.states ?? []) p.append('state', s);

  for (const [key, value] of Object.entries(overrides)) {
    if (value === null || value === '') p.delete(key);
    else p.set(key, String(value));
  }
  return p;
}

/**
 * A query on `compliance_events_enriched` carrying the scope filters — everything except
 * the date range and the due state, which the callers add themselves because they differ
 * per panel.
 *
 * No organization_id predicate appears anywhere here, deliberately: RLS scopes the view
 * to the caller's tenant. Adding a client-side org filter would imply that isolation is
 * the application's job, which is exactly the assumption that produced the last bug.
 */
export function complianceEventQuery(
  supabase: SupabaseClient<Database>,
  filters: ComplianceFilters,
  { count, head }: { count?: 'exact'; head?: boolean } = {},
) {
  let query = supabase
    .from('compliance_events_enriched')
    .select('*', count ? { count, head } : undefined);

  if (filters.orgWideOnly) query = query.is('site_id', null);
  else if (filters.siteId) query = query.eq('site_id', filters.siteId);

  if (filters.jurisdictions.length) query = query.in('jurisdiction', filters.jurisdictions);
  if (filters.programArea) query = query.eq('program_area', filters.programArea);
  if (filters.unverifiedOnly) query = query.eq('is_verified', false);

  if (filters.search) {
    // Escape PostgREST's or() delimiters so a comma or paren in the term cannot alter the
    // filter structure.
    const term = filters.search.replace(/[,()\\]/g, ' ').trim();
    if (term) {
      query = query.or(
        [
          `obligation.ilike.%${term}%`,
          `permit_ref.ilike.%${term}%`,
          `citation.ilike.%${term}%`,
          `agency.ilike.%${term}%`,
          `program_area.ilike.%${term}%`,
          `responsible_party.ilike.%${term}%`,
        ].join(','),
      );
    }
  }

  return query;
}
