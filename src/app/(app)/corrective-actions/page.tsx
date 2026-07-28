import Link from 'next/link';

import { InlineHocAssign } from '@/components/corrective-actions/inline-hoc-assign';
import { HocBadge } from '@/components/hierarchy-of-controls/hoc-badge';
import { buttonVariants } from '@/components/ui/button';
import { Callout, EmptyState } from '@/components/ui/callout';
import { Table, TableWrap, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import type { HocValue } from '@/lib/domain/hierarchy-of-controls';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function CorrectiveActionsPage({
  searchParams,
}: {
  searchParams: Promise<{ unclassified?: string }>;
}) {
  const { unclassified } = await searchParams;
  const onlyUnclassified = unclassified === '1';

  const supabase = await createClient();

  let query = supabase
    .from('corrective_actions_enriched')
    .select('*')
    // Ascending by rank with Unclassified last, then most recent incident first.
    .order('hoc_sort_rank', { ascending: true })
    .order('incident_date', { ascending: false })
    .limit(500);

  if (onlyUnclassified) query = query.is('hierarchy_of_controls', null);

  const [{ data: rows, error }, { count: unclassifiedCount }] = await Promise.all([
    query,
    supabase
      .from('corrective_actions')
      .select('id', { count: 'exact', head: true })
      .is('hierarchy_of_controls', null),
  ]);

  if (error) {
    return (
      <Callout tone="danger" title="Could not load corrective actions">
        {error.message}
      </Callout>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Corrective actions</h1>
          <p className="text-sm text-muted-foreground">
            Sorted by control level — most effective first, unclassified last.
          </p>
        </div>
        {(unclassifiedCount ?? 0) > 0 ? (
          <Link
            href="/corrective-actions/needs-classification"
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            {unclassifiedCount} need classification
          </Link>
        ) : null}
      </div>

      {(rows ?? []).length === 0 ? (
        <EmptyState title="No corrective actions yet">
          <p>
            Corrective actions are added from an incident&apos;s detail page, or brought in by an
            import that has an action column.
          </p>
        </EmptyState>
      ) : (
        <TableWrap>
          <Table>
            <THead>
              <TR>
                <TH>Control level</TH>
                <TH>Incident</TH>
                <TH>Site</TH>
                <TH>Action</TH>
                <TH>Status</TH>
                <TH>Due</TH>
                <TH>Reclassify</TH>
              </TR>
            </THead>
            <TBody>
              {(rows ?? []).map((row) => (
                <TR key={row.id}>
                  <TD>
                    <HocBadge value={row.hierarchy_of_controls as HocValue} density="dense" />
                  </TD>
                  <TD className="whitespace-nowrap">
                    <Link
                      href={`/incidents/${row.incident_id}`}
                      className="text-primary hover:underline"
                    >
                      {row.incident_date}
                    </Link>
                  </TD>
                  <TD className="whitespace-nowrap">{row.site_name ?? '—'}</TD>
                  <TD className="max-w-[24rem]">{row.description}</TD>
                  <TD className="whitespace-nowrap">{row.status}</TD>
                  <TD className="whitespace-nowrap">{row.due_date ?? '—'}</TD>
                  <TD>
                    <InlineHocAssign
                      actionId={row.id!}
                      value={row.hierarchy_of_controls as HocValue}
                    />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TableWrap>
      )}
    </div>
  );
}
