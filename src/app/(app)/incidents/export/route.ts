import type { NextRequest } from 'next/server';

import { csvResponse, toCsv } from '@/lib/export/csv';
import {
  applyIncidentFilters,
  parseIncidentFilters,
  type RawSearchParams,
} from '@/lib/data/incident-filters';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** Batch size for paging through the result set; keeps memory flat on large exports. */
const CHUNK = 1000;
const MAX_ROWS = 50_000;

const HEADERS = [
  'Incident date',
  'Reported date',
  'Site',
  'Department',
  'Employee',
  'Employee ref',
  'Tenure (days)',
  'Type',
  'Classification',
  'Shift',
  'Injury type',
  'Body part',
  'Root cause category',
  'Root cause detail',
  'Machine involved',
  'Safety violation',
  'Recently transferred',
  'Lost time',
  'Days away',
  'Days restricted',
  'Severity',
  'Expected cost',
  'Actual cost to date',
  'Claim ref',
  'Description',
];

/**
 * Exports the CURRENT FILTERED VIEW, not the whole table -- it reuses the same filter
 * parser as the page, so the file matches exactly what the user is looking at.
 *
 * RLS applies here as it does everywhere else: this runs under the caller's session.
 */
export async function GET(request: NextRequest) {
  const params = Object.fromEntries(
    request.nextUrl.searchParams.entries(),
  ) as RawSearchParams;

  // Multi-value filters need every occurrence, which Object.fromEntries collapses.
  for (const key of ['type', 'classification', 'shift', 'severity']) {
    const all = request.nextUrl.searchParams.getAll(key);
    if (all.length) params[key] = all;
  }

  const filters = parseIncidentFilters(params);
  const supabase = await createClient();

  const rows: unknown[][] = [];
  for (let offset = 0; offset < MAX_ROWS; offset += CHUNK) {
    const { data, error } = await applyIncidentFilters(supabase, filters).range(
      offset,
      offset + CHUNK - 1,
    );

    if (error) {
      return new Response(`Export failed: ${error.message}`, { status: 500 });
    }
    if (!data?.length) break;

    for (const row of data) {
      rows.push([
        row.incident_date,
        row.reported_date,
        row.site_name,
        row.department_name,
        row.employee_display,
        row.employee_ref,
        row.tenure_days,
        row.incident_type,
        row.classification,
        row.shift,
        row.injury_type,
        row.body_part,
        row.root_cause_category,
        row.root_cause_detail,
        row.machine_involved ? 'Yes' : 'No',
        row.safety_violation ? 'Yes' : 'No',
        row.recently_transferred ? 'Yes' : 'No',
        row.is_lost_time ? 'Yes' : 'No',
        row.days_away,
        row.days_restricted,
        row.severity_rating,
        row.expected_cost,
        row.actual_cost_to_date,
        row.claim_ref,
        row.description,
      ]);
    }

    if (data.length < CHUNK) break;
  }

  const stamp = new Date().toISOString().slice(0, 10);
  return csvResponse(`incidents-${stamp}.csv`, toCsv(HEADERS, rows));
}
