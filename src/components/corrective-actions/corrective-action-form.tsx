'use client';

import { useActionState, useState } from 'react';

import { HocSelector } from '@/components/hierarchy-of-controls/hoc-selector';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { saveCorrectiveAction, type FormState } from '@/app/(app)/incidents/actions';
import { CORRECTIVE_ACTION_STATUSES } from '@/lib/domain/incidents';
import type { HocValue } from '@/lib/domain/hierarchy-of-controls';
import type { Database } from '@/lib/supabase/database.types';

type CorrectiveAction = Database['public']['Tables']['corrective_actions']['Row'];

export function CorrectiveActionForm({
  incidentId,
  action,
  members,
  onDone,
}: {
  incidentId: string;
  action?: CorrectiveAction;
  members: { id: string; label: string }[];
  onDone?: () => void;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    async (prev, formData) => {
      const result = await saveCorrectiveAction(prev, formData);
      if (result?.ok) onDone?.();
      return result;
    },
    null,
  );

  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};

  // Controlled so that "unclassified" is a real, selectable value rather than the
  // absence of a selection. The initial value is whatever is stored -- never a default.
  const [hoc, setHoc] = useState<HocValue>(
    (action?.hierarchy_of_controls as HocValue) ?? null,
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="incident_id" value={incidentId} />
      {action ? <input type="hidden" name="id" value={action.id} /> : null}
      {/* Submits '' when unclassified, which the schema maps back to null. */}
      <input type="hidden" name="hierarchy_of_controls" value={hoc ?? ''} />

      {state && !state.ok ? (
        <Callout tone="danger" title="Could not save">
          {state.message}
        </Callout>
      ) : null}

      <Field label="Action" htmlFor="description" required error={errors.description}>
        <Textarea
          id="description"
          name="description"
          defaultValue={action?.description ?? ''}
          placeholder="What will be done to stop this recurring?"
          required
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Assigned to (user)" htmlFor="assigned_to_profile_id">
          <Select
            id="assigned_to_profile_id"
            name="assigned_to_profile_id"
            defaultValue={action?.assigned_to_profile_id ?? ''}
          >
            <option value="">Not a system user</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Assigned to (name)"
          htmlFor="assigned_to_name"
          hint="For people without a login."
        >
          <Input
            id="assigned_to_name"
            name="assigned_to_name"
            defaultValue={action?.assigned_to_name ?? ''}
          />
        </Field>
        <Field label="Due date" htmlFor="due_date" error={errors.due_date}>
          <Input id="due_date" name="due_date" type="date" defaultValue={action?.due_date ?? ''} />
        </Field>
        <Field label="Status" htmlFor="status">
          <Select id="status" name="status" defaultValue={action?.status ?? 'Not Started'}>
            {CORRECTIVE_ACTION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Completed date" htmlFor="completed_date" error={errors.completed_date}>
          <Input
            id="completed_date"
            name="completed_date"
            type="date"
            defaultValue={action?.completed_date ?? ''}
          />
        </Field>
        <Field label="Verification notes" htmlFor="verification_notes">
          <Input
            id="verification_notes"
            name="verification_notes"
            defaultValue={action?.verification_notes ?? ''}
            placeholder="How was the fix confirmed?"
          />
        </Field>
      </div>

      <div className="rounded-md border border-border p-3">
        <HocSelector value={hoc} onChange={setHoc} name="hoc_choice" />
      </div>

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? 'Saving…' : action ? 'Save changes' : 'Add corrective action'}
        </Button>
        {onDone ? (
          <Button type="button" size="sm" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}
