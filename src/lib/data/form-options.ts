import type { SupabaseClient } from '@supabase/supabase-js';

import type { IncidentFormOptions } from '@/components/incidents/incident-form';
import type { Database } from '@/lib/supabase/database.types';

/**
 * Loads the option lists the incident form needs.
 *
 * Employee labels honour anonymize_employees: when a client has turned it on, injury
 * records must not surface names anywhere, including in a dropdown.
 */
export async function loadIncidentFormOptions(
  supabase: SupabaseClient<Database>,
): Promise<IncidentFormOptions> {
  const [{ data: sites }, { data: departments }, { data: employees }, { data: org }, { data: injuryTypes }, { data: bodyParts }] =
    await Promise.all([
      supabase.from('sites').select('id, name').eq('is_active', true).order('name'),
      supabase.from('departments').select('id, name, site_id').eq('is_active', true).order('name'),
      supabase
        .from('employees')
        .select('id, site_id, department_id, employee_ref, display_name')
        .eq('is_active', true)
        .order('employee_ref'),
      supabase.from('organizations').select('anonymize_employees').maybeSingle(),
      supabase.from('injury_types').select('label').eq('is_active', true).order('sort_order'),
      supabase.from('body_parts').select('label').eq('is_active', true).order('sort_order'),
    ]);

  const anonymize = org?.anonymize_employees ?? false;

  return {
    sites: sites ?? [],
    departments: departments ?? [],
    employees: (employees ?? []).map((e) => ({
      id: e.id,
      site_id: e.site_id,
      department_id: e.department_id,
      label: anonymize
        ? (e.employee_ref ?? 'Unidentified')
        : [e.employee_ref, e.display_name].filter(Boolean).join(' — ') || 'Unidentified',
    })),
    injuryTypes: (injuryTypes ?? []).map((r) => r.label),
    bodyParts: (bodyParts ?? []).map((r) => r.label),
  };
}
