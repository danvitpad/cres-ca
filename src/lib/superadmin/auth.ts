/** --- YAML
 * name: Superadmin request auth
 * description: Server-side guard for /api/superadmin/* — confirms the caller's session email is in SUPERADMIN_EMAILS, returning the profile id for audit logging. Otherwise throws Response('not found', 404).
 * created: 2026-04-19
 * --- */

import { createClient } from '@/lib/supabase/server';
import { isSuperadminEmail } from '@/lib/superadmin/access';

export async function requireSuperadmin(): Promise<{ profileId: string; email: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Response('not found', { status: 404 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email')
    .eq('id', user.id)
    .maybeSingle();

  const email = profile?.email ?? user.email ?? null;
  if (!isSuperadminEmail(email)) throw new Response('not found', { status: 404 });

  return { profileId: user.id, email: email ?? '' };
}
