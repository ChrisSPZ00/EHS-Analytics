'use client';

import Link from 'next/link';
import { useActionState, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import type { FormState } from '@/app/(app)/incidents/actions';
import {
  INCIDENT_CLASSIFICATIONS,
  INCIDENT_TYPES,
  ROOT_CAUSE_CATEGORIES,
  SEVERITY_RATINGS,
  SHIFTS,
} from '@/lib/domain/incidents';
import type { Database } from '@/lib/supabase/database.types';

type Incident = Database['public']['Tables']['incidents']['Row'];

export interface IncidentFormOptions {
  sites: { id: string; name: string }[];
  departments: { id: string; name: string; site_id: string }[];
  employees: {
    id: string;
    site_id: string;
    department_id: string | null;
    label: string;
  }[];
  injuryTypes: string[];
  bodyParts: string[];
}

export function IncidentForm({
  action,
  incident,
  options,
  submitLabel,
  cancelHref,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  incident?: Incident;
  options: IncidentFormOptions;
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, null);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};

  // Dependent dropdowns: site narrows department, and the pair narrows employee.
  const [siteId, setSiteId] = useState(incident?.site_id ?? '');
  const [departmentId, setDepartmentId] = useState(incident?.department_id ?? '');

  const departments = useMemo(
    () => options.departments.filter((d) => !siteId || d.site_id === siteId),
    [options.departments, siteId],
  );

  const employees = useMemo(
    () =>
      options.employees.filter(
        (e) =>
          (!siteId || e.site_id === siteId) &&
          (!departmentId || e.department_id === departmentId),
      ),
    [options.employees, siteId, departmentId],
  );

  return (
    <form action={formAction} className="space-y-4">
      {state && !state.ok ? (
        <Callout tone="danger" title="Could not save">
          {state.message}
        </Callout>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Where and when</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Incident date" htmlFor="incident_date" required error={errors.incident_date}>
            <Input
              id="incident_date"
              name="incident_date"
              type="date"
              defaultValue={incident?.incident_date ?? ''}
              required
            />
          </Field>
          <Field
            label="Reported date"
            htmlFor="reported_date"
            error={errors.reported_date}
            hint="Leave blank if unknown."
          >
            <Input
              id="reported_date"
              name="reported_date"
              type="date"
              defaultValue={incident?.reported_date ?? ''}
            />
          </Field>
          <Field label="Shift" htmlFor="shift" error={errors.shift}>
            <Select id="shift" name="shift" defaultValue={incident?.shift ?? ''}>
              <option value="">Not recorded</option>
              {SHIFTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Site" htmlFor="site_id" required error={errors.site_id}>
            <Select
              id="site_id"
              name="site_id"
              value={siteId}
              onChange={(e) => {
                setSiteId(e.target.value);
                setDepartmentId('');
              }}
              required
            >
              <option value="">Select a site…</option>
              {options.sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Department" htmlFor="department_id" error={errors.department_id}>
            <Select
              id="department_id"
              name="department_id"
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              disabled={!siteId}
            >
              <option value="">{siteId ? 'Not recorded' : 'Select a site first'}</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Employee"
            htmlFor="employee_id"
            error={errors.employee_id}
            hint="Near misses and property damage often have none."
          >
            <Select
              id="employee_id"
              name="employee_id"
              defaultValue={incident?.employee_id ?? ''}
              disabled={!siteId}
            >
              <option value="">No employee involved</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.label}
                </option>
              ))}
            </Select>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>What happened</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Incident type" htmlFor="incident_type" required error={errors.incident_type}>
            <Select
              id="incident_type"
              name="incident_type"
              defaultValue={incident?.incident_type ?? ''}
              required
            >
              <option value="">Select a type…</option>
              {INCIDENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Classification" htmlFor="classification" error={errors.classification}>
            <Select
              id="classification"
              name="classification"
              defaultValue={incident?.classification ?? ''}
            >
              <option value="">Not classified</option>
              {INCIDENT_CLASSIFICATIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Severity" htmlFor="severity_rating" error={errors.severity_rating}>
            <Select
              id="severity_rating"
              name="severity_rating"
              defaultValue={incident?.severity_rating ?? ''}
            >
              <option value="">Not rated</option>
              {SEVERITY_RATINGS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Injury type" htmlFor="injury_type" error={errors.injury_type}>
            <Input
              id="injury_type"
              name="injury_type"
              list="injury-types"
              defaultValue={incident?.injury_type ?? ''}
              placeholder="e.g. Strain"
            />
            <datalist id="injury-types">
              {options.injuryTypes.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </Field>
          <Field label="Body part" htmlFor="body_part" error={errors.body_part}>
            <Input
              id="body_part"
              name="body_part"
              list="body-parts"
              defaultValue={incident?.body_part ?? ''}
              placeholder="e.g. Back"
            />
            <datalist id="body-parts">
              {options.bodyParts.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </Field>
          <Field label="Claim reference" htmlFor="claim_ref" error={errors.claim_ref}>
            <Input id="claim_ref" name="claim_ref" defaultValue={incident?.claim_ref ?? ''} />
          </Field>

          <Field
            label="Description"
            htmlFor="description"
            error={errors.description}
            className="sm:col-span-2 lg:col-span-3"
          >
            <Textarea
              id="description"
              name="description"
              defaultValue={incident?.description ?? ''}
              placeholder="What happened, in the reporter's own words."
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cause and circumstances</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field
            label="Root cause category"
            htmlFor="root_cause_category"
            error={errors.root_cause_category}
          >
            <Select
              id="root_cause_category"
              name="root_cause_category"
              defaultValue={incident?.root_cause_category ?? ''}
            >
              <option value="">Not determined</option>
              {ROOT_CAUSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Root cause detail"
            htmlFor="root_cause_detail"
            error={errors.root_cause_detail}
            className="sm:col-span-1 lg:col-span-2"
          >
            <Input
              id="root_cause_detail"
              name="root_cause_detail"
              defaultValue={incident?.root_cause_detail ?? ''}
            />
          </Field>

          <fieldset className="sm:col-span-2 lg:col-span-3">
            <legend className="mb-2 text-sm font-medium">Circumstances</legend>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <Toggle name="machine_involved" label="Machine involved" defaultChecked={incident?.machine_involved} />
              <Toggle name="safety_violation" label="Safety violation" defaultChecked={incident?.safety_violation} />
              <Toggle
                name="recently_transferred"
                label="Recently transferred"
                defaultChecked={incident?.recently_transferred}
              />
              <Toggle name="is_lost_time" label="Lost time" defaultChecked={incident?.is_lost_time} />
            </div>
          </fieldset>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Outcome</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Days away" htmlFor="days_away" error={errors.days_away}>
            <Input
              id="days_away"
              name="days_away"
              type="number"
              min={0}
              defaultValue={incident?.days_away ?? 0}
            />
          </Field>
          <Field label="Days restricted" htmlFor="days_restricted" error={errors.days_restricted}>
            <Input
              id="days_restricted"
              name="days_restricted"
              type="number"
              min={0}
              defaultValue={incident?.days_restricted ?? 0}
            />
          </Field>
          <Field label="Expected cost" htmlFor="expected_cost" error={errors.expected_cost}>
            <Input
              id="expected_cost"
              name="expected_cost"
              type="number"
              min={0}
              step="0.01"
              defaultValue={incident?.expected_cost ?? ''}
            />
          </Field>
          <Field
            label="Actual cost to date"
            htmlFor="actual_cost_to_date"
            error={errors.actual_cost_to_date}
          >
            <Input
              id="actual_cost_to_date"
              name="actual_cost_to_date"
              type="number"
              min={0}
              step="0.01"
              defaultValue={incident?.actual_cost_to_date ?? ''}
            />
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
 * An unchecked checkbox submits nothing at all, which Zod would read as undefined rather
 * than false. The paired hidden input guarantees a value is always present.
 */
function Toggle({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked?: boolean | null;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="hidden" name={name} value="" />
      <input
        type="checkbox"
        name={name}
        value="true"
        defaultChecked={defaultChecked ?? false}
        className="h-4 w-4 accent-[var(--primary)]"
      />
      {label}
    </label>
  );
}
