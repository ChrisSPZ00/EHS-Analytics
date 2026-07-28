/**
 * Hierarchy of controls -- the single source of truth for the application layer.
 *
 * Mirrors the `public.hierarchy_of_control_levels` table. Rank lives here as data, not
 * as array position or enum declaration order, so that sorting is explicit everywhere:
 * ORDER BY rank ascending, Unclassified last.
 *
 * Unclassified is NOT a control level. It is the absence of one -- `null` in the
 * database -- and is modelled here as a separate constant rather than a sixth entry in
 * the ramp, so it cannot accidentally be rendered as a rung on the ladder or folded
 * into another level in a chart.
 */

export const HOC_CODES = [
  'elimination',
  'substitution',
  'engineering',
  'administrative',
  'ppe',
] as const;

export type HocCode = (typeof HOC_CODES)[number];

/** What the database stores: a code, or null for "not classified yet". */
export type HocValue = HocCode | null;

export interface HocLevel {
  code: HocCode;
  /** 1 is most effective. Sort ascending by this, never alphabetically. */
  rank: 1 | 2 | 3 | 4 | 5;
  label: string;
  /** One-line explanation, shown beside the swatch on the corrective action form. */
  description: string;
  /** Index into the --hoc-N-bg / --hoc-N-fg CSS variables. */
  token: 0 | 1 | 2 | 3 | 4 | 5;
}

/** Declared in rank order, but consumers should still sort by `rank` explicitly. */
export const HOC_LEVELS: readonly HocLevel[] = [
  {
    code: 'elimination',
    rank: 1,
    label: 'Elimination',
    description: 'Remove the hazard entirely',
    token: 1,
  },
  {
    code: 'substitution',
    rank: 2,
    label: 'Substitution',
    description: 'Replace with something less hazardous',
    token: 2,
  },
  {
    code: 'engineering',
    rank: 3,
    label: 'Engineering',
    description: 'Isolate people from the hazard',
    token: 3,
  },
  {
    code: 'administrative',
    rank: 4,
    label: 'Administrative',
    description: 'Change the way people work',
    token: 4,
  },
  {
    code: 'ppe',
    rank: 5,
    label: 'PPE',
    description: 'Protect the worker with equipment',
    token: 5,
  },
] as const;

/**
 * The unclassified state. Deliberately outside HOC_LEVELS: it has no rank, it sorts
 * last, and its token points at the neutral grey that sits outside the green ramp.
 */
export const HOC_UNCLASSIFIED = {
  code: null,
  rank: null,
  label: 'Unclassified',
  description: 'No control level assigned yet',
  token: 0,
  /** Sorts after every real rank. */
  sortRank: 999,
} as const;

/** Label shown for the "leave it unset" option on the corrective action form. */
export const HOC_UNCLASSIFIED_FORM_LABEL = 'Not classified yet';

const BY_CODE = new Map<HocCode, HocLevel>(HOC_LEVELS.map((l) => [l.code, l]));

export function getHocLevel(value: HocValue): HocLevel | null {
  return value === null ? null : (BY_CODE.get(value) ?? null);
}

/** Ascending rank, with Unclassified pushed to the end. */
export function hocSortRank(value: HocValue): number {
  return getHocLevel(value)?.rank ?? HOC_UNCLASSIFIED.sortRank;
}

export function hocLabel(value: HocValue): string {
  return getHocLevel(value)?.label ?? HOC_UNCLASSIFIED.label;
}

export function hocToken(value: HocValue): number {
  return getHocLevel(value)?.token ?? HOC_UNCLASSIFIED.token;
}

/**
 * Table and list density: the rank number as a small prefix, e.g. "3 · Engineering".
 * Unclassified renders as "— · Unclassified" -- an em dash, not a zero, because it has
 * no rank.
 */
export function hocDenseLabel(value: HocValue): string {
  const level = getHocLevel(value);
  return level ? `${level.rank} · ${level.label}` : `— · ${HOC_UNCLASSIFIED.label}`;
}

/** Tailwind classes for a badge. Always pair these with the label text, never alone. */
export function hocBadgeClasses(value: HocValue): string {
  const token = hocToken(value);
  return `bg-hoc-${token}-bg text-hoc-${token}-fg`;
}

/**
 * Ranks 1-3 (Elimination, Substitution, Engineering) are the "designed out" controls.
 *
 * Returns null -- not false -- for unclassified, because those records are excluded
 * from the maturity KPI's denominator rather than counted as a miss.
 */
export function isEngineeringOrAbove(value: HocValue): boolean | null {
  const level = getHocLevel(value);
  return level === null ? null : level.rank <= 3;
}

/**
 * Tailwind scans source files statically, so the dynamic class names built by
 * hocBadgeClasses() would otherwise be tree-shaken out of the stylesheet. Listing them
 * here keeps them in the build.
 *
 * @internal
 */
export const HOC_CLASS_SAFELIST = [
  'bg-hoc-0-bg', 'text-hoc-0-fg',
  'bg-hoc-1-bg', 'text-hoc-1-fg',
  'bg-hoc-2-bg', 'text-hoc-2-fg',
  'bg-hoc-3-bg', 'text-hoc-3-fg',
  'bg-hoc-4-bg', 'text-hoc-4-fg',
  'bg-hoc-5-bg', 'text-hoc-5-fg',
] as const;
