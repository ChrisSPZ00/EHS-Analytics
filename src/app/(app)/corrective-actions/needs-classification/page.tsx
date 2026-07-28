import Link from 'next/link';

import { InlineHocAssign } from '@/components/corrective-actions/inline-hoc-assign';
import { buttonVariants } from '@/components/ui/button';
import { Callout, EmptyState } from '@/components/ui/callout';
import { Table, TableWrap, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * The needs-classification queue: corrective actions where hierarchy_of_controls IS NULL,
 * most recent incident first, classifiable inline.
 */
export default async function NeedsClassificationPage() {
  const supabase = await createClient();

  const { data: rows, error } = await supabase
    .from('corrective_actions_needing_classification')
    .select('*')
    .order('incident_date', { ascending: false })
    .limit(500);

  if (error) {
    return (
      <Callout tone="danger" title="Could not load the queue">
        {error.message}
      </Callout>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Needs classification</h1>
          <p className="text-sm text-muted-foreground">
            Corrective actions with no control level assigned yet, newest incident first.
          </p>
        </div>
        <Link
          href="/corrective-actions"
          className={buttonVariants({ variant: 'ghost', size: 'sm' })}
        >
          All corrective actions
        </Link>
      </div>

      {(rows ?? []).length === 0 ? (
        <EmptyState title="Everything is classified">
          <p>
            Every corrective action on file has a control level. New ones will appear here as
            they are logged or imported.
          </p>
        </EmptyState>
      ) : (
        <>
          <Callout tone="info">
            Classifying by control level is what makes a corrective action auditable — it
            records whether the hazard was designed out or managed around. Assign one here
            without opening each record.
          </Callout>

          <TableWrap>
            <Table>
              <THead>
                <TR>
                  <TH>Incident date</TH>
                  <TH>Site</TH>
                  <TH>Action</TH>
                  <TH>Status</TH>
                  <TH>Assign control level</TH>
                </TR>
              </THead>
              <TBody>
                {(rows ?? []).map((row) => (
                  <TR key={row.id}>
                    <TD className="whitespace-nowrap">
                      <Link
                        href={`/incidents/${row.incident_id}`}
                        className="text-primary hover:underline"
                      >
                        {row.incident_date}
                      </Link>
                    </TD>
                    <TD className="whitespace-nowrap">{row.site_name ?? '—'}</TD>
                    <TD className="max-w-[28rem]">{row.description}</TD>
                    <TD className="whitespace-nowrap">{row.status}</TD>
                    <TD>
                      <InlineHocAssign actionId={row.id!} value={null} />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableWrap>
        </>
      )}
    </div>
  );
}
