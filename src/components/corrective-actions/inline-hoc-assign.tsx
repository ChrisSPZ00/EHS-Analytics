'use client';

import { useState, useTransition } from 'react';

import { setHierarchyOfControls } from '@/app/(app)/incidents/actions';
import { HocSwatch } from '@/components/hierarchy-of-controls/hoc-badge';
import { Select } from '@/components/ui/field';
import { HOC_LEVELS, type HocValue } from '@/lib/domain/hierarchy-of-controls';

/**
 * Inline classification from the queue — no need to open each record.
 *
 * "Not classified yet" stays selectable after the fact, so a mistaken assignment can be
 * taken back to the unclassified state rather than being stuck on a level.
 */
export function InlineHocAssign({
  actionId,
  value,
}: {
  actionId: string;
  value: HocValue;
}) {
  const [current, setCurrent] = useState<HocValue>(value);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const options = [...HOC_LEVELS].sort((a, b) => a.rank - b.rank);

  return (
    <div className="flex items-center gap-2">
      <HocSwatch
        token={options.find((l) => l.code === current)?.token ?? 0}
        className="h-6 w-1.5"
      />
      <div>
        <Select
          aria-label="Assign control level"
          className="h-8 min-w-48 text-xs"
          value={current ?? ''}
          disabled={pending}
          onChange={(e) => {
            const next = (e.target.value || null) as HocValue;
            const previous = current;
            setCurrent(next);
            setError(null);
            startTransition(async () => {
              const result = await setHierarchyOfControls(actionId, next);
              if (!result.ok) {
                setCurrent(previous);
                setError(result.message ?? 'Could not save.');
              }
            });
          }}
        >
          <option value="">— · Not classified yet</option>
          {options.map((level) => (
            <option key={level.code} value={level.code}>
              {level.rank} · {level.label} — {level.description}
            </option>
          ))}
        </Select>
        {error ? <p className="mt-0.5 text-xs text-danger">{error}</p> : null}
      </div>
    </div>
  );
}
