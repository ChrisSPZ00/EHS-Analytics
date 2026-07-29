import type { NextRequest } from 'next/server';

import { csvResponse, toCsv } from '@/lib/export/csv';
import {
  complianceEventQuery,
  complianceRange,
  parseComplianceFilters,
  type RawSearchParams,
} from '@/lib/data/compliance-filters';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** Batch size for paging through the result set; keeps memory flat on large exports. */
const CHUNK = 1000;
const MAX_ROWS = 50_000;

const HEADERS = [
  'Due date',
  'State',
  'Days until due',
  'Obligation',
  'Jurisdiction',
  'Programme area',
  'Agency',
  'Permit ref',
  'Citation',
  'Site',
  'Frequency',
  'Responsible party',
  'Lead time (days)',
  'Verified against source',
  'Status',
  'Completed date',
  'Completed by',
  'On time',
  'Evidence notes',
];

/**
 * Exports the CURRENT FILTERED VIEW, not the whole calendar -- it reuses the same filter
 * parser as the page, so the file matches exactly what the user is looking at. That makes
 * it a client deliverable: the calendar an auditor asks for is the calendar on screen.
 *
 * RLS applies here as it does everywhere else: this runs under the caller's session.
 */
export async function GET(request: NextRequest) {
  const params = Object.fromEntries(request.nextUrl.searchParams.entries()) as RawSearchParams;

  // Multi-value filters need every occurrence, which Object.fromEntries collapses.
  for (const key of ['jurisdiction', 'state']) {
    const all = request.nextUrl.searchParams.getAll(key);
    if (all.length) params[key] = all;
  }

  const filters = parseComplianceFilters(params);
  const range = complianceRange(filters);
  const supabase = await createClient();

  const rows: unknown[][] = [];
  for (let offset = 0; offset < MAX_ROWS; offset += CHUNK) {
    let query = complianceEventQuery(supabase, filters)
      .gte('due_date', range.from)
      .lte('due_date', range.to);

    if (filters.states.length) query = query.in('state', filters.states);

    const { data, error } = await query
      .order('due_date', { ascending: true })
      .range(offset, offset + CHUNK - 1);

    if (error) {
      return new Response(`Export failed: ${error.message}`, { status: 500 });
    }
    if (!data?.length) break;

    for (const row of data) {
      rows.push([
        row.due_date,
        row.state,
        row.days_until_due,
        row.obligation,
        row.jurisdiction,
        row.program_area,
        row.agency,
        row.permit_ref,
        row.citation,
        // An obligation with no site is organisation-wide, which is a fact, not a blank.
        row.site_name ?? 'Organisation-wide',
        row.frequency,
        row.responsible_party,
        row.lead_time_days,
        row.is_verified ? 'Yes' : 'No',
        row.status,
        row.completed_date,
        row.completed_by,
        // Null, not "No", while an entry is still open: it has no on-time answer yet.
        row.completed_on_time === null ? '' : row.completed_on_time ? 'Yes' : 'No',
        row.evidence_notes,
      ]);
    }

    if (data.length < CHUNK) break;
  }

  const stamp = new Date().toISOString().slice(0, 10);
  return csvResponse(`compliance-calendar-${stamp}.csv`, toCsv(HEADERS, rows));
}
