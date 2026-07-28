import Link from 'next/link';

import { IncidentForm } from '@/components/incidents/incident-form';
import { Callout } from '@/components/ui/callout';
import { buttonVariants } from '@/components/ui/button';
import { loadIncidentFormOptions } from '@/lib/data/form-options';
import { createClient } from '@/lib/supabase/server';
import { createIncident } from '../actions';

export const dynamic = 'force-dynamic';

export default async function NewIncidentPage() {
  const supabase = await createClient();
  const options = await loadIncidentFormOptions(supabase);

  if (options.sites.length === 0) {
    return (
      <div className="max-w-xl space-y-4">
        <h1 className="text-xl font-semibold tracking-tight">Log an incident</h1>
        <Callout tone="warning" title="Add a site first">
          Every incident belongs to a site. Add at least one before logging incidents — an
          import will create them for you if you would rather start there.
        </Callout>
        <Link href="/incidents/import" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          Go to import
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Log an incident</h1>
        <p className="text-sm text-muted-foreground">
          Only the site, date and type are required. Everything else can be filled in later.
        </p>
      </div>
      <IncidentForm
        action={createIncident}
        options={options}
        submitLabel="Save incident"
        cancelHref="/incidents"
      />
    </div>
  );
}
