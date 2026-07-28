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

## Build status

| Phase | Scope | State |
| --- | --- | --- |
| 1 | Schema and RLS foundation | Complete |
| 2 | Incident Log (table, forms, CSV import) | Not started |
| 3 | Incident Dashboard | Not started |
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
