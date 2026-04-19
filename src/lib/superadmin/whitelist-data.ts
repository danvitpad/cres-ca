/** --- YAML
 * name: Superadmin whitelist data
 * description: Server-side query that joins platform_whitelist with profile/master/salon for the /superadmin/whitelist list.
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

export interface WhitelistListRow {
  id: string;
  profileId: string;
  profileName: string;
  profileEmail: string | null;
  profileType: 'client' | 'master' | 'salon' | 'other';
  grantedPlan: string;
  reason: string | null;
  createdAt: string;
  expiresAt: string | null;
  isExpired: boolean;
}

export async function listWhitelist(): Promise<WhitelistListRow[]> {
  const db = admin();
  const { data } = await db
    .from('platform_whitelist')
    .select(
      'id, profile_id, granted_plan, reason, created_at, expires_at, profiles:profile_id(full_name, first_name, email, role, masters:masters!masters_profile_id_fkey(id), salons:salons!salons_owner_id_fkey(id))',
    )
    .order('created_at', { ascending: false });

  type Row = {
    id: string;
    profile_id: string;
    granted_plan: string;
    reason: string | null;
    created_at: string;
    expires_at: string | null;
    profiles:
      | {
          full_name: string | null;
          first_name: string | null;
          email: string | null;
          role: string;
          masters: Array<{ id: string }> | null;
          salons: Array<{ id: string }> | null;
        }
      | Array<{
          full_name: string | null;
          first_name: string | null;
          email: string | null;
          role: string;
          masters: Array<{ id: string }> | null;
          salons: Array<{ id: string }> | null;
        }>
      | null;
  };

  const now = Date.now();
  return ((data ?? []) as unknown as Row[]).map((r) => {
    const prof = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
    const hasMaster = (prof?.masters?.length ?? 0) > 0;
    const hasSalon = (prof?.salons?.length ?? 0) > 0;
    const profileType: WhitelistListRow['profileType'] = hasSalon ? 'salon' : hasMaster ? 'master' : prof?.role === 'client' ? 'client' : 'other';
    return {
      id: r.id,
      profileId: r.profile_id,
      profileName: prof?.full_name || prof?.first_name || 'Без имени',
      profileEmail: prof?.email ?? null,
      profileType,
      grantedPlan: r.granted_plan,
      reason: r.reason,
      createdAt: r.created_at,
      expiresAt: r.expires_at,
      isExpired: r.expires_at ? new Date(r.expires_at).getTime() < now : false,
    };
  });
}
