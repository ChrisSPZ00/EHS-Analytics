'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import type { DashboardFilters } from '@/lib/data/dashboard';
import { cn } from '@/lib/utils';

/**
 * One filter row above everything it scopes — never per-chart filters. Every chart and
 * KPI on the page re-renders against this same slice.
 */
export function DashboardFilterBar({
  filters,
  sites,
  departments,
  availableYears,
}: {
  filters: DashboardFilters;
  sites: { id: string; name: string }[];
  departments: { id: string; name: string; site_id: string }[];
  availableYears: number[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const visibleDepartments = useMemo(
    () => (filters.siteId ? departments.filter((d) => d.site_id === filters.siteId) : departments),
    [departments, filters.siteId],
  );

  function update(mutate: (p: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    startTransition(() => router.push(`/dashboard?${params.toString()}`));
  }

  const usingCustomRange = Boolean(filters.from && filters.to);

  return (
    <div
      className={cn(
        'flex flex-wrap items-end gap-3 rounded-lg border border-border p-3 transition-opacity',
        // Hold the previous render rather than flashing a skeleton.
        pending && 'opacity-60',
      )}
    >
      <Field label="Reporting year" htmlFor="year" className="min-w-36">
        <Select
          id="year"
          value={usingCustomRange ? '' : String(filters.year ?? '')}
          onChange={(e) =>
            update((p) => {
              p.delete('from');
              p.delete('to');
              if (e.target.value) p.set('year', e.target.value);
              else p.delete('year');
            })
          }
        >
          {usingCustomRange ? <option value="">Custom range</option> : null}
          {availableYears.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="From" htmlFor="from" className="min-w-40">
        <Input
          id="from"
          type="date"
          defaultValue={filters.from ?? ''}
          onChange={(e) => update((p) => (e.target.value ? p.set('from', e.target.value) : p.delete('from')))}
        />
      </Field>
      <Field label="To" htmlFor="to" className="min-w-40">
        <Input
          id="to"
          type="date"
          defaultValue={filters.to ?? ''}
          onChange={(e) => update((p) => (e.target.value ? p.set('to', e.target.value) : p.delete('to')))}
        />
      </Field>

      <Field label="Site" htmlFor="site" className="min-w-44">
        <Select
          id="site"
          value={filters.siteId ?? ''}
          onChange={(e) =>
            update((p) => {
              if (e.target.value) p.set('site', e.target.value);
              else p.delete('site');
              p.delete('department');
            })
          }
        >
          <option value="">All sites</option>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Department" htmlFor="department" className="min-w-44">
        <Select
          id="department"
          value={filters.departmentId ?? ''}
          onChange={(e) =>
            update((p) => (e.target.value ? p.set('department', e.target.value) : p.delete('department')))
          }
        >
          <option value="">All departments</option>
          {visibleDepartments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>
      </Field>

      <Button variant="ghost" size="sm" onClick={() => startTransition(() => router.push('/dashboard'))}>
        Reset
      </Button>
    </div>
  );
}
