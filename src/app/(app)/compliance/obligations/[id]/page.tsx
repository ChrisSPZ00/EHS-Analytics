import Link from 'next/link';
import { notFound } from 'next/navigation';

import {
  ObligationStatusBadge,
  VerificationBadge,
} from '@/components/compliance/compliance-badges';
import { ComplianceEventForm } from '@/components/compliance/compliance-event-form';
import { DeleteObligationButton } from '@/components/compliance/delete-obligation-button';
import { buttonVariants } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ComplianceEventRow } from '@/lib/data/compliance';
import { calendarGap, type ObligationFrequency } from '@/lib/domain/compliance';
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

export default async function ObligationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: obligation }, { data: events }, { data: role }] = await Promise.all([
    supabase.from('compliance_obligations_enriched').select('*').eq('id', id).maybeSingle(),
    supabase
      .from('compliance_events_enriched')
      .select('*')
      .eq('obligation_id', id)
      .order('due_date', { ascending: false })
      .limit(200),
    supabase.rpc('current_org_role'),
  ]);

  // RLS makes another tenant's obligation indistinguishable from one that does not exist,
  // which is the correct thing to expose.
  if (!obligation) notFound();

  const canWrite = role !== 'viewer';
  const rows = (events ?? []) as ComplianceEventRow[];
  const gap = calendarGap({
    frequency: (obligation.frequency ?? 'Ongoing') as ObligationFrequency,
    due_date: obligation.due_date,
    recurrence_month: obligation.recurrence_month,
    recurrence_day: obligation.recurrence_day,
  });

  const open = rows.filter((r) => !r.completed_date);
  const done = rows.filter((r) => r.completed_date);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-3xl">
          <h1 className="text-xl font-semibold tracking-tight">{obligation.obligation}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {obligation.jurisdiction}
            {obligation.program_area ? ` · ${obligation.program_area}` : ''}
            {obligation.site_name ? ` · ${obligation.site_name}` : ' · Organisation-wide'}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <VerificationBadge isVerified={obligation.is_verified} />
            <ObligationStatusBadge status={obligation.status} />
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            href="/compliance/register"
            className={buttonVariants({ variant: 'ghost', size: 'sm' })}
          >
            Back to register
          </Link>
          {canWrite ? (
            <>
              <Link
                href={`/compliance/obligations/${id}/edit`}
                className={buttonVariants({ variant: 'outline', size: 'sm' })}
              >
                Edit
              </Link>
              <DeleteObligationButton id={id} />
            </>
          ) : null}
        </div>
      </div>

      {obligation.is_verified ? null : (
        <Callout tone="warning" title="Not verified against a source document">
          Nobody has confirmed this against the permit or rule text yet. Everything below is
          generated from what was typed in, and is only as reliable as that.
        </Callout>
      )}

      {gap ? (
        <Callout tone="warning" title="Nothing is scheduled from this obligation">
          {gap}
        </Callout>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Requirement</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
            <Detail label="Frequency" value={obligation.frequency} />
            <Detail label="First due" value={obligation.due_date} />
            <Detail
              label="Recurs"
              value={
                obligation.recurrence_month || obligation.recurrence_day
                  ? `${obligation.recurrence_month ? `month ${obligation.recurrence_month}, ` : ''}day ${obligation.recurrence_day ?? '—'}`
                  : 'From the first due date'
              }
            />
            <Detail label="Lead time" value={`${obligation.lead_time_days} days`} />
            <Detail label="Agency" value={obligation.agency} />
            <Detail label="Permit reference" value={obligation.permit_ref} />
            <Detail label="Citation" value={obligation.citation} />
            <Detail label="Responsible party" value={obligation.responsible_party} />
            <Detail label="Open entries" value={obligation.open_events ?? 0} />
            <Detail
              label="Overdue"
              value={
                obligation.overdue_events ? (
                  <span className="font-medium text-danger">{obligation.overdue_events}</span>
                ) : (
                  '0'
                )
              }
            />
            <Detail label="Completed" value={obligation.completed_events ?? 0} />
            <Detail label="Last satisfied" value={obligation.last_completed_date} />
          </dl>

          {obligation.notes ? (
            <div className="mt-4 border-t border-border pt-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Notes</p>
              <p className="mt-1 whitespace-pre-wrap text-sm">{obligation.notes}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">
          Open dates
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            {open.length === 0 ? 'nothing outstanding' : `${open.length} outstanding`}
          </span>
        </h2>
        {open.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            {gap
              ? 'This obligation generates no dates, so there is nothing to track here.'
              : 'Everything generated so far has been recorded. Use “Extend calendar” on the calendar page to schedule further ahead.'}
          </p>
        ) : (
          <div className="space-y-2">
            {[...open]
              .sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''))
              .map((event) => (
                <ComplianceEventForm key={event.id} event={event} />
              ))}
          </div>
        )}
      </section>

      {done.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-base font-semibold">
            History
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {done.length} recorded
            </span>
          </h2>
          <div className="space-y-2">
            {done.map((event) => (
              <ComplianceEventForm key={event.id} event={event} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
