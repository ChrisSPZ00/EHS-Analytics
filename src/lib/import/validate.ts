import { FIELD_BY_KEY, REQUIRED_FIELD_KEYS } from './fields';
import { parseBoolean, parseDate, parseNumber } from './matching';
import type { HocCode } from '@/lib/domain/hierarchy-of-controls';

export type IssueSeverity = 'error' | 'warning';

export interface RowIssue {
  field: string;
  severity: IssueSeverity;
  message: string;
  raw?: string;
}

export type RowStatus = 'ok' | 'warning' | 'duplicate' | 'rejected';

export interface NormalisedRow {
  incident_date: string | null;
  reported_date: string | null;
  site_name: string | null;
  department_name: string | null;
  employee_ref: string | null;
  employee_name: string | null;
  hire_date: string | null;
  incident_type: string | null;
  classification: string | null;
  shift: string | null;
  injury_type: string | null;
  body_part: string | null;
  root_cause_category: string | null;
  root_cause_detail: string | null;
  severity_rating: string | null;
  days_away: number;
  days_restricted: number;
  machine_involved: boolean;
  safety_violation: boolean;
  recently_transferred: boolean;
  is_lost_time: boolean;
  expected_cost: number | null;
  actual_cost_to_date: number | null;
  claim_ref: string | null;
  description: string | null;
  corrective_action: string | null;
  hierarchy_of_controls: HocCode | null;
}

export interface ValidatedRow {
  /** 1-based row number in the source file, excluding the header. */
  rowNumber: number;
  raw: Record<string, string>;
  values: NormalisedRow;
  issues: RowIssue[];
  status: RowStatus;
  dedupeKey: string | null;
  duplicateOf: 'existing record' | 'earlier row in this file' | null;
}

export interface ValidationReport {
  rows: ValidatedRow[];
  counts: { total: number; importable: number; warnings: number; duplicates: number; rejected: number };
  newSites: string[];
  newDepartments: string[];
  newEmployees: string[];
}

export interface ValidationContext {
  /** header -> field key (null = ignore this column). */
  columnMapping: Record<string, string | null>;
  /** fieldKey -> { rawValue -> resolved value or null to leave blank }. */
  valueMappings: Record<string, Record<string, string | null>>;
  existingDedupeKeys: Set<string>;
  existingSites: Set<string>;
  existingDepartments: Set<string>;
  existingEmployeeRefs: Set<string>;
  /** Duplicates are skipped by default; the user can choose to import them anyway. */
  importDuplicates: boolean;
}

export function makeDedupeKey(
  date: string | null,
  employeeRef: string | null,
  injuryType: string | null,
): string | null {
  if (!date) return null;
  return [date, (employeeRef ?? '').toLowerCase(), (injuryType ?? '').toLowerCase()].join('|');
}

const EMPTY_ROW: NormalisedRow = {
  incident_date: null,
  reported_date: null,
  site_name: null,
  department_name: null,
  employee_ref: null,
  employee_name: null,
  hire_date: null,
  incident_type: null,
  classification: null,
  shift: null,
  injury_type: null,
  body_part: null,
  root_cause_category: null,
  root_cause_detail: null,
  severity_rating: null,
  days_away: 0,
  days_restricted: 0,
  machine_involved: false,
  safety_violation: false,
  recently_transferred: false,
  is_lost_time: false,
  expected_cost: null,
  actual_cost_to_date: null,
  claim_ref: null,
  description: null,
  corrective_action: null,
  hierarchy_of_controls: null,
};

/**
 * Field keys are driven by the user's column mapping, so writes into the normalised row
 * are dynamic. These two keep that in one place rather than scattering casts.
 */
function setField(row: NormalisedRow, key: string, value: unknown): void {
  (row as unknown as Record<string, unknown>)[key] = value;
}

function getField(row: NormalisedRow, key: string): unknown {
  return (row as unknown as Record<string, unknown>)[key];
}

export function validateRows(
  sourceRows: Record<string, string>[],
  context: ValidationContext,
): ValidationReport {
  const mappedFields = new Set(
    Object.values(context.columnMapping).filter((v): v is string => v !== null),
  );

  const seenKeys = new Set<string>();
  const newSites = new Set<string>();
  const newDepartments = new Set<string>();
  const newEmployees = new Set<string>();

  const rows = sourceRows.map((raw, index): ValidatedRow => {
    const values: NormalisedRow = { ...EMPTY_ROW };
    const issues: RowIssue[] = [];

    for (const [header, fieldKey] of Object.entries(context.columnMapping)) {
      if (!fieldKey) continue;
      const field = FIELD_BY_KEY.get(fieldKey);
      if (!field) continue;

      const cell = (raw[header] ?? '').trim();
      if (!cell) continue;

      switch (field.kind) {
        case 'date': {
          const parsed = parseDate(cell);
          if (!parsed) {
            issues.push({
              field: fieldKey,
              severity: fieldKey === 'incident_date' ? 'error' : 'warning',
              message: `Could not read "${cell}" as a date.`,
              raw: cell,
            });
          } else {
            setField(values, fieldKey, parsed);
          }
          break;
        }

        case 'number': {
          const parsed = parseNumber(cell);
          if (parsed === null) {
            issues.push({
              field: fieldKey,
              severity: 'warning',
              message: `Could not read "${cell}" as a number; left blank.`,
              raw: cell,
            });
          } else if (parsed < 0) {
            issues.push({
              field: fieldKey,
              severity: 'warning',
              message: `Negative value "${cell}"; left blank.`,
              raw: cell,
            });
          } else {
            setField(values, fieldKey, parsed);
          }
          break;
        }

        case 'boolean': {
          const parsed = parseBoolean(cell);
          if (parsed === null) {
            issues.push({
              field: fieldKey,
              severity: 'warning',
              message: `Could not read "${cell}" as yes/no; treated as no.`,
              raw: cell,
            });
          } else {
            setField(values, fieldKey, parsed);
          }
          break;
        }

        case 'enum': {
          const resolved = context.valueMappings[fieldKey]?.[cell];
          if (resolved) {
            setField(values, fieldKey, resolved);
          } else if (field.options?.includes(cell)) {
            setField(values, fieldKey, cell);
          } else {
            issues.push({
              field: fieldKey,
              severity: fieldKey === 'incident_type' ? 'error' : 'warning',
              message: `"${cell}" is not a recognised ${field.label.toLowerCase()}${
                fieldKey === 'incident_type' ? '.' : '; left blank.'
              }`,
              raw: cell,
            });
          }
          break;
        }

        case 'hoc': {
          // Only an explicitly confirmed mapping is honoured. An unmapped or
          // unrecognised value becomes null -- unclassified -- and this raises NO issue
          // at all: a missing control classification never warns and never rejects.
          const resolved = context.valueMappings.hierarchy_of_controls?.[cell] ?? null;
          values.hierarchy_of_controls = (resolved as HocCode | null) ?? null;
          break;
        }

        default:
          setField(values, fieldKey, cell);
      }
    }

    for (const required of REQUIRED_FIELD_KEYS) {
      if (!mappedFields.has(required)) continue;
      if (!getField(values, required)) {
        const field = FIELD_BY_KEY.get(required);
        if (!issues.some((i) => i.field === required)) {
          issues.push({
            field: required,
            severity: 'error',
            message: `${field?.label ?? required} is required and is empty.`,
          });
        }
      }
    }

    if (values.reported_date && values.incident_date && values.reported_date < values.incident_date) {
      issues.push({
        field: 'reported_date',
        severity: 'warning',
        message: 'Reported before the incident date; left blank.',
      });
      values.reported_date = null;
    }

    if (values.hierarchy_of_controls && !values.corrective_action) {
      issues.push({
        field: 'hierarchy_of_controls',
        severity: 'warning',
        message:
          'A control level was given with no corrective action text, so there is nothing to attach it to.',
      });
    }

    const dedupeKey = makeDedupeKey(values.incident_date, values.employee_ref, values.injury_type);

    let duplicateOf: ValidatedRow['duplicateOf'] = null;
    if (dedupeKey) {
      if (context.existingDedupeKeys.has(dedupeKey)) duplicateOf = 'existing record';
      else if (seenKeys.has(dedupeKey)) duplicateOf = 'earlier row in this file';
      seenKeys.add(dedupeKey);
    }

    const hasError = issues.some((i) => i.severity === 'error');
    const status: RowStatus = hasError
      ? 'rejected'
      : duplicateOf && !context.importDuplicates
        ? 'duplicate'
        : issues.length > 0
          ? 'warning'
          : 'ok';

    if (status !== 'rejected' && status !== 'duplicate') {
      if (values.site_name && !context.existingSites.has(values.site_name.toLowerCase())) {
        newSites.add(values.site_name);
      }
      if (
        values.department_name &&
        !context.existingDepartments.has(
          `${(values.site_name ?? '').toLowerCase()}|${values.department_name.toLowerCase()}`,
        )
      ) {
        newDepartments.add(values.department_name);
      }
      if (
        values.employee_ref &&
        !context.existingEmployeeRefs.has(values.employee_ref.toLowerCase())
      ) {
        newEmployees.add(values.employee_ref);
      }
    }

    return {
      rowNumber: index + 1,
      raw,
      values,
      issues,
      status,
      dedupeKey,
      duplicateOf,
    };
  });

  return {
    rows,
    counts: {
      total: rows.length,
      importable: rows.filter((r) => r.status === 'ok' || r.status === 'warning').length,
      warnings: rows.filter((r) => r.status === 'warning').length,
      duplicates: rows.filter((r) => r.status === 'duplicate').length,
      rejected: rows.filter((r) => r.status === 'rejected').length,
    },
    newSites: [...newSites],
    newDepartments: [...newDepartments],
    newEmployees: [...newEmployees],
  };
}

/**
 * The validation report as CSV. This is a deliverable the consultant hands to the
 * client, not just an internal step, so it carries the source row number and the
 * original cell values alongside every issue.
 */
export function validationReportToRows(report: ValidationReport): {
  headers: string[];
  rows: unknown[][];
} {
  const headers = [
    'Source row',
    'Status',
    'Issue count',
    'Issues',
    'Duplicate of',
    'Incident date',
    'Site',
    'Department',
    'Employee ID',
    'Incident type',
    'Classification',
    'Injury type',
    'Control level',
  ];

  const rows = report.rows.map((row) => [
    row.rowNumber,
    row.status,
    row.issues.length,
    row.issues.map((i) => `[${i.severity}] ${i.field}: ${i.message}`).join(' | '),
    row.duplicateOf ?? '',
    row.values.incident_date,
    row.values.site_name,
    row.values.department_name,
    row.values.employee_ref,
    row.values.incident_type,
    row.values.classification,
    row.values.injury_type,
    row.values.hierarchy_of_controls ?? 'Unclassified',
  ]);

  return { headers, rows };
}
