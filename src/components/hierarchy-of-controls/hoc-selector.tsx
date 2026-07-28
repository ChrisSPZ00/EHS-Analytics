'use client';

import { cn } from '@/lib/utils';
import {
  HOC_LEVELS,
  HOC_UNCLASSIFIED,
  HOC_UNCLASSIFIED_FORM_LABEL,
  type HocValue,
} from '@/lib/domain/hierarchy-of-controls';

import { HocSwatch } from './hoc-badge';

/**
 * The five levels as a vertical stack in rank order, top to bottom, each with its colour
 * swatch and one-line description, plus "Not classified yet" at the bottom.
 *
 * The visual gradient is doing teaching work here: someone reaching for PPE should see
 * it sitting at the bottom of the ladder. That is why this is a stack rather than a
 * dropdown, even though a dropdown would be less markup.
 *
 * The default is unset. No level is preselected -- an unclassified action is a valid,
 * saveable state, and preselecting one would silently manufacture data the client never
 * entered.
 */
export function HocSelector({
  name = 'hierarchy_of_controls',
  value,
  onChange,
  disabled,
}: {
  name?: string;
  value: HocValue;
  onChange: (value: HocValue) => void;
  disabled?: boolean;
}) {
  const options = [...HOC_LEVELS].sort((a, b) => a.rank - b.rank);

  return (
    <fieldset disabled={disabled} className="space-y-2">
      <legend className="text-sm font-medium">Hierarchy of controls</legend>
      <p className="text-xs text-muted-foreground">
        Optional. Leave it unclassified if you are not sure yet — you can come back to it.
      </p>

      <div className="mt-2 space-y-1.5">
        {options.map((level) => {
          const checked = value === level.code;
          return (
            <label
              key={level.code}
              className={cn(
                'flex cursor-pointer items-center gap-3 rounded-md border p-2 transition-colors',
                checked
                  ? 'border-ring bg-muted ring-1 ring-ring'
                  : 'border-border hover:bg-muted/60',
                disabled && 'cursor-not-allowed opacity-60',
              )}
            >
              <input
                type="radio"
                name={name}
                value={level.code}
                checked={checked}
                onChange={() => onChange(level.code)}
                className="h-4 w-4 shrink-0 accent-[var(--primary)]"
              />
              <HocSwatch token={level.token} />
              <span className="min-w-0">
                <span className="block text-sm font-medium">
                  <span className="mr-1.5 text-muted-foreground">{level.rank}</span>
                  {level.label}
                </span>
                <span className="block text-xs text-muted-foreground">{level.description}</span>
              </span>
            </label>
          );
        })}

        {/* Bottom of the list, visually separated: it is not a sixth rung on the ladder. */}
        <label
          className={cn(
            'mt-2 flex cursor-pointer items-center gap-3 rounded-md border border-dashed p-2 transition-colors',
            value === null
              ? 'border-ring bg-muted ring-1 ring-ring'
              : 'border-border hover:bg-muted/60',
            disabled && 'cursor-not-allowed opacity-60',
          )}
        >
          <input
            type="radio"
            name={name}
            value=""
            checked={value === null}
            onChange={() => onChange(null)}
            className="h-4 w-4 shrink-0 accent-[var(--primary)]"
          />
          <HocSwatch token={HOC_UNCLASSIFIED.token} />
          <span className="min-w-0">
            <span className="block text-sm font-medium">
              <span className="mr-1.5 text-muted-foreground">—</span>
              {HOC_UNCLASSIFIED_FORM_LABEL}
            </span>
            <span className="block text-xs text-muted-foreground">
              {HOC_UNCLASSIFIED.description}
            </span>
          </span>
        </label>
      </div>
    </fieldset>
  );
}
