/** --- YAML
 * name: Supabase Browser Client
 * description: Creates Supabase client for use in Client Components (browser)
 * --- */

import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
