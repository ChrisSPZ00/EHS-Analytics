'use client';

import Link from 'next/link';
import { useActionState, useMemo, useState } from 'react';

import type { FormState } from '@/app/(app)/compliance/actions';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import {
  JURISDICTIONS,
  OBLIGATION_FREQUENCIES,
  OBLIGATION_STATUSES,
  calendarGap,
  complianceOccurrences,
  isScheduledFrequency,
  today,
  type ObligationFrequency,
} from '@/lib/domain/compliance';
import type { Database } from '@/lib/supabase/database.types';

type Obligation = Database['public']['Tables']['compliance_obligations']['Row'];

export function ObligationForm({
  action,
  obligation,
  sites,
  programAreas,
  submitLabel,
  cancelHref,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  obligation?: Obligation;
  sites: { id: string; name: string }[];
  programAreas: string[];
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, null);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};

  // The schedule preview is live, so a client sees the dates their entry produces before
  // they commit to it rather than discovering them on the calendar afterwards.
  const [frequency, setFrequency] = useState<ObligationFrequency>(
    obligation?.frequency ?? 'Annual',
  );
  const [dueDate, setDueDate] = useState(obligation?.due_date ?? '');
  const [recurrenceMonth, setRecurrenceMonth] = useState(
    obligation?.recurrence_month != null ? String(obligation.recurrence_month) : '',
  );
  const [recurrenceDay, setRecurrenceDay] = useState(
    obligation?.recurrence_day != null ? String(obligation.recurrence_day) : '',
  );

  const preview = useMemo(() => {
    const input = {
      frequency,
      due_date: dueDate || null,
      recurrence_month: recurrenceMonth ? Number(recurrenceMonth) : null,
      recurrence_day: recurrenceDay ? Number(recurrenceDay) : null,
    };
    return {
      gap: calendarGap(input),
      dates: complianceOccurrences(input, today()),
    };
  }, [frequency, dueDate, recurrenceMonth, recurrenceDay]);

  const scheduled = isScheduledFrequency(frequency);

  return (
    <form action={formAction} className="space-y-4">
      {obligation ? <input type="hidden" name="id" value={obligation.id} /> : null}

      {state && !state.ok ? (
        <Callout tone="danger" title="Could not save">
          {state.message}
        </Callout>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>The obligation</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field
            label="What has to be done"
            htmlFor="obligation"
            required
            error={errors.obligation}
            className="sm:col-span-2 lg:col-span-3"
            hint="In the words a new EHS manager would need — not the permit's shorthand."
          >
            <Textarea
              id="obligation"
              name="obligation"
              defaultValue={obligation?.obligation ?? ''}
              required
              placeholder="e.g. Submit the annual air emissions inventory to the state agency"
            />
          </Field>

          <Field label="Jurisdiction" htmlFor="jurisdiction" required error={errors.jurisdiction}>
            <Select
              id="jurisdiction"
              name="jurisdiction"
              defaultValue={obligation?.jurisdiction ?? 'Federal'}
              required
            >
              {JURISDICTIONS.map((j) => (
                <option key={j} value={j}>
                  {j}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Programme area"
            htmlFor="program_area"
            error={errors.program_area}
            hint="Air, Water, Waste, Process Safety, Occupational Safety…"
          >
            <Input
              id="program_area"
              name="program_area"
              list="program-areas"
              defaultValue={obligation?.program_area ?? ''}
            />
            <datalist id="program-areas">
              {programAreas.map((a) => (
                <option key={a} value={a} />
              ))}
            </datalist>
          </Field>

          <Field label="Agency" htmlFor="agency" error={errors.agency}>
            <Input id="agency" name="agency" defaultValue={obligation?.agency ?? ''} />
          </Field>

          <Field
            label="Permit reference"
            htmlFor="permit_ref"
            error={errors.permit_ref}
            hint="The permit or registration number this comes from."
          >
            <Input id="permit_ref" name="permit_ref" defaultValue={obligation?.permit_ref ?? ''} />
          </Field>

          <Field
            label="Citation"
            htmlFor="citation"
            error={errors.citation}
            hint="e.g. 40 CFR 112.6(a)"
          >
            <Input id="citation" name="citation" defaultValue={obligation?.citation ?? ''} />
          </Field>

          <Field
            label="Site"
            htmlFor="site_id"
            error={errors.site_id}
            hint="Leave organisation-wide for company-level filings."
          >
            <Select id="site_id" name="site_id" defaultValue={obligation?.site_id ?? ''}>
              <option value="">Organisation-wide</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Schedule</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Frequency" htmlFor="frequency" required error={errors.frequency}>
            <Select
              id="frequency"
              name="frequency"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as ObligationFrequency)}
              required
            >
              {OBLIGATION_FREQUENCIES.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label={frequency === 'One-time' ? 'Due date' : 'First due date'}
            htmlFor="due_date"
            error={errors.due_date}
            hint={scheduled ? 'Every later date is counted from here.' : 'Not used by this frequency.'}
          >
            <Input
              id="due_date"
              name="due_date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              disabled={!scheduled}
            />
          </Field>

          <Field
            label="Recurs in month"
            htmlFor="recurrence_month"
            error={errors.recurrence_month}
            hint="Used only when there is no first due date."
          >
            <Select
              id="recurrence_month"
              name="recurrence_month"
              value={recurrenceMonth}
              onChange={(e) => setRecurrenceMonth(e.target.value)}
              disabled={!scheduled}
            >
              <option value="">Not set</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="On day" htmlFor="recurrence_day" error={errors.recurrence_day}>
            <Select
              id="recurrence_day"
              name="recurrence_day"
              value={recurrenceDay}
              onChange={(e) => setRecurrenceDay(e.target.value)}
              disabled={!scheduled}
            >
              <option value="">Not set</option>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Lead time (days)"
            htmlFor="lead_time_days"
            error={errors.lead_time_days}
            hint="How far ahead this should start showing as due soon."
          >
            <Input
              id="lead_time_days"
              name="lead_time_days"
              type="number"
              min={0}
              defaultValue={obligation?.lead_time_days ?? 30}
            />
          </Field>

          <div className="sm:col-span-2 lg:col-span-3">
            <SchedulePreview gap={preview.gap} dates={preview.dates} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ownership and verification</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field
            label="Responsible party"
            htmlFor="responsible_party"
            error={errors.responsible_party}
          >
            <Input
              id="responsible_party"
              name="responsible_party"
              defaultValue={obligation?.responsible_party ?? ''}
              placeholder="Role or name"
            />
          </Field>

          <Field label="Status" htmlFor="status" error={errors.status}>
            <Select id="status" name="status" defaultValue={obligation?.status ?? 'Not Started'}>
              {OBLIGATION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>

          <div className="flex items-end">
            {/* An unchecked checkbox submits nothing at all, which Zod would read as
                undefined rather than false. The paired hidden input guarantees a value. */}
            <label className="flex items-start gap-2 text-sm">
              <input type="hidden" name="is_verified" value="" />
              <input
                type="checkbox"
                name="is_verified"
                value="true"
                defaultChecked={obligation?.is_verified ?? false}
                className="mt-0.5 h-4 w-4 accent-[var(--primary)]"
              />
              <span>
                Verified against the source
                <span className="block text-xs text-muted-foreground">
                  Tick only once somebody has read this off the permit or rule text. Until
                  then it carries a visible &ldquo;Unverified&rdquo; badge.
                </span>
              </span>
            </label>
          </div>

          <Field
            label="Notes"
            htmlFor="notes"
            error={errors.notes}
            className="sm:col-span-2 lg:col-span-3"
          >
            <Textarea id="notes" name="notes" defaultValue={obligation?.notes ?? ''} />
          </Field>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : submitLabel}
        </Button>
        <Link href={cancelHref}>
          <Button type="button" variant="ghost">
            Cancel
          </Button>
        </Link>
      </div>
    </form>
  );
}

/**
 * What this obligation will actually put on the calendar.
 *
 * Showing the dates before the save is the difference between a recurrence rule a client
 * trusts and one they have to reverse-engineer. When there are no dates, the panel says
 * why in words rather than sitting empty — and the save still goes through, because an
 * obligation whose deadline is not yet known still belongs in the register.
 */
function SchedulePreview({ gap, dates }: { gap: string | null; dates: string[] }) {
  if (gap) {
    return (
      <Callout tone="warning" title="This will not appear on the calendar">
        {gap}
      </Callout>
    );
  }

  return (
    <div className="rounded-md border border-border bg-muted/50 px-3 py-2 text-sm">
      <p className="font-medium">
        {dates.length === 1
          ? 'One date will be scheduled'
          : `${dates.length} dates will be scheduled`}
      </p>
      <p className="mt-1 font-mono text-xs tabular-nums text-muted-foreground">
        {dates.slice(0, 8).join('  ·  ')}
        {dates.length > 8 ? `  ·  … through ${dates[dates.length - 1]}` : ''}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Dates already recorded as done are never disturbed by a change here.
      </p>
    </div>
  );
}
