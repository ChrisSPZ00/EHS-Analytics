'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import {
  hasActiveComplianceFilters,
  type ComplianceFilters,
} from '@/lib/data/compliance-filters';
import { DUE_STATES, JURISDICTIONS } from '@/lib/domain/compliance';
import { cn } from '@/lib/utils';

/**
 * Filters live in the URL, not component state: the view is then shareable, survives a
 * refresh, and the CSV export can be a plain link that reuses the same query string.
 */
export function ComplianceFilterBar({
  filters,
  sites,
  programAreas,
}: {
  filters: ComplianceFilters;
  sites: { id: string; name: string }[];
  programAreas: string[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function update(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    startTransition(() => router.push(`/compliance?${params.toString()}`));
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

  const active = hasActiveComplianceFilters(filters);

  return (
    <div className={cn('space-y-3 rounded-lg border border-border p-3', pending && 'opacity-70')}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Site" htmlFor="site">
          <Select
            id="site"
            value={filters.orgWideOnly ? 'org' : (filters.siteId ?? '')}
            onChange={(e) => setSingle('site', e.target.value)}
          >
            <option value="">All sites</option>
            {/* Plenty of obligations belong to the company rather than to a location. */}
            <option value="org">Organisation-wide only</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Programme area" htmlFor="area">
          <Select
            id="area"
            value={filters.programArea ?? ''}
            onChange={(e) => setSingle('area', e.target.value)}
          >
            <option value="">All areas</option>
            {programAreas.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Search" htmlFor="q" hint="Obligation, permit, citation, agency, owner.">
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

        <Field label="Verification" htmlFor="unverified">
          <Select
            id="unverified"
            value={filters.unverifiedOnly ? '1' : ''}
            onChange={(e) => setSingle('unverified', e.target.value)}
          >
            <option value="">All obligations</option>
            <option value="1">Unverified only</option>
          </Select>
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <CheckGroup
          legend="Jurisdiction"
          name="jurisdiction"
          options={JURISDICTIONS}
          selected={filters.jurisdictions}
          onToggle={toggleMulti}
        />
        <CheckGroup
          legend="Due state"
          name="state"
          options={DUE_STATES}
          selected={filters.states}
          onToggle={toggleMulti}
        />
      </div>

      {active ? (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const params = new URLSearchParams();
              if (filters.view === 'list') params.set('view', 'list');
              else params.set('month', filters.month);
              startTransition(() => router.push(`/compliance?${params.toString()}`));
            }}
          >
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
