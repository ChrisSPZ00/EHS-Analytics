import { notFound } from 'next/navigation';

import { ObligationForm } from '@/components/compliance/obligation-form';
import { Callout } from '@/components/ui/callout';
import { createClient } from '@/lib/supabase/server';
import { saveObligation } from '../../../actions';

export const dynamic = 'force-dynamic';

export default async function EditObligationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: obligation }, { data: sites }, { data: areas }] = await Promise.all([
    supabase.from('compliance_obligations').select('*').eq('id', id).maybeSingle(),
    supabase.from('sites').select('id, name').eq('is_active', true).order('name'),
    supabase.from('compliance_obligations').select('program_area').not('program_area', 'is', null),
  ]);

  // RLS makes another tenant's obligation indistinguishable from one that does not exist,
  // which is the correct thing to expose.
  if (!obligation) notFound();

  const programAreas = [
    ...new Set((areas ?? []).map((a) => a.program_area).filter((a): a is string => !!a)),
  ].sort();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Edit obligation</h1>
        <p className="text-sm text-muted-foreground">{obligation.obligation}</p>
      </div>

      <Callout tone="info" title="Changing the schedule rebuilds future dates">
        Dates already recorded as done, started or annotated are kept exactly as they are.
        Only untouched future placeholders are replaced.
      </Callout>

      <ObligationForm
        action={saveObligation}
        obligation={obligation}
        sites={sites ?? []}
        programAreas={programAreas}
        submitLabel="Save changes"
        cancelHref={`/compliance/obligations/${id}`}
      />
    </div>
  );
}
