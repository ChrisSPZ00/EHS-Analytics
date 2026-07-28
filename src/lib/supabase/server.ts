import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

import type { Database } from './database.types';

/**
 * Server-side Supabase client, scoped to the signed-in user.
 *
 * This uses the publishable key and the caller's session, NOT the service role, so RLS
 * applies to everything it reads and writes. Server code has no standing need to bypass
 * tenant isolation; if a future task genuinely does, it should be a narrow, deliberate
 * exception rather than the default client.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component, where cookies are read-only. Safe to
            // ignore when middleware is refreshing the session.
          }
        },
      },
    },
  );
}
