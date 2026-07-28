# SafePulse Analytics

EHS analytics for SMB manufacturers, food processors, warehouses and ag operations
(50–500 employees). Three modules: Incident Log, Incident Dashboard, Compliance Calendar.

**Glass box, not black box.** Every calculated metric shows its formula, the actual input
values used, and its regulatory citation. The product teaches clients to own their
program rather than creating dependency.

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind · Supabase (Postgres, Auth, RLS) ·
Recharts · Zod · react-hook-form

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in from the Supabase dashboard
npm run dev
```

## Checks

```bash
npm run typecheck        # tsc --noEmit
npm run lint             # eslint
npm run verify:contrast  # WCAG AA on the hierarchy-of-controls tokens (runs in build)
npm run verify:import    # CSV import pipeline against a deliberately messy fixture
npm run verify:metrics   # metric formulas, incl. a cross-check against SQL-derived figures
```

## Build status

| Phase | Scope | State |
| --- | --- | --- |
| 1 | Schema and RLS foundation | Complete |
| 2 | Incident Log (table, forms, CSV import) | Complete |
| 3 | Incident Dashboard | Complete |
| 4 | Compliance Calendar | Not started |
| 5 | Polish, seed data, deploy | Not started |

---

## Phase 1 — schema and RLS foundation

### Tenant isolation

A previous build allowed a client to insert rows carrying an arbitrary
`organization_id`. That class of bug is now closed structurally, with three independent
mechanisms — any one of them failing leaves the other two standing:

1. **`public.current_org_id()`** resolves the caller's organization server-side from
   `auth.uid()` via the `profiles` table. `STABLE`, `SECURITY DEFINER`, explicit
   `search_path`, `EXECUTE` revoked from `anon`. The client never supplies it and cannot
   influence it.
2. **Triggers.** `BEFORE INSERT` overwrites `organization_id` with `current_org_id()`;
   `BEFORE UPDATE` pins it back to its stored value. Whatever the client sends in that
   column is discarded.
3. **RLS.** Every `USING` and `WITH CHECK` clause compares `organization_id` to
   `current_org_id()`. Postgres evaluates `WITH CHECK` against the post-trigger row, so a
   forged value that somehow survived (1) and (2) still fails here.

Two supporting decisions:

- **Composite foreign keys.** Child tables reference `parent (id, organization_id)`, not
  `parent (id)`. FK checks are not RLS-filtered, so a plain FK would let a client attach
  their row to another tenant's site — invisible to them, but a real integrity break.
- **`security_invoker` on every view.** A Postgres view runs with its *owner's*
  privileges by default, which would bypass RLS completely. All three reporting views set
  it, and `supabase/tests/rls.sql` asserts that no view in `public` is ever missing it.

Membership is not self-service: neither `organizations` nor `profiles` has an insert
policy. Orgs are created only through `bootstrap_organization()`, and members added only
through `add_member_to_current_org()`. Neither takes a target organization as a
parameter — it is always derived from the caller.

Roles: `owner` and `admin` administer; `contributor` writes; `viewer` is read-only,
enforced in the policies via `can_write()`.

`public.apply_tenant_guards(regclass)` installs the whole set — both triggers, four
policies, grants, RLS enabled — in one call. Every operational table calls it in the same
migration that creates it, so no table exists even briefly without protection.

### Tables

`organizations` · `profiles` · `sites` · `departments` · `employees` · `incidents` ·
`corrective_actions` · `hours_worked` · `leading_indicators` ·
`compliance_obligations` · `compliance_events` · `injury_types` · `body_parts` ·
`hierarchy_of_control_levels`

Views: `incidents_enriched`, `corrective_actions_enriched`,
`corrective_actions_needing_classification`.

Notable choices:

- **`tenure_days` is derived, never stored** — `incident_date − hire_date`, exposed by
  `incidents_enriched` along with the bucket used by the tenure histogram. A generated
  column cannot reference another table, and a stored copy goes stale the moment either
  date is corrected.
- **`injury_type` and `body_part` are text, not enums**, backed by seeded lookup tables
  that drive the dropdowns. A CSV import carrying "Laceration" instead of "Cut/Laceration"
  must still land rather than be rejected. Those two lookups are tenant-extensible
  (`organization_id IS NULL` = shared system default).
- **`hours_worked` has no default and no backfill.** A missing row is the signal that a
  period's rates cannot be computed.
- **`compliance_events` is unique on `(obligation_id, due_date)`**, which makes
  recurrence regeneration idempotent so completed history survives an obligation edit.

### Hierarchy of controls

Modelled as a lookup table carrying an explicit `rank`, not as an enum. An enum cannot
carry the rank, which leaves ordering dependent on either alphabetisation
("Administrative" first, "Substitution" last — exactly backwards) or declaration order,
which is a fragile thing to hang a maturity metric on.

| rank | code | label | description |
| --- | --- | --- | --- |
| 1 | `elimination` | Elimination | Remove the hazard entirely |
| 2 | `substitution` | Substitution | Replace with something less hazardous |
| 3 | `engineering` | Engineering | Isolate people from the hazard |
| 4 | `administrative` | Administrative | Change the way people work |
| 5 | `ppe` | PPE | Protect the worker with equipment |
| — | `NULL` | Unclassified | No control level assigned yet |

`corrective_actions.hierarchy_of_controls` is **nullable, with no constraint, check or
trigger requiring it** — classification is something a client fills in over time, not a
gate on getting their data in. `NULL` is a first-class state, never folded into a level
and never guessed at.

`corrective_actions_enriched` exposes `hoc_rank`, `hoc_label` (`'Unclassified'` when
null), `hoc_sort_rank` (999 for unclassified, so it sorts last) and `hoc_token` (the
colour token index; 0 for unclassified). `is_engineering_or_above` is `NULL` — not
`false` — for unclassified rows, so they leave the maturity KPI's denominator rather than
counting as a miss.

Colour tokens live in `src/app/globals.css` as `--hoc-0..5-{bg,fg}` and are exposed as
Tailwind utilities. Token 0 is neutral grey and sits deliberately outside the green ramp.
`npm run verify:contrast` parses the stylesheet and checks every pair against WCAG AA;
it runs as part of `npm run build`:

| token | level | bg | fg | ratio |
| --- | --- | --- | --- | --- |
| 0 | Unclassified | `#E5E7EB` | `#374151` | 8.33:1 |
| 1 | Elimination | `#14532D` | `#FFFFFF` | 9.11:1 |
| 2 | Substitution | `#256B31` | `#FFFFFF` | 6.51:1 |
| 3 | Engineering | `#7CB342` | `#1B3300` | 5.52:1 |
| 4 | Administrative | `#BCD455` | `#263300` | 8.15:1 |
| 5 | PPE | `#E8EE85` | `#3D4A00` | 7.81:1 |

Badges always render the label text. Colour never carries the meaning alone — a
five-step single-hue ramp is not reliably distinguishable under red-green colour vision
deficiency, and the rule we would apply to hazard signage applies to our own UI.

### Verifying it

```bash
psql "$DATABASE_URL" -f supabase/tests/rls.sql
```

51 pgTAP assertions covering structure (RLS enabled everywhere, a policy on every table,
`security_invoker` on every view, both triggers on every tenant table), cross-tenant
read/insert/update/delete, the forged-`organization_id` insert specifically, role
enforcement, anonymous access, and the hierarchy-of-controls null semantics. The whole
script runs in a transaction that rolls back, so it is safe against any environment.

`get_advisors` reports no ERROR-level findings. Six WARN-level findings remain, all
`SECURITY DEFINER` functions intentionally exposed to `authenticated`:
`current_org_id`, `current_org_role`, `can_write` and `is_org_admin` must be executable
because RLS policy expressions are evaluated as the querying role, and each reports only
facts about the caller's own session; `bootstrap_organization` and
`add_member_to_current_org` *are* the membership API and perform their own authorization
checks. The reasoning is recorded in
`supabase/migrations/20260728155756_restrict_trigger_function_execute.sql`.

---

## Phase 2 — Incident Log

### Auth

No phase specifies authentication, but nothing in Phase 2 is reachable without it, so the
minimum is in place: email/password sign-in, sign-up, an onboarding step that calls
`bootstrap_organization()`, and middleware that refreshes the session cookie.

The middleware redirect is UX only, **not** the security boundary — RLS is. Middleware
decides which page you land on; it never decides which rows you can see. Both Supabase
clients use the publishable key and the caller's session; there is no service-role client
in the app, so no request path can bypass tenant isolation.

### The log

Filters (date range, site, department, type, classification, shift, severity, free text)
live in the URL rather than component state, which makes a view shareable, refresh-proof,
and lets CSV export be a plain link reusing the same query string. Sorting and pagination
are server-side — `applyIncidentFilters()` is the single query builder shared by the page
and the export route.

The export walks the result set in 1,000-row pages so memory stays flat, and quotes any
value starting with `=`, `+`, `-` or `@` so a description cannot execute as a formula when
the client opens the file.

### CSV / XLSX import

Five steps: upload → map columns → map values → review → commit. Nothing is written until
the final step.

- **Column matching** is exact-alias first, then fuzzy (Levenshtein), one field per column.
- **Value matching** covers near-misses like `Recordable → OSHA Recordable`, plus an alias
  table for synonyms edit distance cannot bridge (`1st → First`, `Lost Time → LTI`).
- **Dates** accept month-first, day-first, ISO, two-digit years and Excel serials.
  Genuinely unreadable values are rejected, never guessed.
- **Duplicates** are detected on `incident_date + employee_ref + injury_type`, against both
  the database and earlier rows in the same file, and skipped unless you opt in.
- **Sites, departments and employees** referenced but not on file are created at commit.
  The review step states exactly how many of each, so it is confirmed rather than silent.
- **The validation report is a client deliverable**, downloadable as CSV with every row's
  status and issues; rejected rows download separately with their original cells intact.

Every suggestion is a suggestion. Nothing is applied to a row until it is accepted in the
mapping step.

### Hierarchy of controls

- Badges always render the label text; `density="dense"` prefixes the rank
  (`3 · Engineering`, `— · Unclassified`). Colour never carries the meaning alone.
- The corrective-action form renders the five levels as a vertical stack in rank order with
  swatch and description, "Not classified yet" at the bottom, and **nothing preselected**.
- On import, an unrecognised control value imports as `null` — never as a nearest match —
  and a missing classification raises no warning and rejects nothing.
- The needs-classification queue lists unclassified actions newest-incident-first and
  assigns inline. Clearing a level back to unclassified is supported, so a mis-click is
  recoverable rather than sticky.

### Verification

`npm run verify:import` runs 53 assertions over `fixtures/messy-incidents.csv`, a synthetic
sheet built to be awkward: four date formats, an unparseable date, a day-first date, a
duplicate row, a missing site, unrecognised control values, and enum spellings that do not
match ours. It asserts the spec's explicit rules, including that suggestions never
auto-apply and that `housekeeping` stays unclassified rather than snapping to a level.

The database write path was verified separately against the live schema in a transaction
that rolls back: `organization_id` stamped by trigger from a payload that never contains
it, a corrective action saving with a NULL control level, the enriched view reporting
Unclassified as rank `null` / sort `999` / token `0` / `is_engineering_or_above` `null`,
the queue responding to inline assignment and to clearing, and a second tenant seeing zero
rows and reclassifying zero of the first tenant's actions.

> **Note on end-to-end browser testing.** The two halves were verified separately because
> this environment's network policy does not allow egress to `*.supabase.co`, so the running
> app cannot reach the database from inside the container. Adding that host to the
> environment's egress settings would allow a full browser run.

---

## Phase 3 — Incident Dashboard

### The metric layer

Metrics are pure functions over an aggregate, in `src/lib/metrics/definitions.ts`. Each
one carries its formula, the actual input values, and — for the regulatory rates — its
citation, so the UI can always show its working. Being pure is what makes them directly
testable against known inputs rather than eyeballed on a chart.

Two data-integrity rules run through all of it:

- **Nothing is annualised, projected or extrapolated.** Every figure is an actual for the
  filtered period.
- **A missing denominator is never zero and never estimated.** If any month in the
  filtered range is missing an `hours_worked` row for a site in scope, the rate is `null`
  and the card renders an em dash with the reason and the missing months named. The
  monthly TRIR line breaks at those months rather than dropping to zero.

Every rate card shows its denominator directly beneath the value.

### KPIs

Regulatory rates (badged **OSHA**, each with a 29 CFR 1904 citation): TRIR, DART, LTIFR,
Severity Rate.

Program signals — deliberately separated in the UI and explicitly *not* compliance
metrics: Days Since Last LTI / MTI, % Hazard Yield, Near Miss Ratio, Corrective Action
Closure, and % of corrective actions at Engineering or above.

**% Hazard Yield** flags itself when it reads zero: inspections happening but finding
nothing is an inspection-quality problem, not evidence of a safe site.

**% at Engineering or above** = (rank 1 + 2 + 3) ÷ actions *that have a classification*.
Unclassified records are excluded from the denominator, not counted as a miss. Coverage
is always stated beneath the value — "Based on N of M actions classified (X%)" — and
below 50% coverage the card renders muted with "Low coverage — interpret with caution."

### Charts

Monthly trend (stacked mix + TRIR overlay), leading vs lagging, corrective actions by
hierarchy level, injury Pareto, body part, root cause, tenure at incident, department ×
type heatmap, and cost by department.

Colour decisions were computed rather than eyeballed. The four categorical slots were run
through a CVD/contrast validator against this app's actual surfaces in both modes — worst
adjacent CVD ΔE 9.1 light / 8.4 dark, normal-vision ΔE 22.9 / 19.8. Two light-mode slots
fall below 3:1 on white, which obligates relief: **every chart has a table-view twin**, so
no value is reachable only by hovering and no meaning rests on colour alone.

Series colours are fixed per entity, so filtering a series out never repaints the
survivors. The heatmap uses a single-hue sequential ramp with the counts printed in the
cells. Stacked segments are separated by a gap in the surface colour rather than by
borders.

The hierarchy-of-controls ramp is a deliberate exception to the categorical rules: it is a
single-hue ordinal scale, which is not separable under red-green colour vision deficiency,
and its palest steps sit close to the page. Both are mitigated as the spec requires —
every segment labelled, the legend carrying rank and label text, a surface-coloured gap
giving the pale steps a visible edge, and the table view holding every number. The
mandated hex values are unchanged.

### Report export

`/dashboard/report` renders the filtered view with a header block (client, site,
department, reporting period, generated timestamp), every metric with its formula and
inputs expanded, and print CSS for A4. It prints via the browser rather than a server-side
PDF library, so the report is always the same rendering the user was looking at, with
selectable text and no second code path to drift.

### Demo data

`supabase/seed.sql` builds a synthetic demo organisation — 2 sites, 8 departments, 60
employees, 300 incidents over five years, complete monthly hours and leading indicators,
and 60 corrective actions with ~30% deliberately left unclassified. It is deterministic
and destructive only to the demo org. Login: `demo@example.test` / `safepulse-demo`.

### Verification

`npm run verify:metrics` runs 70 assertions: the OSHA arithmetic against worked examples,
every missing-hours path, the maturity denominator rules and coverage thresholds, the
divide-by-zero guards, and the month-range maths behind hours coverage.

The last block is a cross-check against the database: the 2025 aggregate was computed in
SQL on the seeded data — recordables by type, DART off the view's own `is_dart_case`,
control levels off `hoc_rank` — and those exact inputs are fed back through the TypeScript
formulas. SQL says TRIR 3.1484; the formula layer agrees. That proves the two sides match
rather than each being internally consistent but different.

The chart layer was rendered in a browser against fixture data and inspected in both light
and dark mode: 22 chart surfaces, no console errors, the TRIR line correctly breaking at
months with no hours, and Unclassified rendering as its own grey segment outside the ramp.

---

## Brand

The supplied palette, applied unchanged. What varies is *where* each colour may be
used, which is a contrast question rather than a taste one, so it was measured:

| Role | Hex | On white | Used for |
| --- | --- | --- | --- |
| Primary | `#1E3A8A` | 10.36:1 | Nav bar, buttons, links, focus ring, single-series charts |
| Blue Dark | `#010133` | 19.93:1 | Body ink; dark-mode card surface |
| California Gold | `#FDB515` | 1.78:1 | Fill / rule only — dark-mode primary button |
| Heritage Gold | `#C09748` | 2.71:1 | Fill / rule only |
| Metallic Gold | `#BC9B6A` | 2.61:1 | Fill / rule only |
| Light Blue | `#14B8A6` | 2.49:1 | Fill / rule only |

The three golds and the teal cannot carry text on a white page — all four sit between
1.78:1 and 2.71:1. They do structural work instead: the rule under the nav bar, the bar
across the report header, the active-tab underline. All four clear 6.6–11.2:1 against
Blue Dark, so they carry dark ink happily as *fills*. In dark mode the primary navy
would disappear into the navy card, so buttons take California Gold with dark ink
(11.2:1).

`npm run verify:contrast` now checks 19 brand and status pairs alongside the six
hierarchy tokens, and fails the build if any drops below WCAG AA.

The golds are brand colours, not status colours. Warning and danger stay semantic and
separate, so a gold accent never reads as an alert.

### Charts keep their own palette

Brand colours were run through the CVD validator as a categorical chart set and
**failed**: navy below the lightness band, gold above it, metallic gold under the chroma
floor (it reads grey), and three of the four below 3:1 on white. Multi-series charts
therefore keep the validated palette. Brand identity lives in the chrome; series identity
has to stay legible. Single-series charts — Pareto, body part, root cause, tenure — do
wear the brand navy, where one colour is all that is needed and 10.36:1 needs no relief.

Brand dark `#010133` was validated as a dark chart surface and passes, so it is the
dark-mode card.

### Logo

`src/components/brand/logo.tsx` is currently a **placeholder mark**, deliberately generic
so it cannot be mistaken for the real one. Every surface that shows a logo — nav, sign-in,
printed report — renders through that one file, so dropping in the supplied SVG is a
single-file change.
