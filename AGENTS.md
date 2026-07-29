# SafePulse Analytics — working notes

EHS analytics for SMB manufacturers, food processors, warehouses and ag operations.
Next.js 15 (App Router) + TypeScript + Tailwind + Supabase.

## Non-negotiables

1. **No real data, ever.** All seed and fixture data is synthetic. No real company names,
   permit numbers, EPA IDs, claim numbers or employee names — including in comments and
   test fixtures. Test identities use `example.test` addresses.

2. **`organization_id` is never accepted from the client.** It is assigned by a
   `BEFORE INSERT` trigger from `public.current_org_id()` and pinned on update. Never add
   a code path that writes it, and never add a table without calling
   `public.apply_tenant_guards()` on it in the same migration.

3. **RLS on every table.** Every view must be created `WITH (security_invoker = on)` — a
   view without it runs as its owner and bypasses RLS entirely.

4. **Migrations only.** Schema changes go through `apply_migration` with a descriptive
   name and a matching file in `supabase/migrations/`. Never `execute_sql` for DDL.
   Run `get_advisors` after every migration and resolve security findings before moving on.

5. **Every calculated metric renders its formula in the UI** — the formula, the actual
   input values, and the regulatory citation. Glass box, not black box.

6. **Never annualize, project or extrapolate.** Actuals only. If `hours_worked` is missing
   for a period, rate cards render `—` with "Hours not entered for this period" — never
   zero, never an estimate.

## Checks

```
npm run typecheck         # tsc --noEmit
npm run lint              # eslint
npm run verify:contrast   # WCAG AA check on the hierarchy-of-controls tokens; runs in build
npm run verify:compliance # recurrence maths and due states
```

Tenant isolation is proven by `supabase/tests/rls.sql` — 67 assertions, safe to run
against any environment (it rolls back).

## Hierarchy of controls

`corrective_actions.hierarchy_of_controls` is **nullable and never blocks a save or an
import**. NULL means "not classified yet" and is a first-class state — never fold it into
a level, default it, or guess on import.

Rank lives in `public.hierarchy_of_control_levels`, not in enum order. Sort ascending by
rank; Unclassified sorts last. `src/lib/domain/hierarchy-of-controls.ts` is the
application-side mirror. Colour tokens are `--hoc-0..5-{bg,fg}` in `globals.css`;
token 0 is the neutral grey for Unclassified and sits outside the green ramp.

Badges always render the label text. Colour never carries meaning on its own — a
five-step single-hue ramp is not distinguishable under red-green colour vision
deficiency, and this is a safety product.

## Compliance calendar

**A due date is never invented.** An obligation with neither `due_date` nor a recurrence
anchor generates nothing; `Ongoing` and `Per event` generate nothing ever. Both are
first-class states with a visible explanation in the UI — never an empty row, never a
guessed date.

**Regeneration never destroys work.** `regenerate_compliance_events()` removes only
untouched future placeholders (`Not Started`, no `completed_date`, no `completed_by`, no
`evidence_notes`). Completed, annotated and past entries survive a schedule change. Do not
widen that delete.

The generator lives in SQL because it runs inside the trigger on `compliance_obligations`.
`src/lib/domain/compliance.ts` is the application-side mirror and exists so the form can
preview dates; if you change one, change both — `npm run verify:compliance` cross-checks
them against dates read back from the SQL generator.

Instances sit on the lattice `anchor + n × step`, recomputed from the anchor every time.
Never step from the previous instance: Postgres clamps 31 January + 1 month to 28
February, and stepping on from the clamped date walks the obligation off its own day of
the month for good.

`completed_on_time` is NULL, not false, for an open entry — it leaves the on-time
denominator rather than counting as a miss, the same rule `is_engineering_or_above`
follows.

## Brand

Palette tokens live at the top of `globals.css` with the measured contrast of each
colour beside it. The golds and the teal sit at 1.78–2.71:1 on white, so they are fills
and rules only — never text on a light surface; accent wording uses
`--brand-accent-text`. `verify:contrast` checks every pair the UI renders words in, both
modes, and prints the logotype exemption explicitly rather than omitting it.

The logo is vector, drawn in `src/components/brand/logo.tsx` — the single seam for nav,
sign-in and the printed report. Official raster artwork dropped into `public/brand/`
takes precedence. Fonts are Montserrat (headings) and Source Sans 3 (body), self-hosted
by `next/font`. See `docs/brand-assets.md`.

## Next.js version note

This project pins Next.js 15 (the scaffolder defaults to 16). Check `package.json` before
relying on version-specific APIs.
