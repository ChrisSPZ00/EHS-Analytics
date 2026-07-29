'use client';

import { useActionState, useState } from 'react';

import { saveComplianceEvent, type FormState } from '@/app/(app)/compliance/actions';
import { DueStateBadge } from '@/components/compliance/compliance-badges';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { OBLIGATION_STATUSES } from '@/lib/domain/compliance';
import type { ComplianceEventRow } from '@/lib/data/compliance';
import { cn } from '@/lib/utils';

/**
 * One calendar entry, with its evidence.
 *
 * The evidence note and the name of whoever satisfied it live on the entry rather than on
 * the obligation, which is what turns the register into an audit trail: "we do this
 * annually" and "here is who did it in 2026, on this date, and what they filed" are
 * different claims, and only the second survives an inspection.
 */
export function ComplianceEventForm({ event }: { event: ComplianceEventRow }) {
  const action = saveComplianceEvent.bind(null, event.id!, event.obligation_id!);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, null);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};

  const [status, setStatus] = useState(event.status ?? 'Not Started');
  const [open, setOpen] = useState(false);

  const complete = Boolean(event.completed_date);

  return (
    <div
      id={`event-${event.id}`}
      className={cn('rounded-lg border border-border p-3', complete && 'bg-muted/40')}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium tabular-nums">{event.due_date}</span>
          <DueStateBadge state={event.state} daysUntilDue={event.days_until_due} />
          {complete ? (
            <span className="text-xs text-muted-foreground">
              Recorded {event.completed_date}
              {event.completed_by ? ` by ${event.completed_by}` : ''}
              {event.completed_on_time === false ? ' — after the due date' : ''}
            </span>
          ) : null}
        </div>
        <Button variant="ghost" size="sm" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          {open ? 'Close' : complete ? 'Edit record' : 'Record outcome'}
        </Button>
      </div>

      {event.evidence_notes && !open ? (
        <p className="mt-2 border-t border-border pt-2 text-sm text-muted-foreground">
          {event.evidence_notes}
        </p>
      ) : null}

      {open ? (
        <form action={formAction} className="mt-3 space-y-3 border-t border-border pt-3">
          {state && !state.ok ? (
            <p className="text-sm font-medium text-danger" role="alert">
              {state.message}
            </p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Status" htmlFor={`status-${event.id}`} error={errors.status}>
              <Select
                id={`status-${event.id}`}
                name="status"
                value={status}
                onChange={(e) => setStatus(e.target.value as typeof status)}
              >
                {OBLIGATION_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Date satisfied"
              htmlFor={`completed_date-${event.id}`}
              error={errors.completed_date}
              required={status === 'Compliant'}
              hint={
                status === 'Compliant'
                  ? 'The date the work was actually done.'
                  : 'Only set once the status is Compliant.'
              }
            >
              <Input
                id={`completed_date-${event.id}`}
                name="completed_date"
                type="date"
                defaultValue={event.completed_date ?? ''}
              />
            </Field>

            <Field label="Satisfied by" htmlFor={`completed_by-${event.id}`} error={errors.completed_by}>
              <Input
                id={`completed_by-${event.id}`}
                name="completed_by"
                defaultValue={event.completed_by ?? ''}
                placeholder="Name or role"
              />
            </Field>

            <Field
              label="Evidence"
              htmlFor={`evidence_notes-${event.id}`}
              error={errors.evidence_notes}
              className="sm:col-span-2 lg:col-span-4"
              hint="What was filed or done, and where the proof lives."
            >
              <Textarea
                id={`evidence_notes-${event.id}`}
                name="evidence_notes"
                defaultValue={event.evidence_notes ?? ''}
              />
            </Field>
          </div>

          <div className="flex items-center gap-2">
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? 'Saving…' : 'Save'}
            </Button>
            {state?.ok ? <span className="text-xs text-success">Saved.</span> : null}
          </div>
        </form>
      ) : null}
    </div>
  );
}
