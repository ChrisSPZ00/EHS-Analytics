import Link from 'next/link';
import { notFound } from 'next/navigation';

import { CorrectiveActionList } from '@/components/corrective-actions/corrective-action-list';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm">{value ?? '—'}</dd>
    </div>
  );
}

export default async function IncidentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: incident }, { data: actions }, { data: profiles }, { data: role }] =
    await Promise.all([
      supabase.from('incidents_enriched').select('*').eq('id', id).maybeSingle(),
      supabase.from('corrective_actions').select('*').eq('incident_id', id),
      supabase.from('profiles').select('id, full_name'),
      supabase.rpc('current_org_role'),
    ]);

  if (!incident) notFound();

  const canWrite = role !== 'viewer';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {incident.incident_type} — {incident.incident_date}
          </h1>
          <p className="text-sm text-muted-foreground">
            {incident.site_name}
            {incident.department_name ? ` · ${incident.department_name}` : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/incidents" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
            Back to log
          </Link>
          {canWrite ? (
            <Link
              href={`/incidents/${id}/edit`}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              Edit
            </Link>
          ) : null}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Incident</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
            <Detail label="Classification" value={incident.classification} />
            <Detail label="Severity" value={incident.severity_rating} />
            <Detail label="Shift" value={incident.shift} />
            <Detail label="Reported" value={incident.reported_date} />
            <Detail label="Employee" value={incident.employee_display} />
            <Detail
              label="Tenure at incident"
              value={
                incident.tenure_days === null
                  ? '—'
                  : `${incident.tenure_days.toLocaleString()} days (${incident.tenure_bucket})`
              }
            />
            <Detail label="Injury type" value={incident.injury_type} />
            <Detail label="Body part" value={incident.body_part} />
            <Detail label="Root cause" value={incident.root_cause_category} />
            <Detail label="Root cause detail" value={incident.root_cause_detail} />
            <Detail label="Days away" value={incident.days_away} />
            <Detail label="Days restricted" value={incident.days_restricted} />
            <Detail
              label="Expected cost"
              value={incident.expected_cost === null ? '—' : `$${incident.expected_cost}`}
            />
            <Detail
              label="Actual cost to date"
              value={
                incident.actual_cost_to_date === null ? '—' : `$${incident.actual_cost_to_date}`
              }
            />
            <Detail label="Claim ref" value={incident.claim_ref} />
            <Detail
              label="Flags"
              value={
                [
                  incident.machine_involved && 'Machine involved',
                  incident.safety_violation && 'Safety violation',
                  incident.recently_transferred && 'Recently transferred',
                  incident.is_lost_time && 'Lost time',
                ]
                  .filter(Boolean)
                  .join(', ') || 'None'
              }
            />
          </dl>

          {incident.description ? (
            <div className="mt-4 border-t border-border pt-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Description</p>
              <p className="mt-1 whitespace-pre-wrap text-sm">{incident.description}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <CorrectiveActionList
        incidentId={id}
        actions={actions ?? []}
        members={(profiles ?? []).map((p) => ({
          id: p.id,
          label: p.full_name ?? 'Team member',
        }))}
        canWrite={canWrite}
      />
    </div>
  );
}
