-- Harden trigger function grants (resolves database-linter 0028/0029 findings).
--
-- Supabase exposes every function in the `public` schema as a PostgREST RPC endpoint.
-- The trigger functions below were inheriting the default EXECUTE grant to PUBLIC, which
-- made them reachable at /rest/v1/rpc/<name> by anon and authenticated alike.
--
-- Postgres checks EXECUTE on a trigger function at CREATE TRIGGER time, not each time the
-- trigger fires, so revoking these does not affect the triggers that already reference
-- them. They simply stop being part of the public API surface.

revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.set_organization_id() from public, anon, authenticated;
revoke all on function public.set_organization_id_allow_system() from public, anon, authenticated;
revoke all on function public.lock_organization_id() from public, anon, authenticated;
revoke all on function public.guard_profile_update() from public, anon, authenticated;

-- The remaining SECURITY DEFINER functions in public stay callable by `authenticated`,
-- deliberately:
--
--   current_org_id(), current_org_role(), can_write(), is_org_admin()
--     Required: RLS policy expressions are evaluated as the querying role, so
--     `authenticated` must hold EXECUTE on every function a policy references. Each takes
--     no arguments and reports only facts about the caller's own session -- their own org
--     id and their own role -- so RPC exposure discloses nothing they cannot already see.
--
--   bootstrap_organization(), add_member_to_current_org()
--     Intentional: these ARE the membership API. Neither accepts a target organization --
--     it is always derived from the caller -- and each performs its own authorization
--     check before writing. That is precisely why they are SECURITY DEFINER rather than
--     leaving profiles insertable under RLS.
