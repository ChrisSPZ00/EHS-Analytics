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
npm run typecheck        # tsc --noEmit
npm run lint             # eslint
npm run verify:contrast  # WCAG AA check on the hierarchy-of-controls tokens; runs in build
```

Tenant isolation is proven by `supabase/tests/rls.sql` — 51 assertions, safe to run
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

## Next.js version note

This project pins Next.js 15 (the scaffolder defaults to 16). Check `package.json` before
relying on version-specific APIs.
