import { cn } from '@/lib/utils';
import {
  HOC_UNCLASSIFIED,
  getHocLevel,
  type HocValue,
} from '@/lib/domain/hierarchy-of-controls';

/**
 * The badge ALWAYS renders the label text. Colour is reinforcement, never the carrier of
 * the meaning: a five-step single-hue ramp is not reliably distinguishable under
 * red-green colour vision deficiency, and the rule we would apply to hazard signage
 * applies to our own UI.
 *
 * `density="dense"` prefixes the rank ("3 · Engineering") for table and list contexts.
 * Unclassified renders "— · Unclassified" -- an em dash, because it has no rank.
 */
export function HocBadge({
  value,
  density = 'default',
  className,
}: {
  value: HocValue;
  density?: 'default' | 'dense';
  className?: string;
}) {
  const level = getHocLevel(value);
  const token = level?.token ?? HOC_UNCLASSIFIED.token;
  const label = level?.label ?? HOC_UNCLASSIFIED.label;
  const prefix = level ? String(level.rank) : '—';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded px-2 py-0.5 text-xs font-medium',
        // Static class names so Tailwind keeps them; see HOC_CLASS_SAFELIST.
        token === 0 && 'bg-hoc-0-bg text-hoc-0-fg',
        token === 1 && 'bg-hoc-1-bg text-hoc-1-fg',
        token === 2 && 'bg-hoc-2-bg text-hoc-2-fg',
        token === 3 && 'bg-hoc-3-bg text-hoc-3-fg',
        token === 4 && 'bg-hoc-4-bg text-hoc-4-fg',
        token === 5 && 'bg-hoc-5-bg text-hoc-5-fg',
        className,
      )}
    >
      {density === 'dense' ? (
        <>
          <span aria-hidden className="opacity-70">
            {prefix}
          </span>
          <span aria-hidden className="opacity-40">
            ·
          </span>
          <span>{label}</span>
          <span className="sr-only">
            {level ? `rank ${level.rank}, ${label}` : 'no rank, unclassified'}
          </span>
        </>
      ) : (
        label
      )}
    </span>
  );
}

/** A bare colour chip. Only ever used ALONGSIDE a text label, never instead of one. */
export function HocSwatch({ token, className }: { token: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-block h-8 w-2 shrink-0 rounded-sm',
        token === 0 && 'bg-hoc-0-bg',
        token === 1 && 'bg-hoc-1-bg',
        token === 2 && 'bg-hoc-2-bg',
        token === 3 && 'bg-hoc-3-bg',
        token === 4 && 'bg-hoc-4-bg',
        token === 5 && 'bg-hoc-5-bg',
        className,
      )}
    />
  );
}
