import {
  INCIDENT_CLASSIFICATIONS,
  INCIDENT_TYPES,
  ROOT_CAUSE_CATEGORIES,
  SEVERITY_RATINGS,
  SHIFTS,
} from '@/lib/domain/incidents';
import { HOC_LEVELS } from '@/lib/domain/hierarchy-of-controls';

export type FieldKind = 'date' | 'text' | 'enum' | 'number' | 'boolean' | 'hoc';

export interface ImportField {
  key: string;
  label: string;
  kind: FieldKind;
  required?: boolean;
  /** Allowed values for enum fields. */
  options?: readonly string[];
  /** Header spellings we have seen in the wild, lowercased. */
  aliases: string[];
  help?: string;
}

/**
 * The importable field set.
 *
 * Sites, departments and employees are matched by NAME/REF rather than id — a client's
 * spreadsheet has "Plant 2" and "EMP-0417" in it, not our UUIDs. Anything referenced but
 * not yet on file is created during commit, and the preview says how many.
 */
export const IMPORT_FIELDS: ImportField[] = [
  {
    key: 'incident_date',
    label: 'Incident date',
    kind: 'date',
    required: true,
    aliases: ['incident date', 'date', 'date of incident', 'dateofinjury', 'date of injury', 'occurrence date', 'event date', 'doi'],
  },
  {
    key: 'reported_date',
    label: 'Reported date',
    kind: 'date',
    aliases: ['reported date', 'date reported', 'report date', 'reported'],
  },
  {
    key: 'site_name',
    label: 'Site',
    kind: 'text',
    aliases: ['site', 'site name', 'location', 'facility', 'plant', 'branch'],
    help: 'Matched by name. New sites are created on commit.',
  },
  {
    key: 'department_name',
    label: 'Department',
    kind: 'text',
    aliases: ['department', 'dept', 'department name', 'area', 'cost center', 'work area'],
  },
  {
    key: 'employee_ref',
    label: 'Employee ID',
    kind: 'text',
    aliases: ['employee id', 'employee ref', 'emp id', 'employee number', 'emp #', 'badge', 'badge number', 'employee'],
    help: 'Your own identifier for the person. Used for duplicate detection.',
  },
  {
    key: 'employee_name',
    label: 'Employee name',
    kind: 'text',
    aliases: ['employee name', 'name', 'injured worker', 'worker', 'full name'],
  },
  {
    key: 'hire_date',
    label: 'Hire date',
    kind: 'date',
    aliases: ['hire date', 'date of hire', 'start date', 'doh'],
    help: 'Enables the tenure-at-incident analysis.',
  },
  {
    key: 'incident_type',
    label: 'Incident type',
    kind: 'enum',
    required: true,
    options: INCIDENT_TYPES,
    aliases: ['incident type', 'type', 'category', 'incident category', 'osha type'],
  },
  {
    key: 'classification',
    label: 'Classification',
    kind: 'enum',
    options: INCIDENT_CLASSIFICATIONS,
    aliases: ['classification', 'class', 'case type', 'injury classification'],
  },
  { key: 'shift', label: 'Shift', kind: 'enum', options: SHIFTS, aliases: ['shift', 'shift worked'] },
  {
    key: 'injury_type',
    label: 'Injury type',
    kind: 'text',
    aliases: ['injury type', 'injury', 'nature of injury', 'injury nature', 'diagnosis'],
  },
  {
    key: 'body_part',
    label: 'Body part',
    kind: 'text',
    aliases: ['body part', 'part of body', 'bodypart', 'affected body part'],
  },
  {
    key: 'root_cause_category',
    label: 'Root cause category',
    kind: 'enum',
    options: ROOT_CAUSE_CATEGORIES,
    aliases: ['root cause category', 'root cause', 'cause', 'cause category'],
  },
  {
    key: 'root_cause_detail',
    label: 'Root cause detail',
    kind: 'text',
    aliases: ['root cause detail', 'cause detail', 'root cause description', 'why'],
  },
  {
    key: 'severity_rating',
    label: 'Severity',
    kind: 'enum',
    options: SEVERITY_RATINGS,
    aliases: ['severity', 'severity rating', 'severity level'],
  },
  { key: 'days_away', label: 'Days away', kind: 'number', aliases: ['days away', 'lost days', 'days lost', 'away days', 'dafw'] },
  {
    key: 'days_restricted',
    label: 'Days restricted',
    kind: 'number',
    aliases: ['days restricted', 'restricted days', 'restricted duty days', 'light duty days', 'djtr'],
  },
  { key: 'machine_involved', label: 'Machine involved', kind: 'boolean', aliases: ['machine involved', 'machinery', 'equipment involved'] },
  { key: 'safety_violation', label: 'Safety violation', kind: 'boolean', aliases: ['safety violation', 'violation', 'rule violation'] },
  {
    key: 'recently_transferred',
    label: 'Recently transferred',
    kind: 'boolean',
    aliases: ['recently transferred', 'new to job', 'transferred', 'new assignment'],
  },
  { key: 'is_lost_time', label: 'Lost time', kind: 'boolean', aliases: ['lost time', 'lti', 'lost time injury', 'losttime'] },
  { key: 'expected_cost', label: 'Expected cost', kind: 'number', aliases: ['expected cost', 'estimated cost', 'reserve', 'incurred estimate'] },
  {
    key: 'actual_cost_to_date',
    label: 'Actual cost to date',
    kind: 'number',
    aliases: ['actual cost', 'actual cost to date', 'paid', 'cost to date', 'total paid'],
  },
  { key: 'claim_ref', label: 'Claim reference', kind: 'text', aliases: ['claim', 'claim ref', 'claim number', 'claim #', 'wc claim'] },
  { key: 'description', label: 'Description', kind: 'text', aliases: ['description', 'details', 'narrative', 'what happened', 'incident description', 'comments'] },
  {
    key: 'corrective_action',
    label: 'Corrective action',
    kind: 'text',
    aliases: ['corrective action', 'corrective actions', 'action taken', 'action', 'remedy', 'countermeasure'],
    help: 'Creates one corrective action per row.',
  },
  {
    key: 'hierarchy_of_controls',
    label: 'Hierarchy of controls',
    kind: 'hoc',
    options: HOC_LEVELS.map((l) => l.label),
    aliases: ['hierarchy of controls', 'hierarchy of control', 'control level', 'control type', 'hoc', 'control hierarchy'],
    help: 'Optional. Unrecognised values import as unclassified — never as a nearest match.',
  },
];

export const FIELD_BY_KEY = new Map(IMPORT_FIELDS.map((f) => [f.key, f]));

export const REQUIRED_FIELD_KEYS = IMPORT_FIELDS.filter((f) => f.required).map((f) => f.key);
