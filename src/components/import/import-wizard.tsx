'use client';

import Link from 'next/link';
import { useMemo, useState, useTransition } from 'react';

import { HocBadge } from '@/components/hierarchy-of-controls/hoc-badge';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, Input, Select } from '@/components/ui/field';
import { Table, TableWrap, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { commitImport, type CommitResult } from '@/app/(app)/incidents/import/actions';
import { downloadTextFile, toCsv } from '@/lib/export/csv';
import { FIELD_BY_KEY, IMPORT_FIELDS } from '@/lib/import/fields';
import { suggestColumnMapping, suggestEnumValue, suggestHierarchyOfControls } from '@/lib/import/matching';
import { MAX_IMPORT_ROWS, parseSpreadsheet, type ParsedSheet } from '@/lib/import/parse';
import {
  validateRows,
  validationReportToRows,
  type ValidationReport,
} from '@/lib/import/validate';
import { HOC_LEVELS, type HocValue } from '@/lib/domain/hierarchy-of-controls';
import { cn } from '@/lib/utils';

type Step = 'upload' | 'columns' | 'values' | 'preview' | 'done';

const STEPS: { id: Step; label: string }[] = [
  { id: 'upload', label: 'Upload' },
  { id: 'columns', label: 'Map columns' },
  { id: 'values', label: 'Map values' },
  { id: 'preview', label: 'Review' },
  { id: 'done', label: 'Done' },
];

export interface ImportContext {
  dedupeKeys: string[];
  sites: { id: string; name: string }[];
  departments: string[];
  employeeRefs: string[];
}

export function ImportWizard({ context }: { context: ImportContext }) {
  const [step, setStep] = useState<Step>('upload');
  const [sheet, setSheet] = useState<ParsedSheet | null>(null);
  const [fileName, setFileName] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);

  const [columnMapping, setColumnMapping] = useState<Record<string, string | null>>({});
  const [valueMappings, setValueMappings] = useState<Record<string, Record<string, string | null>>>({});
  const [importDuplicates, setImportDuplicates] = useState(false);
  const [defaultSiteId, setDefaultSiteId] = useState('');

  const [result, setResult] = useState<CommitResult | null>(null);
  const [committing, startCommit] = useTransition();

  async function handleFile(file: File) {
    setParsing(true);
    setParseError(null);
    try {
      const parsed = await parseSpreadsheet(file);
      if (!parsed.headers.length || !parsed.rows.length) {
        setParseError('That file has no readable rows. Check it has a header row and at least one record.');
        return;
      }
      setSheet(parsed);
      setFileName(file.name);
      setColumnMapping(suggestColumnMapping(parsed.headers));
      setValueMappings({});
      setStep('columns');
    } catch (error) {
      setParseError(error instanceof Error ? error.message : 'Could not read that file.');
    } finally {
      setParsing(false);
    }
  }

  /** Distinct raw values per enum/HoC column that need a decision. */
  const valueDecisions = useMemo(() => {
    if (!sheet) return [];

    const byField = new Map<string, Set<string>>();
    for (const [header, fieldKey] of Object.entries(columnMapping)) {
      if (!fieldKey) continue;
      const field = FIELD_BY_KEY.get(fieldKey);
      if (!field || (field.kind !== 'enum' && field.kind !== 'hoc')) continue;

      const set = byField.get(fieldKey) ?? new Set<string>();
      for (const row of sheet.rows) {
        const cell = (row[header] ?? '').trim();
        if (cell) set.add(cell);
      }
      byField.set(fieldKey, set);
    }

    return [...byField.entries()].map(([fieldKey, values]) => {
      const field = FIELD_BY_KEY.get(fieldKey)!;
      const items = [...values]
        .map((raw) => {
          const exact = field.kind === 'enum' && field.options?.includes(raw);
          const suggestion =
            field.kind === 'hoc' ? suggestHierarchyOfControls(raw) : suggestEnumValue(fieldKey, raw);
          return { raw, exact: !!exact, suggestion };
        })
        .sort((a, b) => Number(a.exact) - Number(b.exact) || a.raw.localeCompare(b.raw));
      return { field, items };
    });
  }, [sheet, columnMapping]);

  /**
   * Suggestions are never applied automatically. Until the user accepts one it is not in
   * valueMappings, and an unaccepted value imports as blank (unclassified, for HoC).
   */
  const report: ValidationReport | null = useMemo(() => {
    if (!sheet) return null;
    return validateRows(sheet.rows, {
      columnMapping,
      valueMappings,
      existingDedupeKeys: new Set(context.dedupeKeys),
      existingSites: new Set(context.sites.map((s) => s.name.toLowerCase())),
      existingDepartments: new Set(context.departments),
      existingEmployeeRefs: new Set(context.employeeRefs),
      importDuplicates,
    });
  }, [sheet, columnMapping, valueMappings, context, importDuplicates]);

  const mappedFields = new Set(Object.values(columnMapping).filter(Boolean) as string[]);
  const missingRequired = IMPORT_FIELDS.filter((f) => f.required && !mappedFields.has(f.key));

  const siteMapped = mappedFields.has('site_name');
  const rowsMissingSite =
    report?.rows.filter(
      (r) => (r.status === 'ok' || r.status === 'warning') && !r.values.site_name,
    ).length ?? 0;
  const needsDefaultSite = !siteMapped || rowsMissingSite > 0;

  function downloadReport() {
    if (!report) return;
    const { headers, rows } = validationReportToRows(report);
    downloadTextFile(
      `import-validation-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv(headers, rows),
    );
  }

  function downloadRejected() {
    if (!report || !sheet) return;
    const rejected = report.rows.filter((r) => r.status === 'rejected');
    const headers = ['Source row', 'Reason', ...sheet.headers];
    const rows = rejected.map((r) => [
      r.rowNumber,
      r.issues.filter((i) => i.severity === 'error').map((i) => i.message).join(' | '),
      ...sheet.headers.map((h) => r.raw[h] ?? ''),
    ]);
    downloadTextFile(
      `import-rejected-rows-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv(headers, rows),
    );
  }

  function handleCommit() {
    if (!report) return;
    const payload = report.rows
      .filter((r) => r.status === 'ok' || r.status === 'warning')
      .map((r) => r.values);

    startCommit(async () => {
      const outcome = await commitImport(payload, defaultSiteId || null);
      setResult(outcome);
      setStep('done');
    });
  }

  return (
    <div className="space-y-4">
      <StepBar current={step} />

      {step === 'upload' ? (
        <Card>
          <CardHeader>
            <CardTitle>Upload your spreadsheet</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              CSV or XLSX, with a header row. Nothing is written until you review and confirm —
              you will see exactly what will import, and what will not, before anything happens.
            </p>
            <Input
              type="file"
              accept=".csv,.tsv,.txt,.xlsx,.xlsm"
              disabled={parsing}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
              }}
            />
            {parsing ? <p className="text-sm text-muted-foreground">Reading file…</p> : null}
            {parseError ? <Callout tone="danger">{parseError}</Callout> : null}
          </CardContent>
        </Card>
      ) : null}

      {step === 'columns' && sheet ? (
        <Card>
          <CardHeader>
            <CardTitle>Match your columns</CardTitle>
            <p className="text-sm text-muted-foreground">
              {fileName} · {sheet.rows.length.toLocaleString()} rows. We have guessed these from
              your header names — correct anything that is wrong.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {sheet.truncated > 0 ? (
              <Callout tone="warning" title="File truncated">
                Only the first {MAX_IMPORT_ROWS.toLocaleString()} rows were read;{' '}
                {sheet.truncated.toLocaleString()} were left out. Split the file and import in
                parts.
              </Callout>
            ) : null}

            <TableWrap>
              <Table>
                <THead>
                  <TR>
                    <TH>Your column</TH>
                    <TH>Sample value</TH>
                    <TH>Imports as</TH>
                  </TR>
                </THead>
                <TBody>
                  {sheet.headers.map((header) => {
                    const sample = sheet.rows.find((r) => (r[header] ?? '').trim())?.[header] ?? '';
                    const selected = columnMapping[header] ?? '';
                    return (
                      <TR key={header}>
                        <TD className="font-medium">{header}</TD>
                        <TD className="max-w-[18rem] truncate text-muted-foreground">
                          {sample || <span className="italic">empty</span>}
                        </TD>
                        <TD>
                          <Select
                            value={selected}
                            onChange={(e) => {
                              const value = e.target.value || null;
                              setColumnMapping((prev) => {
                                const next = { ...prev, [header]: value };
                                // One source column per field.
                                if (value) {
                                  for (const key of Object.keys(next)) {
                                    if (key !== header && next[key] === value) next[key] = null;
                                  }
                                }
                                return next;
                              });
                            }}
                          >
                            <option value="">Don&apos;t import</option>
                            {IMPORT_FIELDS.map((f) => (
                              <option key={f.key} value={f.key}>
                                {f.label}
                                {f.required ? ' (required)' : ''}
                              </option>
                            ))}
                          </Select>
                          {selected && FIELD_BY_KEY.get(selected)?.help ? (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {FIELD_BY_KEY.get(selected)!.help}
                            </p>
                          ) : null}
                        </TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            </TableWrap>

            {missingRequired.length ? (
              <Callout tone="danger" title="Required fields not matched">
                Every incident needs {missingRequired.map((f) => f.label).join(' and ')}. Match{' '}
                {missingRequired.length === 1 ? 'that column' : 'those columns'} to continue.
              </Callout>
            ) : null}

            <div className="flex gap-2">
              <Button onClick={() => setStep('values')} disabled={missingRequired.length > 0}>
                Continue
              </Button>
              <Button variant="ghost" onClick={() => setStep('upload')}>
                Back
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === 'values' ? (
        <Card>
          <CardHeader>
            <CardTitle>Match your values</CardTitle>
            <p className="text-sm text-muted-foreground">
              Where your wording differs from ours we suggest a match. Nothing is applied until
              you accept it.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {valueDecisions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No coded columns to match — continue to the review.
              </p>
            ) : null}

            {valueDecisions.map(({ field, items }) => {
              const unresolved = items.filter((i) => !i.exact);
              return (
                <div key={field.key} className="space-y-2">
                  <div>
                    <h3 className="text-sm font-semibold">{field.label}</h3>
                    <p className="text-xs text-muted-foreground">
                      {field.kind === 'hoc'
                        ? 'Anything you leave unmatched imports as Unclassified — never as a nearest guess.'
                        : `${unresolved.length} value${unresolved.length === 1 ? '' : 's'} need a decision.`}
                    </p>
                  </div>

                  <TableWrap>
                    <Table>
                      <THead>
                        <TR>
                          <TH>Value in your file</TH>
                          <TH>Imports as</TH>
                          <TH className="w-40">Suggestion</TH>
                        </TR>
                      </THead>
                      <TBody>
                        {items.map((item) => {
                          const chosen = valueMappings[field.key]?.[item.raw] ?? '';
                          const effective = item.exact ? item.raw : chosen;
                          return (
                            <TR key={item.raw}>
                              <TD className="font-medium">{item.raw}</TD>
                              <TD>
                                {item.exact ? (
                                  <span className="text-sm text-muted-foreground">
                                    {item.raw} (exact match)
                                  </span>
                                ) : (
                                  <Select
                                    value={chosen}
                                    onChange={(e) =>
                                      setValueMappings((prev) => ({
                                        ...prev,
                                        [field.key]: {
                                          ...(prev[field.key] ?? {}),
                                          [item.raw]: e.target.value || null,
                                        },
                                      }))
                                    }
                                  >
                                    <option value="">
                                      {field.kind === 'hoc' ? 'Unclassified' : 'Leave blank'}
                                    </option>
                                    {field.kind === 'hoc'
                                      ? HOC_LEVELS.map((l) => (
                                          <option key={l.code} value={l.code}>
                                            {l.rank} · {l.label}
                                          </option>
                                        ))
                                      : field.options?.map((o) => (
                                          <option key={o} value={o}>
                                            {o}
                                          </option>
                                        ))}
                                  </Select>
                                )}
                              </TD>
                              <TD>
                                {!item.exact && item.suggestion && !chosen ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      setValueMappings((prev) => ({
                                        ...prev,
                                        [field.key]: {
                                          ...(prev[field.key] ?? {}),
                                          [item.raw]: item.suggestion,
                                        },
                                      }))
                                    }
                                  >
                                    Use{' '}
                                    {field.kind === 'hoc'
                                      ? HOC_LEVELS.find((l) => l.code === item.suggestion)?.label
                                      : item.suggestion}
                                  </Button>
                                ) : effective && !item.exact ? (
                                  <span className="text-xs text-muted-foreground">Accepted</span>
                                ) : null}
                              </TD>
                            </TR>
                          );
                        })}
                      </TBody>
                    </Table>
                  </TableWrap>
                </div>
              );
            })}

            <div className="flex gap-2">
              <Button onClick={() => setStep('preview')}>Continue</Button>
              <Button variant="ghost" onClick={() => setStep('columns')}>
                Back
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === 'preview' && report ? (
        <PreviewStep
          report={report}
          context={context}
          needsDefaultSite={needsDefaultSite}
          rowsMissingSite={rowsMissingSite}
          defaultSiteId={defaultSiteId}
          setDefaultSiteId={setDefaultSiteId}
          importDuplicates={importDuplicates}
          setImportDuplicates={setImportDuplicates}
          onBack={() => setStep('values')}
          onCommit={handleCommit}
          committing={committing}
          onDownloadReport={downloadReport}
          onDownloadRejected={downloadRejected}
        />
      ) : null}

      {step === 'done' && result ? (
        <Card>
          <CardHeader>
            <CardTitle>{result.ok ? 'Import complete' : 'Import failed'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Callout tone={result.ok ? 'success' : 'danger'}>{result.message}</Callout>
            {result.ok ? (
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>{result.inserted.toLocaleString()} incidents created</li>
                <li>{result.correctiveActions.toLocaleString()} corrective actions created</li>
                <li>
                  {result.createdSites} sites, {result.createdDepartments} departments and{' '}
                  {result.createdEmployees} employees added
                </li>
              </ul>
            ) : null}
            <div className="flex gap-2">
              <Button onClick={downloadReport} variant="outline" size="sm">
                Download validation report
              </Button>
              <Link href="/incidents" className="text-sm font-medium text-primary hover:underline">
                Go to the incident log
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function StepBar({ current }: { current: Step }) {
  const currentIndex = STEPS.findIndex((s) => s.id === current);
  return (
    <ol className="flex flex-wrap items-center gap-2 text-sm">
      {STEPS.map((step, index) => (
        <li key={step.id} className="flex items-center gap-2">
          <span
            className={cn(
              'rounded-full px-2.5 py-0.5',
              index === currentIndex
                ? 'bg-primary text-primary-foreground'
                : index < currentIndex
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground',
            )}
          >
            {index + 1}. {step.label}
          </span>
          {index < STEPS.length - 1 ? <span className="text-muted-foreground">›</span> : null}
        </li>
      ))}
    </ol>
  );
}

function PreviewStep({
  report,
  context,
  needsDefaultSite,
  rowsMissingSite,
  defaultSiteId,
  setDefaultSiteId,
  importDuplicates,
  setImportDuplicates,
  onBack,
  onCommit,
  committing,
  onDownloadReport,
  onDownloadRejected,
}: {
  report: ValidationReport;
  context: ImportContext;
  needsDefaultSite: boolean;
  rowsMissingSite: number;
  defaultSiteId: string;
  setDefaultSiteId: (id: string) => void;
  importDuplicates: boolean;
  setImportDuplicates: (v: boolean) => void;
  onBack: () => void;
  onCommit: () => void;
  committing: boolean;
  onDownloadReport: () => void;
  onDownloadRejected: () => void;
}) {
  const { counts } = report;
  const rejected = report.rows.filter((r) => r.status === 'rejected');
  const warnings = report.rows.filter((r) => r.status === 'warning');
  const duplicates = report.rows.filter((r) => r.status === 'duplicate');

  const blocked = needsDefaultSite && !defaultSiteId;
  const unclassified = report.rows.filter(
    (r) => r.values.corrective_action && !r.values.hierarchy_of_controls,
  ).length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>What will import</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <Stat label="Will import" value={counts.importable} tone="success" />
            <Stat label="With warnings" value={counts.warnings} tone="warning" />
            <Stat label="Duplicates skipped" value={counts.duplicates} />
            <Stat label="Rejected" value={counts.rejected} tone={counts.rejected ? 'danger' : undefined} />
          </div>

          {(report.newSites.length || report.newDepartments.length || report.newEmployees.length) ? (
            <Callout tone="info" title="New records will be created">
              {report.newSites.length} site(s), {report.newDepartments.length} department(s) and{' '}
              {report.newEmployees.length} employee(s) referenced in your file are not on record
              yet and will be added.
            </Callout>
          ) : null}

          {needsDefaultSite ? (
            <Field
              label="Default site"
              htmlFor="default_site"
              required
              hint={
                rowsMissingSite > 0
                  ? `${rowsMissingSite} row(s) have no site value. They will be filed here.`
                  : 'Your file has no site column, so every incident needs a home.'
              }
            >
              <Select
                id="default_site"
                value={defaultSiteId}
                onChange={(e) => setDefaultSiteId(e.target.value)}
              >
                <option value="">Choose a site…</option>
                {context.sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}

          {duplicates.length > 0 ? (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[var(--primary)]"
                checked={importDuplicates}
                onChange={(e) => setImportDuplicates(e.target.checked)}
              />
              Import the {duplicates.length} duplicate row(s) anyway
            </label>
          ) : null}

          {unclassified > 0 ? (
            <Callout tone="info">
              {unclassified} corrective action(s) will import without a control level. That is
              fine — classification is something you fill in over time, and the queue will show
              them when you are ready.
            </Callout>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button onClick={onCommit} disabled={committing || counts.importable === 0 || blocked}>
              {committing
                ? 'Importing…'
                : `Import ${counts.importable.toLocaleString()} row${counts.importable === 1 ? '' : 's'}`}
            </Button>
            <Button variant="outline" onClick={onDownloadReport}>
              Download validation report
            </Button>
            {rejected.length > 0 ? (
              <Button variant="outline" onClick={onDownloadRejected}>
                Download rejected rows
              </Button>
            ) : null}
            <Button variant="ghost" onClick={onBack}>
              Back
            </Button>
          </div>
        </CardContent>
      </Card>

      {rejected.length > 0 ? (
        <IssueTable title={`Rejected rows (${rejected.length})`} rows={rejected} tone="danger" />
      ) : null}
      {warnings.length > 0 ? (
        <IssueTable
          title={`Rows with warnings (${warnings.length}) — these will still import`}
          rows={warnings}
          tone="warning"
        />
      ) : null}
      {duplicates.length > 0 ? (
        <IssueTable title={`Duplicates (${duplicates.length})`} rows={duplicates} tone="info" />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <TableWrap>
            <Table>
              <THead>
                <TR>
                  <TH>Row</TH>
                  <TH>Date</TH>
                  <TH>Site</TH>
                  <TH>Employee</TH>
                  <TH>Type</TH>
                  <TH>Injury</TH>
                  <TH>Corrective action</TH>
                  <TH>Control level</TH>
                </TR>
              </THead>
              <TBody>
                {report.rows
                  .filter((r) => r.status === 'ok' || r.status === 'warning')
                  .slice(0, 25)
                  .map((row) => (
                    <TR key={row.rowNumber}>
                      <TD className="tabular-nums text-muted-foreground">{row.rowNumber}</TD>
                      <TD>{row.values.incident_date}</TD>
                      <TD>{row.values.site_name ?? '—'}</TD>
                      <TD>{row.values.employee_ref ?? '—'}</TD>
                      <TD>{row.values.incident_type}</TD>
                      <TD>{row.values.injury_type ?? '—'}</TD>
                      <TD className="max-w-[16rem] truncate">
                        {row.values.corrective_action ?? '—'}
                      </TD>
                      <TD>
                        {row.values.corrective_action ? (
                          <HocBadge
                            value={row.values.hierarchy_of_controls as HocValue}
                            density="dense"
                          />
                        ) : (
                          '—'
                        )}
                      </TD>
                    </TR>
                  ))}
              </TBody>
            </Table>
          </TableWrap>
          {counts.importable > 25 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Showing the first 25 of {counts.importable.toLocaleString()} rows. The validation
              report covers every row.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: 'success' | 'warning' | 'danger';
}) {
  return (
    <div className="rounded-md border border-border p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={cn(
          'mt-1 text-2xl font-semibold tabular-nums',
          tone === 'success' && 'text-success',
          tone === 'warning' && 'text-warning',
          tone === 'danger' && 'text-danger',
        )}
      >
        {value.toLocaleString()}
      </p>
    </div>
  );
}

function IssueTable({
  title,
  rows,
  tone,
}: {
  title: string;
  rows: ValidationReport['rows'];
  tone: 'danger' | 'warning' | 'info';
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className={cn(tone === 'danger' && 'text-danger', tone === 'warning' && 'text-warning')}>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <TableWrap>
          <Table>
            <THead>
              <TR>
                <TH className="w-20">Row</TH>
                <TH>Issue</TH>
              </TR>
            </THead>
            <TBody>
              {rows.slice(0, 50).map((row) => (
                <TR key={row.rowNumber}>
                  <TD className="tabular-nums">{row.rowNumber}</TD>
                  <TD>
                    {row.duplicateOf ? (
                      <span className="text-sm">Matches an {row.duplicateOf}.</span>
                    ) : null}
                    <ul className="space-y-0.5">
                      {row.issues.map((issue, i) => (
                        <li key={i} className="text-sm">
                          <span className="font-medium">
                            {FIELD_BY_KEY.get(issue.field)?.label ?? issue.field}:
                          </span>{' '}
                          {issue.message}
                        </li>
                      ))}
                    </ul>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TableWrap>
        {rows.length > 50 ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Showing 50 of {rows.length}. Download the report for the full list.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
