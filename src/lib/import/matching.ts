import { FIELD_BY_KEY, IMPORT_FIELDS } from './fields';
import { HOC_LEVELS, type HocCode } from '@/lib/domain/hierarchy-of-controls';

/** Lowercase, strip punctuation, collapse whitespace. */
export function normalise(value: string): string {
  return value
    .toLowerCase()
    .replace(/[_\-/\\.]+/g, ' ')
    .replace(/[^a-z0-9 ]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Levenshtein distance, iterative with a single row buffer. */
function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = curr;
  }
  return prev[b.length];
}

/** 0..1, where 1 is identical. */
export function similarity(a: string, b: string): number {
  const x = normalise(a);
  const y = normalise(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  if (x.includes(y) || y.includes(x)) return 0.9;
  const distance = editDistance(x, y);
  return 1 - distance / Math.max(x.length, y.length);
}

export interface ColumnSuggestion {
  fieldKey: string;
  confidence: number;
}

/**
 * Suggests a field for a spreadsheet header. Exact alias hits win outright; otherwise the
 * best fuzzy score above the floor is offered.
 *
 * These are SUGGESTIONS. The mapping step shows every one of them for the user to
 * correct before anything is read as data.
 */
export function suggestFieldForHeader(header: string): ColumnSuggestion | null {
  const normalisedHeader = normalise(header);
  if (!normalisedHeader) return null;

  let best: ColumnSuggestion | null = null;

  for (const field of IMPORT_FIELDS) {
    const candidates = [field.label, ...field.aliases];
    for (const candidate of candidates) {
      if (normalise(candidate) === normalisedHeader) {
        return { fieldKey: field.key, confidence: 1 };
      }
      const score = similarity(header, candidate);
      if (!best || score > best.confidence) best = { fieldKey: field.key, confidence: score };
    }
  }

  return best && best.confidence >= 0.72 ? best : null;
}

/** One field per column: the highest-confidence header wins a contested field. */
export function suggestColumnMapping(headers: string[]): Record<string, string | null> {
  const scored = headers
    .map((header) => ({ header, suggestion: suggestFieldForHeader(header) }))
    .sort((a, b) => (b.suggestion?.confidence ?? 0) - (a.suggestion?.confidence ?? 0));

  const mapping: Record<string, string | null> = Object.fromEntries(
    headers.map((h) => [h, null]),
  );
  const taken = new Set<string>();

  for (const { header, suggestion } of scored) {
    if (suggestion && !taken.has(suggestion.fieldKey)) {
      mapping[header] = suggestion.fieldKey;
      taken.add(suggestion.fieldKey);
    }
  }

  return mapping;
}

/**
 * Known synonyms that edit distance cannot bridge.
 *
 * "1st" and "First" share almost no characters, but a shift column spelled with ordinals
 * is one of the most common things a client spreadsheet contains. Same for "Lost Time"
 * meaning LTI. These are still only SUGGESTIONS -- the mapping step shows every one for
 * confirmation before it is applied to any row.
 */
const VALUE_ALIASES: Record<string, Record<string, string>> = {
  shift: {
    '1st': 'First', '1': 'First', one: 'First', day: 'First', days: 'First', a: 'First',
    '2nd': 'Second', '2': 'Second', two: 'Second', swing: 'Second', evening: 'Second', afternoon: 'Second', b: 'Second',
    '3rd': 'Third', '3': 'Third', three: 'Third', night: 'Third', nights: 'Third', graveyard: 'Third', c: 'Third',
  },
  incident_type: {
    recordable: 'OSHA Recordable',
    osha: 'OSHA Recordable',
    'osha recordable case': 'OSHA Recordable',
    firstaid: 'First Aid',
    fa: 'First Aid',
    nearmiss: 'Near Miss',
    'close call': 'Near Miss',
    'good catch': 'Near Miss',
    nm: 'Near Miss',
    property: 'Property Damage',
    hazard: 'Hazard',
    'unsafe condition': 'Hazard',
  },
  classification: {
    'lost time': 'LTI',
    'lost time injury': 'LTI',
    losttime: 'LTI',
    'medical treatment': 'MTI',
    'medical treatment injury': 'MTI',
    medical: 'MTI',
    'first aid': 'FAI',
    'first aid injury': 'FAI',
    firstaid: 'FAI',
  },
  severity_rating: {
    '1': '1 - Insignificant', insignificant: '1 - Insignificant', negligible: '1 - Insignificant',
    '2': '2 - Minor', minor: '2 - Minor', low: '2 - Minor',
    '3': '3 - Significant', significant: '3 - Significant', moderate: '3 - Significant', medium: '3 - Significant',
    '4': '4 - Major', major: '4 - Major', high: '4 - Major', serious: '4 - Major',
    '5': '5 - Severe', severe: '5 - Severe', critical: '5 - Severe', catastrophic: '5 - Severe',
  },
};

/**
 * Value-level suggestions for enum fields, e.g. "Recordable" -> "OSHA Recordable".
 * Returns null rather than a weak guess.
 */
export function suggestEnumValue(fieldKey: string, raw: string): string | null {
  const field = FIELD_BY_KEY.get(fieldKey);
  if (!field?.options) return null;

  const value = normalise(raw);
  if (!value) return null;

  for (const option of field.options) {
    if (normalise(option) === value) return option;
  }

  const alias = VALUE_ALIASES[fieldKey]?.[value];
  if (alias) return alias;

  let best: { option: string; score: number } | null = null;
  for (const option of field.options) {
    const score = similarity(raw, option);
    if (!best || score > best.score) best = { option, score };
  }

  return best && best.score >= 0.6 ? best.option : null;
}

/**
 * Hierarchy-of-controls value mapping.
 *
 * The keyword table is the one from the spec. Note what happens to anything it does not
 * recognise: null. A value that is not clearly one of the five levels imports as
 * unclassified — never as a nearest match — and even a recognised keyword is only ever
 * PROPOSED, never auto-committed.
 */
const HOC_KEYWORDS: { pattern: RegExp; code: HocCode }[] = [
  { pattern: /\b(eliminat\w*|remov\w*|design\s*out)\b/, code: 'elimination' },
  { pattern: /\b(substitut\w*|replac\w*|swap)\b/, code: 'substitution' },
  { pattern: /\b(engineer\w*|guard\w*|isolat\w*|ventilat\w*|interlock)\b/, code: 'engineering' },
  {
    pattern: /\b(administrat\w*|admin|procedur\w*|train\w*|policy|policies|sop|signage|rotation)\b/,
    code: 'administrative',
  },
  { pattern: /\b(ppe|personal\s+protective(\s+equipment)?|respirator|gloves|harness)\b/, code: 'ppe' },
];

export function suggestHierarchyOfControls(raw: string): HocCode | null {
  const value = normalise(raw);
  if (!value) return null;

  for (const level of HOC_LEVELS) {
    if (normalise(level.label) === value || level.code === value) return level.code;
  }

  for (const { pattern, code } of HOC_KEYWORDS) {
    if (pattern.test(value)) return code;
  }

  return null;
}

const TRUTHY = new Set(['true', 'yes', 'y', '1', 'x', 't', 'checked']);
const FALSY = new Set(['false', 'no', 'n', '0', 'f', 'unchecked', '']);

export function parseBoolean(raw: string): boolean | null {
  const value = normalise(raw);
  if (TRUTHY.has(value)) return true;
  if (FALSY.has(value)) return false;
  return null;
}

/**
 * Accepts the date shapes that turn up in client spreadsheets and returns ISO
 * YYYY-MM-DD, or null when the value is genuinely unreadable.
 *
 * Ambiguous numeric dates are read as US month-first, matching the source of these
 * sheets. Where a value can only be day-first (a month above 12) that reading is used
 * instead, so 25/12/2024 is not silently discarded.
 */
export function parseDate(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(value);
  if (iso) return buildDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const slash = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(value);
  if (slash) {
    const [, a, b, y] = slash;
    let year = Number(y);
    if (year < 100) year += year < 70 ? 2000 : 1900;
    let month = Number(a);
    let day = Number(b);
    if (month > 12 && day <= 12) [month, day] = [day, month];
    return buildDate(year, month, day);
  }

  // Excel serial date (days since 1899-12-30).
  if (/^\d{5}$/.test(value)) {
    const serial = Number(value);
    const ms = Date.UTC(1899, 11, 30) + serial * 86_400_000;
    return new Date(ms).toISOString().slice(0, 10);
  }

  const parsed = Date.parse(value);
  if (!Number.isNaN(parsed)) return new Date(parsed).toISOString().slice(0, 10);

  return null;
}

function buildDate(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date.toISOString().slice(0, 10);
}

export function parseNumber(raw: string): number | null {
  const cleaned = raw.replace(/[$,\s]/g, '').replace(/[()]/g, '');
  if (!cleaned) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}
