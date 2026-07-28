'use server';

import { revalidatePath } from 'next/cache';

import type { NormalisedRow } from '@/lib/import/validate';
import { createClient } from '@/lib/supabase/server';

export interface CommitResult {
  ok: boolean;
  message: string;
  inserted: number;
  correctiveActions: number;
  createdSites: number;
  createdDepartments: number;
  createdEmployees: number;
}

const BATCH = 500;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Writes the approved rows.
 *
 * Sites, departments and employees referenced by the sheet but not yet on file are
 * created here. The preview step states exactly how many of each will be created, so
 * this is confirmed rather than silent.
 *
 * organization_id appears nowhere in any payload below. Every insert goes through the
 * user's own session, and the BEFORE INSERT trigger stamps the tenant.
 */
export async function commitImport(
  rows: NormalisedRow[],
  defaultSiteId: string | null,
): Promise<CommitResult> {
  const empty: CommitResult = {
    ok: false,
    message: '',
    inserted: 0,
    correctiveActions: 0,
    createdSites: 0,
    createdDepartments: 0,
    createdEmployees: 0,
  };

  if (rows.length === 0) {
    return { ...empty, ok: true, message: 'Nothing to import.' };
  }

  const supabase = await createClient();

  // ---- sites -------------------------------------------------------------
  const { data: existingSites, error: sitesError } = await supabase
    .from('sites')
    .select('id, name');
  if (sitesError) return { ...empty, message: `Could not read sites: ${sitesError.message}` };

  const siteIdByName = new Map(
    (existingSites ?? []).map((s) => [s.name.toLowerCase(), s.id] as const),
  );

  const wantedSites = [
    ...new Set(
      rows
        .map((r) => r.site_name?.trim())
        .filter((n): n is string => !!n && !siteIdByName.has(n.toLowerCase())),
    ),
  ];

  let createdSites = 0;
  if (wantedSites.length) {
    const { data, error } = await supabase
      .from('sites')
      .insert(wantedSites.map((name) => ({ name })) as never)
      .select('id, name');
    if (error) return { ...empty, message: `Could not create sites: ${error.message}` };
    for (const site of data ?? []) siteIdByName.set(site.name.toLowerCase(), site.id);
    createdSites = data?.length ?? 0;
  }

  const resolveSite = (row: NormalisedRow): string | null =>
    (row.site_name ? siteIdByName.get(row.site_name.trim().toLowerCase()) : null) ??
    defaultSiteId;

  if (rows.some((r) => !resolveSite(r))) {
    return {
      ...empty,
      message:
        'Some rows have no site and no default site was chosen. Pick a default site and try again.',
    };
  }

  // ---- departments -------------------------------------------------------
  const { data: existingDepartments, error: deptError } = await supabase
    .from('departments')
    .select('id, name, site_id');
  if (deptError) return { ...empty, message: `Could not read departments: ${deptError.message}` };

  const deptKey = (siteId: string, name: string) => `${siteId}|${name.toLowerCase()}`;
  const deptIdByKey = new Map(
    (existingDepartments ?? []).map((d) => [deptKey(d.site_id, d.name), d.id] as const),
  );

  const wantedDepartments = new Map<string, { site_id: string; name: string }>();
  for (const row of rows) {
    const name = row.department_name?.trim();
    if (!name) continue;
    const siteId = resolveSite(row)!;
    const key = deptKey(siteId, name);
    if (!deptIdByKey.has(key)) wantedDepartments.set(key, { site_id: siteId, name });
  }

  let createdDepartments = 0;
  if (wantedDepartments.size) {
    const { data, error } = await supabase
      .from('departments')
      .insert([...wantedDepartments.values()] as never)
      .select('id, name, site_id');
    if (error) return { ...empty, message: `Could not create departments: ${error.message}` };
    for (const d of data ?? []) deptIdByKey.set(deptKey(d.site_id, d.name), d.id);
    createdDepartments = data?.length ?? 0;
  }

  // ---- employees ---------------------------------------------------------
  const { data: existingEmployees, error: empError } = await supabase
    .from('employees')
    .select('id, employee_ref');
  if (empError) return { ...empty, message: `Could not read employees: ${empError.message}` };

  const employeeIdByRef = new Map(
    (existingEmployees ?? [])
      .filter((e) => e.employee_ref)
      .map((e) => [e.employee_ref!.toLowerCase(), e.id] as const),
  );

  const wantedEmployees = new Map<
    string,
    { employee_ref: string; display_name: string | null; hire_date: string | null; site_id: string; department_id: string | null }
  >();
  for (const row of rows) {
    const ref = row.employee_ref?.trim();
    if (!ref || employeeIdByRef.has(ref.toLowerCase())) continue;
    const siteId = resolveSite(row)!;
    const departmentId = row.department_name
      ? (deptIdByKey.get(deptKey(siteId, row.department_name.trim())) ?? null)
      : null;
    wantedEmployees.set(ref.toLowerCase(), {
      employee_ref: ref,
      display_name: row.employee_name,
      hire_date: row.hire_date,
      site_id: siteId,
      department_id: departmentId,
    });
  }

  let createdEmployees = 0;
  if (wantedEmployees.size) {
    for (const batch of chunk([...wantedEmployees.values()], BATCH)) {
      const { data, error } = await supabase
        .from('employees')
        .insert(batch as never)
        .select('id, employee_ref');
      if (error) return { ...empty, message: `Could not create employees: ${error.message}` };
      for (const e of data ?? []) {
        if (e.employee_ref) employeeIdByRef.set(e.employee_ref.toLowerCase(), e.id);
      }
      createdEmployees += data?.length ?? 0;
    }
  }

  // ---- incidents ---------------------------------------------------------
  let inserted = 0;
  let correctiveActions = 0;

  for (const batch of chunk(rows, BATCH)) {
    const payload = batch.map((row) => {
      const siteId = resolveSite(row)!;
      return {
        site_id: siteId,
        department_id: row.department_name
          ? (deptIdByKey.get(deptKey(siteId, row.department_name.trim())) ?? null)
          : null,
        employee_id: row.employee_ref
          ? (employeeIdByRef.get(row.employee_ref.trim().toLowerCase()) ?? null)
          : null,
        incident_date: row.incident_date!,
        reported_date: row.reported_date,
        claim_ref: row.claim_ref,
        incident_type: row.incident_type!,
        classification: row.classification,
        shift: row.shift,
        injury_type: row.injury_type,
        body_part: row.body_part,
        root_cause_category: row.root_cause_category,
        root_cause_detail: row.root_cause_detail,
        machine_involved: row.machine_involved,
        safety_violation: row.safety_violation,
        recently_transferred: row.recently_transferred,
        is_lost_time: row.is_lost_time,
        days_away: row.days_away,
        days_restricted: row.days_restricted,
        severity_rating: row.severity_rating,
        expected_cost: row.expected_cost,
        actual_cost_to_date: row.actual_cost_to_date,
        description: row.description,
      };
    });

    const { data, error } = await supabase
      .from('incidents')
      .insert(payload as never)
      .select('id');

    if (error) {
      return {
        ...empty,
        inserted,
        createdSites,
        createdDepartments,
        createdEmployees,
        message: `Imported ${inserted} row(s) before failing: ${error.message}`,
      };
    }

    inserted += data?.length ?? 0;

    // Corrective actions ride along on the same row. hierarchy_of_controls is written
    // exactly as confirmed -- null included, which is a real value here, not a gap.
    const actions = (data ?? [])
      .map((incident, i) => ({ incident, row: batch[i] }))
      .filter(({ row }) => !!row.corrective_action)
      .map(({ incident, row }) => ({
        incident_id: incident.id,
        description: row.corrective_action!,
        hierarchy_of_controls: row.hierarchy_of_controls,
      }));

    if (actions.length) {
      const { error: actionError, data: actionData } = await supabase
        .from('corrective_actions')
        .insert(actions as never)
        .select('id');
      if (actionError) {
        return {
          ...empty,
          inserted,
          createdSites,
          createdDepartments,
          createdEmployees,
          message: `Incidents imported, but corrective actions failed: ${actionError.message}`,
        };
      }
      correctiveActions += actionData?.length ?? 0;
    }
  }

  revalidatePath('/incidents');
  revalidatePath('/corrective-actions');

  return {
    ok: true,
    inserted,
    correctiveActions,
    createdSites,
    createdDepartments,
    createdEmployees,
    message: `Imported ${inserted} incident${inserted === 1 ? '' : 's'}.`,
  };
}

/** Existing keys for duplicate detection, plus the lookups the preview needs. */
export async function loadImportContext(): Promise<{
  dedupeKeys: string[];
  sites: { id: string; name: string }[];
  departments: string[];
  employeeRefs: string[];
}> {
  const supabase = await createClient();

  const [{ data: sites }, { data: departments }, { data: employees }] = await Promise.all([
    supabase.from('sites').select('id, name').order('name'),
    supabase.from('departments').select('name, site_id'),
    supabase.from('employees').select('employee_ref'),
  ]);

  const siteNameById = new Map((sites ?? []).map((s) => [s.id, s.name] as const));

  // Page through incidents to build the duplicate index.
  const dedupeKeys: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase
      .from('incidents')
      .select('incident_date, injury_type, employees(employee_ref)')
      .range(offset, offset + 999);
    if (error || !data?.length) break;

    for (const row of data) {
      const ref = (row.employees as { employee_ref: string | null } | null)?.employee_ref ?? '';
      dedupeKeys.push(
        [row.incident_date, ref.toLowerCase(), (row.injury_type ?? '').toLowerCase()].join('|'),
      );
    }
    if (data.length < 1000) break;
  }

  return {
    dedupeKeys,
    sites: sites ?? [],
    departments: (departments ?? []).map((d) =>
      `${(siteNameById.get(d.site_id) ?? '').toLowerCase()}|${d.name.toLowerCase()}`,
    ),
    employeeRefs: (employees ?? [])
      .map((e) => e.employee_ref?.toLowerCase())
      .filter((r): r is string => !!r),
  };
}
