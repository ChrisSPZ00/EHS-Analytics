import { notFound } from 'next/navigation';

import { IncidentForm } from '@/components/incidents/incident-form';
import { loadIncidentFormOptions } from '@/lib/data/form-options';
import { createClient } from '@/lib/supabase/server';
import { updateIncident, type FormState } from '../../actions';

export const dynamic = 'force-dynamic';

export default async function EditIncidentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: incident }, options] = await Promise.all([
    supabase.from('incidents').select('*').eq('id', id).maybeSingle(),
    loadIncidentFormOptions(supabase),
  ]);

  // RLS makes another tenant's incident indistinguishable from one that does not exist,
  // which is the correct thing to expose.
  if (!incident) notFound();

  const action = async (prev: FormState, formData: FormData) => {
    'use server';
    return updateIncident(id, prev, formData);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Edit incident</h1>
        <p className="text-sm text-muted-foreground">{incident.incident_date}</p>
      </div>
      <IncidentForm
        action={action}
        incident={incident}
        options={options}
        submitLabel="Save changes"
        cancelHref={`/incidents/${id}`}
      />
    </div>
  );
}
