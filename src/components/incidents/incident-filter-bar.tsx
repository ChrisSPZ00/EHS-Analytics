'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import {
  INCIDENT_CLASSIFICATIONS,
  INCIDENT_TYPES,
  SEVERITY_RATINGS,
  SHIFTS,
} from '@/lib/domain/incidents';
import { hasActiveFilters, type IncidentFilters } from '@/lib/data/incident-filters';
import { cn } from '@/lib/utils';

interface Option {
  id: string;
  name: string;
}

/**
 * Filters live in the URL, not component state: the view is then shareable, survives a
 * refresh, and the CSV export can be a plain link that reuses the same query string.
 */
export function IncidentFilterBar({
  filters,
  sites,
  departments,
}: {
  filters: IncidentFilters;
  sites: Option[];
  departments: (Option & { site_id: string })[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  // Departments follow the selected site, matching the dependent dropdowns on the form.
  const visibleDepartments = useMemo(
    () => (filters.siteId ? departments.filter((d) => d.site_id === filters.siteId) : departments),
    [departments, filters.siteId],
  );

  function update(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    params.delete('page'); // any filter change invalidates the current page offset
    startTransition(() => router.push(`/incidents?${params.toString()}`));
  }

  function setSingle(key: string, value: string) {
    update((p) => (value ? p.set(key, value) : p.delete(key)));
  }

  function toggleMulti(key: string, value: string, checked: boolean) {
    update((p) => {
      const current = p.getAll(key).filter((v) => v !== value);
      p.delete(key);
      for (const v of current) p.append(key, v);
      if (checked) p.append(key, value);
    });
  }

  const active = hasActiveFilters(filters);

  return (
    <div className={cn('space-y-3 rounded-lg border border-border p-3', pending && 'opacity-70')}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Field label="From" htmlFor="from">
          <Input
            id="from"
            type="date"
            defaultValue={filters.from ?? ''}
            onChange={(e) => setSingle('from', e.target.value)}
          />
        </Field>
        <Field label="To" htmlFor="to">
          <Input
            id="to"
            type="date"
            defaultValue={filters.to ?? ''}
            onChange={(e) => setSingle('to', e.target.value)}
          />
        </Field>
        <Field label="Site" htmlFor="site">
          <Select
            id="site"
            value={filters.siteId ?? ''}
            onChange={(e) => {
              const siteId = e.target.value;
              update((p) => {
                if (siteId) p.set('site', siteId);
                else p.delete('site');
                p.delete('department'); // stale once the site changes
              });
            }}
          >
            <option value="">All sites</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Department" htmlFor="department">
          <Select
            id="department"
            value={filters.departmentId ?? ''}
            onChange={(e) => setSingle('department', e.target.value)}
          >
            <option value="">All departments</option>
            {visibleDepartments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Search" htmlFor="q" hint="Description, root cause, injury, claim ref.">
          <Input
            id="q"
            type="search"
            defaultValue={filters.search ?? ''}
            placeholder="Search text…"
            onKeyDown={(e) => {
              if (e.key === 'Enter') setSingle('q', (e.target as HTMLInputElement).value.trim());
            }}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v !== (filters.search ?? '')) setSingle('q', v);
            }}
          />
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <CheckGroup
          legend="Type"
          name="type"
          options={INCIDENT_TYPES}
          selected={filters.types}
          onToggle={toggleMulti}
        />
        <CheckGroup
          legend="Classification"
          name="classification"
          options={INCIDENT_CLASSIFICATIONS}
          selected={filters.classifications}
          onToggle={toggleMulti}
        />
        <CheckGroup
          legend="Shift"
          name="shift"
          options={SHIFTS}
          selected={filters.shifts}
          onToggle={toggleMulti}
        />
        <CheckGroup
          legend="Severity"
          name="severity"
          options={SEVERITY_RATINGS}
          selected={filters.severities}
          onToggle={toggleMulti}
        />
      </div>

      {active ? (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={() => startTransition(() => router.push('/incidents'))}>
            Clear all filters
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function CheckGroup({
  legend,
  name,
  options,
  selected,
  onToggle,
}: {
  legend: string;
  name: string;
  options: readonly string[];
  selected: readonly string[];
  onToggle: (name: string, value: string, checked: boolean) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-1 text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {options.map((option) => (
          <label key={option} className="flex items-center gap-1.5 text-sm">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 accent-[var(--primary)]"
              checked={selected.includes(option)}
              onChange={(e) => onToggle(name, option, e.target.checked)}
            />
            <span className="text-muted-foreground">{option}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
