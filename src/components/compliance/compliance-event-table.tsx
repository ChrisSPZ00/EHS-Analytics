'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import {
  completeComplianceEvent,
  reopenComplianceEvent,
} from '@/app/(app)/compliance/actions';
import { DueStateBadge, VerificationBadge } from '@/components/compliance/compliance-badges';
import { Button } from '@/components/ui/button';
import { Table, TableWrap, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import type { ComplianceEventRow } from '@/lib/data/compliance';

/**
 * The table twin of the calendar grid.
 *
 * Every value on the grid is reachable here in text, which is what allows the grid to use
 * colour at all — and it is the form that prints, sorts and reads on a phone.
 */
export function ComplianceEventTable({
  rows,
  completedBy,
}: {
  rows: ComplianceEventRow[];
  completedBy: string | null;
}) {
  return (
    <TableWrap>
      <Table>
        <THead>
          <TR>
            <TH>Due</TH>
            <TH>State</TH>
            <TH>Obligation</TH>
            <TH>Site</TH>
            <TH>Jurisdiction</TH>
            <TH>Frequency</TH>
            <TH>Owner</TH>
            <TH>Source</TH>
            <TH>
              <span className="sr-only">Actions</span>
            </TH>
          </TR>
        </THead>
        <TBody>
          {rows.map((row) => (
            <EventRow key={row.id} row={row} completedBy={completedBy} />
          ))}
        </TBody>
      </Table>
    </TableWrap>
  );
}

function EventRow({
  row,
  completedBy,
}: {
  row: ComplianceEventRow;
  completedBy: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const complete = Boolean(row.completed_date);

  function run(action: () => Promise<{ ok: boolean; message?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.message ?? 'Could not save.');
      else router.refresh();
    });
  }

  return (
    <TR id={`event-${row.id}`} className={pending ? 'opacity-60' : undefined}>
      <TD className="whitespace-nowrap tabular-nums">{row.due_date}</TD>
      <TD>
        <DueStateBadge state={row.state} daysUntilDue={row.days_until_due} />
      </TD>
      <TD className="max-w-[26rem]">
        <Link
          href={`/compliance/obligations/${row.obligation_id}`}
          className="text-primary hover:underline"
        >
          {row.obligation}
        </Link>
        {row.program_area ? (
          <span className="block text-xs text-muted-foreground">{row.program_area}</span>
        ) : null}
        {complete ? (
          <span className="block text-xs text-muted-foreground">
            Completed {row.completed_date}
            {row.completed_by ? ` by ${row.completed_by}` : ''}
            {row.completed_on_time === false ? ' — after the due date' : ''}
          </span>
        ) : null}
        {error ? <span className="block text-xs font-medium text-danger">{error}</span> : null}
      </TD>
      {/* An obligation with no site is organisation-wide, not missing a value. */}
      <TD className="whitespace-nowrap">{row.site_name ?? 'Organisation-wide'}</TD>
      <TD className="whitespace-nowrap">{row.jurisdiction}</TD>
      <TD className="whitespace-nowrap">{row.frequency}</TD>
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
      <TD className="whitespace-nowrap">
        {complete ? (
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => run(() => reopenComplianceEvent(row.id!, row.obligation_id!))}
          >
            Reopen
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() =>
              run(() => completeComplianceEvent(row.id!, row.obligation_id!, completedBy))
            }
          >
            Mark done today
          </Button>
        )}
      </TD>
    </TR>
  );
}
