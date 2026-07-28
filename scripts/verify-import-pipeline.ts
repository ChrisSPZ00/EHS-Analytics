/**
 * Exercises the CSV import pipeline end to end against a deliberately messy fixture:
 * header matching, value matching, date parsing, duplicate detection and the
 * hierarchy-of-controls rules.
 *
 * Run: npm run verify:import
 *
 * It asserts the behaviours the spec is explicit about, so a regression in any of them
 * fails the run rather than being noticed later in a client's data.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import Papa from 'papaparse';

import { suggestColumnMapping, suggestEnumValue, suggestHierarchyOfControls, parseDate } from '@/lib/import/matching';
import { validateRows } from '@/lib/import/validate';
import { FIELD_BY_KEY } from '@/lib/import/fields';

const FIXTURE = join(process.cwd(), 'fixtures', 'messy-incidents.csv');

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures += 1;
  console.log(
    `  ${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : `\n         expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`}`,
  );
}

// ---------------------------------------------------------------------------
console.log('\nDate parsing (the shapes that turn up in client spreadsheets)');
check('3/14/2024 reads month-first', parseDate('3/14/2024'), '2024-03-14');
check('25/12/2024 falls back to day-first', parseDate('25/12/2024'), '2024-12-25');
check('ISO passes through', parseDate('2024-04-02'), '2024-04-02');
check('2-digit year', parseDate('6/1/19'), '2019-06-01');
check('Excel serial', parseDate('45000'), '2023-03-15');
check('garbage is null, not a guess', parseDate('not a date'), null);
check('31 February is rejected', parseDate('2/31/2024'), null);

// ---------------------------------------------------------------------------
console.log('\nEnum value matching');
check('"Recordable" -> OSHA Recordable', suggestEnumValue('incident_type', 'Recordable'), 'OSHA Recordable');
check('"1st" -> First', suggestEnumValue('shift', '1st'), 'First');
check('"Nights" -> Third', suggestEnumValue('shift', 'Nights'), 'Third');
check('"Second" -> Second', suggestEnumValue('shift', 'Second'), 'Second');
check('"Lost Time" -> LTI', suggestEnumValue('classification', 'Lost Time'), 'LTI');
check('"Close Call" -> Near Miss', suggestEnumValue('incident_type', 'Close Call'), 'Near Miss');
check('nonsense stays null', suggestEnumValue('incident_type', 'qqzzx'), null);

// ---------------------------------------------------------------------------
console.log('\nHierarchy-of-controls value matching (the spec keyword table)');
check('"engineering control"', suggestHierarchyOfControls('engineering control'), 'engineering');
check('"admin"', suggestHierarchyOfControls('admin'), 'administrative');
check('"procedure"', suggestHierarchyOfControls('procedure'), 'administrative');
check('"training"', suggestHierarchyOfControls('training'), 'administrative');
check('"ppe"', suggestHierarchyOfControls('ppe'), 'ppe');
check('"personal protective equipment"', suggestHierarchyOfControls('personal protective equipment'), 'ppe');
check('"eliminate"', suggestHierarchyOfControls('eliminate'), 'elimination');
check('"removal"', suggestHierarchyOfControls('removal'), 'elimination');
check('"substitute"', suggestHierarchyOfControls('substitute'), 'substitution');
check('"replacement"', suggestHierarchyOfControls('replacement'), 'substitution');
check('unrecognised "housekeeping" -> null, NOT a nearest match', suggestHierarchyOfControls('housekeeping'), null);
check('empty -> null', suggestHierarchyOfControls(''), null);

// ---------------------------------------------------------------------------
console.log('\nColumn matching against the fixture headers');
const csv = readFileSync(FIXTURE, 'utf8');
const parsed = Papa.parse<string[]>(csv, { skipEmptyLines: 'greedy' });
const headers = (parsed.data[0] as string[]).map((h) => h.trim());
const rows = (parsed.data.slice(1) as string[][]).map((cells) => {
  const row: Record<string, string> = {};
  headers.forEach((h, i) => (row[h] = (cells[i] ?? '').trim()));
  return row;
});

const mapping = suggestColumnMapping(headers);
for (const [header, field] of Object.entries(mapping)) {
  console.log(`       ${header.padEnd(18)} -> ${field ?? '(not imported)'}`);
}
check('"Date of Injury" -> incident_date', mapping['Date of Injury'], 'incident_date');
check('"Facility" -> site_name', mapping['Facility'], 'site_name');
check('"Emp #" -> employee_ref', mapping['Emp #'], 'employee_ref');
check('"Nature of Injury" -> injury_type', mapping['Nature of Injury'], 'injury_type');
check('"Part of Body" -> body_part', mapping['Part of Body'], 'body_part');
check('"Days Lost" -> days_away', mapping['Days Lost'], 'days_away');
check('"Action Taken" -> corrective_action', mapping['Action Taken'], 'corrective_action');
check('"Control Type" -> hierarchy_of_controls', mapping['Control Type'], 'hierarchy_of_controls');
check('one field per column (no duplicates)', (() => {
  const used = Object.values(mapping).filter(Boolean);
  return used.length === new Set(used).size;
})(), true);

// ---------------------------------------------------------------------------
console.log('\nValidation with NOTHING accepted (suggestions must not auto-apply)');
const noAccept = validateRows(rows, {
  columnMapping: mapping,
  valueMappings: {},
  existingDedupeKeys: new Set(),
  existingSites: new Set(),
  existingDepartments: new Set(),
  existingEmployeeRefs: new Set(),
  importDuplicates: false,
});

check(
  'no control level is set without confirmation',
  noAccept.rows.every((r) => r.values.hierarchy_of_controls === null),
  true,
);
check(
  'a missing/unmatched control level raises no issue at all',
  noAccept.rows.flatMap((r) => r.issues).filter((i) => i.field === 'hierarchy_of_controls' && i.severity === 'error').length,
  0,
);
check('"Recordable" is not silently upgraded', noAccept.rows[0].values.incident_type, null);

// ---------------------------------------------------------------------------
console.log('\nValidation with the suggestions accepted (what the user sees after confirming)');

// Build the value mappings exactly as the wizard would after "accept all".
const valueMappings: Record<string, Record<string, string | null>> = {};
for (const [header, fieldKey] of Object.entries(mapping)) {
  if (!fieldKey) continue;
  const field = FIELD_BY_KEY.get(fieldKey);
  if (!field || (field.kind !== 'enum' && field.kind !== 'hoc')) continue;
  for (const row of rows) {
    const raw = row[header]?.trim();
    if (!raw) continue;
    if (field.kind === 'enum' && field.options?.includes(raw)) continue;
    const suggestion =
      field.kind === 'hoc' ? suggestHierarchyOfControls(raw) : suggestEnumValue(fieldKey, raw);
    (valueMappings[fieldKey] ??= {})[raw] = suggestion;
  }
}

const report = validateRows(rows, {
  columnMapping: mapping,
  valueMappings,
  existingDedupeKeys: new Set(),
  existingSites: new Set(),
  existingDepartments: new Set(),
  existingEmployeeRefs: new Set(),
  importDuplicates: false,
});

console.log(`       counts: ${JSON.stringify(report.counts)}`);
for (const row of report.rows) {
  console.log(
    `       row ${String(row.rowNumber).padStart(2)} ${row.status.padEnd(9)} ` +
      `${row.values.incident_date ?? '----------'} ` +
      `${(row.values.incident_type ?? '-').padEnd(16)} ` +
      `hoc=${row.values.hierarchy_of_controls ?? 'unclassified'}` +
      (row.issues.length ? `  <- ${row.issues.map((i) => i.message).join('; ')}` : ''),
  );
}

check('10 source rows', report.counts.total, 10);
check('the unparseable date is rejected', report.counts.rejected, 1);
check('the repeated ladder near-miss is caught as a duplicate', report.counts.duplicates, 1);
check('8 rows importable', report.counts.importable, 8);

const byRow = (n: number) => report.rows[n - 1];
check('row 1 "Recordable" -> OSHA Recordable', byRow(1).values.incident_type, 'OSHA Recordable');
check('row 1 "engineering control" -> engineering', byRow(1).values.hierarchy_of_controls, 'engineering');
check('row 2 "training" -> administrative', byRow(2).values.hierarchy_of_controls, 'administrative');
check('row 3 "eliminate" -> elimination', byRow(3).values.hierarchy_of_controls, 'elimination');
check('row 4 is the duplicate', byRow(4).status, 'duplicate');
check('row 4 duplicate source is this file', byRow(4).duplicateOf, 'earlier row in this file');
check('row 5 day-first date survives', byRow(5).values.incident_date, '2024-12-25');
check('row 5 "admin" -> administrative', byRow(5).values.hierarchy_of_controls, 'administrative');
check('row 7 rejected on the bad date', byRow(7).status, 'rejected');
check('row 7 "housekeeping" stays unclassified', byRow(7).values.hierarchy_of_controls, null);
check('row 8 blank control level -> unclassified', byRow(8).values.hierarchy_of_controls, null);
check('row 8 still imports', byRow(8).status !== 'rejected', true);
check('row 9 "personal protective equipment" -> ppe', byRow(9).values.hierarchy_of_controls, 'ppe');
check('row 10 "ppe" -> ppe', byRow(10).values.hierarchy_of_controls, 'ppe');
check('row 10 has no site (needs the default)', byRow(10).values.site_name, null);
check('row 1 shift "1st" -> First', byRow(1).values.shift, 'First');
check('row 1 days_away parsed', byRow(1).values.days_away, 5);
check('row 1 lost time yes -> true', byRow(1).values.is_lost_time, true);
check('row 2 lost time no -> false', byRow(2).values.is_lost_time, false);

check(
  'new sites collected for creation',
  [...report.newSites].sort(),
  ['Plant 1', 'Plant 2', 'Plant 3'],
);

// ---------------------------------------------------------------------------
console.log('\nDuplicate detection against records already on file');
const withExisting = validateRows(rows, {
  columnMapping: mapping,
  valueMappings,
  existingDedupeKeys: new Set(['2024-03-14|emp-0417|strain']),
  existingSites: new Set(['plant 1', 'plant 2', 'plant 3']),
  existingDepartments: new Set(),
  existingEmployeeRefs: new Set(),
  importDuplicates: false,
});
check('row 1 now matches an existing record', withExisting.rows[0].status, 'duplicate');
check('and is attributed to the database', withExisting.rows[0].duplicateOf, 'existing record');
check('no new sites when they already exist', withExisting.newSites.length, 0);

// ---------------------------------------------------------------------------
console.log(
  failures === 0
    ? `\nAll import-pipeline checks passed.\n`
    : `\n${failures} check(s) FAILED.\n`,
);
process.exit(failures === 0 ? 0 : 1);
