/** --- YAML
 * name: Superadmin access helper
 * description: Server-only helper — checks whether a given profile email is in SUPERADMIN_EMAILS env.
 *              Returns 404-flag for unauthorized users (not 403, so the route appears not to exist).
 * created: 2026-04-19
 * --- */

import { createClient as createAdminClient } from '@supabase/supabase-js';

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export function getSuperadminEmails(): string[] {
  const raw = process.env.SUPERADMIN_EMAILS ?? '';
  return raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isSuperadminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return getSuperadminEmails().includes(email.trim().toLowerCase());
}

export async function isSuperadminProfile(profileId: string): Promise<boolean> {
  const { data } = await admin()
    .from('profiles')
    .select('email')
    .eq('id', profileId)
    .maybeSingle();
  return isSuperadminEmail(data?.email ?? null);
}

export async function logSuperadminAction(
  adminProfileId: string,
  action: string,
  targetType: string | null,
  targetId: string | null,
  details: Record<string, unknown> | null = null,
): Promise<void> {
  await admin()
    .from('superadmin_audit_log')
    .insert({
      admin_profile_id: adminProfileId,
      action,
      target_type: targetType,
      target_id: targetId,
      details,
    });
}

export interface WhitelistEntry {
  profile_id: string;
  granted_plan: 'starter' | 'pro' | 'business';
  expires_at: string | null;
  reason: string | null;
}

export async function getWhitelistEntry(profileId: string): Promise<WhitelistEntry | null> {
  const { data } = await admin()
    .from('platform_whitelist')
    .select('profile_id, granted_plan, expires_at, reason')
    .eq('profile_id', profileId)
    .maybeSingle();
  if (!data) return null;
  if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) return null;
  return data as WhitelistEntry;
}
