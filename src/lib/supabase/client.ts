import { createBrowserClient } from '@supabase/ssr';

import type { Database } from './database.types';

/**
 * Browser-side Supabase client.
 *
 * Only ever holds the publishable (anon) key. Every query it issues is subject to RLS,
 * and organization_id is assigned server-side by trigger -- the browser never sends it.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
