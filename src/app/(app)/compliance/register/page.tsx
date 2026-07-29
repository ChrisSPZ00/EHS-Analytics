import Link from 'next/link';

import {
  DueStateBadge,
  ObligationStatusBadge,
  VerificationBadge,
} from '@/components/compliance/compliance-badges';
import { buttonVariants } from '@/components/ui/button';
import { Callout, EmptyState } from '@/components/ui/callout';
import { Table, TableWrap, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import type { ObligationRow } from '@/lib/data/compliance';
import { calendarGap, type ObligationFrequency } from '@/lib/domain/compliance';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * The register, grouped by jurisdiction and then programme area — which is how EHS
 * managers hold their obligations in their heads, and the grouping the table is indexed
 * for.
 */
export default async function ComplianceRegisterPage() {
  const supabase = await createClient();

  const { data: rows, error } = await supabase
    .from('compliance_obligations_enriched')
    .select('*')
    .order('jurisdiction', { ascending: true })
    .order('program_area', { ascending: true, nullsFirst: false })
    .order('obligation', { ascending: true })
    .limit(1000);

  if (error) {
    return (
      <Callout tone="danger" title="Could not load the register">
        {error.message}
      </Callout>
    );
  }

  const obligations = rows ?? [];
  const unverified = obligations.filter((o) => !o.is_verified).length;
  const groups = groupObligations(obligations);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Obligation register</h1>
          <p className="text-sm text-muted-foreground">
            {obligations.length === 0
              ? 'No obligations recorded yet.'
              : `${obligations.length} obligation${obligations.length === 1 ? '' : 's'}, grouped by jurisdiction and programme area.`}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/compliance" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            Back to the calendar
          </Link>
          <Link
            href="/compliance/obligations/new"
            className={buttonVariants({ variant: 'default', size: 'sm' })}
          >
            Add an obligation
          </Link>
        </div>
      </div>

      {unverified > 0 ? (
        <Callout tone="warning" title={`${unverified} not verified against a source document`}>
          A calendar built from memory rather than from the permit text is a liability. Open
          each one, check it against the permit or rule, and tick &ldquo;verified&rdquo;.
        </Callout>
      ) : null}

      {obligations.length === 0 ? (
        <EmptyState title="The register is empty">
          <p>
            Start with the permits you hold and the rules you know apply. Each obligation you
            record with a frequency and a date generates its own calendar entries — you never
            enter the individual dates.
          </p>
          <div className="mt-4 flex justify-center">
            <Link
              href="/compliance/obligations/new"
              className={buttonVariants({ variant: 'default', size: 'sm' })}
            >
              Add the first obligation
            </Link>
          </div>
        </EmptyState>
      ) : (
        groups.map((group) => (
          <section key={group.key} className="space-y-2">
            <h2 className="text-base font-semibold">
              {group.jurisdiction}
              <span className="ml-2 font-normal text-muted-foreground">
                {group.programArea ?? 'No programme area'}
              </span>
            </h2>
            <TableWrap>
              <Table>
                <THead>
                  <TR>
                    <TH>Obligation</TH>
                    <TH>Frequency</TH>
                    <TH>Next due</TH>
                    <TH>Open</TH>
                    <TH>Last satisfied</TH>
                    <TH>Owner</TH>
                    <TH>Source</TH>
                  </TR>
                </THead>
                <TBody>
                  {group.rows.map((row) => (
                    <ObligationTableRow key={row.id} row={row} />
                  ))}
                </TBody>
              </Table>
            </TableWrap>
          </section>
        ))
      )}
    </div>
  );
}

function ObligationTableRow({ row }: { row: ObligationRow }) {
  const gap = calendarGap({
    frequency: (row.frequency ?? 'Ongoing') as ObligationFrequency,
    due_date: row.due_date,
    recurrence_month: row.recurrence_month,
    recurrence_day: row.recurrence_day,
  });

  return (
    <TR>
      <TD className="max-w-[28rem]">
        <Link
          href={`/compliance/obligations/${row.id}`}
          className="font-medium text-primary hover:underline"
        >
          {row.obligation}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <ObligationStatusBadge status={row.status} />
          {row.site_name ? (
            <span className="text-xs text-muted-foreground">{row.site_name}</span>
          ) : (
            <span className="text-xs text-muted-foreground">Organisation-wide</span>
          )}
        </div>
      </TD>
      <TD className="whitespace-nowrap">{row.frequency}</TD>
      <TD className="whitespace-nowrap">
        {row.next_due_date ? (
          <div className="flex flex-col gap-1">
            <span className="tabular-nums">{row.next_due_date}</span>
            <DueStateBadge state={row.next_state} />
          </div>
        ) : (
          // Never an em dash on its own here: the reason is the useful part.
          <span className="text-xs text-muted-foreground">{gap ?? 'Nothing outstanding'}</span>
        )}
      </TD>
      <TD className="tabular-nums">
        {row.open_events ?? 0}
        {row.overdue_events ? (
          <span className="ml-1 text-xs font-medium text-danger">
            ({row.overdue_events} overdue)
          </span>
        ) : null}
      </TD>
      <TD className="whitespace-nowrap tabular-nums">{row.last_completed_date ?? '—'}</TD>
      <TD className="whitespace-nowrap">{row.responsible_party ?? '—'}</TD>
      <TD className="whitespace-nowrap">
        <div className="flex flex-col gap-1">
          <VerificationBadge isVerified={row.is_verified} />
          {row.permit_ref || row.citation ? (
            <span className="text-xs text-muted-foreground">
              {[row.permit_ref, row.citation].filter(Boolean).join(' · ')}
            </span>
          ) : null}
        </div>
      </TD>
    </TR>
  );
}

interface ObligationGroup {
  key: string;
  jurisdiction: string;
  programArea: string | null;
  rows: ObligationRow[];
}

function groupObligations(rows: ObligationRow[]): ObligationGroup[] {
  const groups: ObligationGroup[] = [];
  for (const row of rows) {
    const jurisdiction = row.jurisdiction ?? 'Unassigned';
    const programArea = row.program_area ?? null;
    const key = `${jurisdiction}::${programArea ?? ''}`;
    const existing = groups.find((g) => g.key === key);
    if (existing) existing.rows.push(row);
    else groups.push({ key, jurisdiction, programArea, rows: [row] });
  }
  return groups;
}
