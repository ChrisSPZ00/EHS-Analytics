'use client';

import { useState } from 'react';

import { HocBadge } from '@/components/hierarchy-of-controls/hoc-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Callout } from '@/components/ui/callout';
import { deleteCorrectiveAction } from '@/app/(app)/incidents/actions';
import { hocSortRank, type HocValue } from '@/lib/domain/hierarchy-of-controls';
import type { Database } from '@/lib/supabase/database.types';

import { CorrectiveActionForm } from './corrective-action-form';

type CorrectiveAction = Database['public']['Tables']['corrective_actions']['Row'];

export function CorrectiveActionList({
  incidentId,
  actions,
  members,
  canWrite,
}: {
  incidentId: string;
  actions: CorrectiveAction[];
  members: { id: string; label: string }[];
  canWrite: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Ascending by rank, Unclassified last -- the same ordering used everywhere else.
  const sorted = [...actions].sort(
    (a, b) =>
      hocSortRank(a.hierarchy_of_controls as HocValue) -
        hocSortRank(b.hierarchy_of_controls as HocValue) ||
      (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999'),
  );

  const unclassified = actions.filter((a) => a.hierarchy_of_controls === null).length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <CardTitle>Corrective actions</CardTitle>
          {unclassified > 0 ? (
            <p className="mt-0.5 text-sm text-muted-foreground">
              {unclassified} of {actions.length} not yet classified by control level.
            </p>
          ) : null}
        </div>
        {canWrite && !adding ? (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            Add action
          </Button>
        ) : null}
      </CardHeader>

      <CardContent className="space-y-4">
        {adding ? (
          <div className="rounded-md border border-border p-3">
            <CorrectiveActionForm
              incidentId={incidentId}
              members={members}
              onDone={() => setAdding(false)}
            />
          </div>
        ) : null}

        {sorted.length === 0 && !adding ? (
          <p className="text-sm text-muted-foreground">
            No corrective actions recorded yet.
          </p>
        ) : null}

        {sorted.map((action) =>
          editingId === action.id ? (
            <div key={action.id} className="rounded-md border border-border p-3">
              <CorrectiveActionForm
                incidentId={incidentId}
                action={action}
                members={members}
                onDone={() => setEditingId(null)}
              />
            </div>
          ) : (
            <div key={action.id} className="rounded-md border border-border p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{action.description}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {action.status}
                    {action.due_date ? ` · due ${action.due_date}` : ''}
                    {action.completed_date ? ` · completed ${action.completed_date}` : ''}
                    {action.assigned_to_name || action.assigned_to_profile_id
                      ? ` · ${action.assigned_to_name ?? 'assigned'}`
                      : ''}
                  </p>
                  {action.verification_notes ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Verification: {action.verification_notes}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <HocBadge value={action.hierarchy_of_controls as HocValue} density="dense" />
                  {canWrite ? (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(action.id)}>
                        Edit
                      </Button>
                      <form
                        action={async () => {
                          await deleteCorrectiveAction(action.id, incidentId);
                        }}
                      >
                        <Button size="sm" variant="ghost" type="submit">
                          Delete
                        </Button>
                      </form>
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          ),
        )}

        {unclassified > 0 ? (
          <Callout tone="info">
            Classifying an action by control level is optional and can be done at any time —
            it is what turns a closed action into an auditable one.
          </Callout>
        ) : null}
      </CardContent>
    </Card>
  );
}
