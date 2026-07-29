import { ObligationForm } from '@/components/compliance/obligation-form';
import { createClient } from '@/lib/supabase/server';
import { saveObligation } from '../../actions';

export const dynamic = 'force-dynamic';

export default async function NewObligationPage() {
  const supabase = await createClient();

  const [{ data: sites }, { data: areas }] = await Promise.all([
    supabase.from('sites').select('id, name').eq('is_active', true).order('name'),
    supabase.from('compliance_obligations').select('program_area').not('program_area', 'is', null),
  ]);

  const programAreas = [
    ...new Set((areas ?? []).map((a) => a.program_area).filter((a): a is string => !!a)),
  ].sort();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Add an obligation</h1>
        <p className="text-sm text-muted-foreground">
          Record the standing requirement once. The calendar entries are generated from its
          frequency — you never enter the individual dates.
        </p>
      </div>
      <ObligationForm
        action={saveObligation}
        sites={sites ?? []}
        programAreas={programAreas}
        submitLabel="Save obligation"
        cancelHref="/compliance/register"
      />
    </div>
  );
}
