/** --- YAML
 * name: Superadmin blacklist data
 * description: listBlacklist() — server-only query joining platform_blacklist with profile (name / email / role) for /superadmin/blacklist.
 * created: 2026-04-21
 * --- */

import { createClient as createAdminClient } from '@supabase/supabase-js';

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export interface BlacklistListRow {
  id: string;
  profileId: string;
  profileName: string;
  profileEmail: string | null;
  profileType: 'client' | 'master' | 'salon' | 'other';
  reason: string | null;
  bannedAt: string;
}

export async function listBlacklist(): Promise<BlacklistListRow[]> {
  const db = admin();
  const { data, error } = await db
    .from('platform_blacklist')
    .select(
      'id, profile_id, reason, banned_at, profiles:profile_id(full_name, first_name, email, role, masters:masters!masters_profile_id_fkey(id), salons:salons!salons_owner_id_fkey(id))',
    )
    .order('banned_at', { ascending: false });

  if (error) {
    console.error('[superadmin/blacklist] list error:', error.message);
    return [];
  }

  type ProfileRef = {
    full_name: string | null;
    first_name: string | null;
    email: string | null;
    role: string;
    masters: Array<{ id: string }> | null;
    salons: Array<{ id: string }> | null;
  };
  type Row = {
    id: string;
    profile_id: string;
    reason: string | null;
    banned_at: string;
    profiles: ProfileRef | ProfileRef[] | null;
  };

  return ((data ?? []) as unknown as Row[]).map((r) => {
    const prof = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
    const hasMaster = (prof?.masters?.length ?? 0) > 0;
    const hasSalon = (prof?.salons?.length ?? 0) > 0;
    const profileType: BlacklistListRow['profileType'] = hasSalon
      ? 'salon'
      : hasMaster
        ? 'master'
        : prof?.role === 'client'
          ? 'client'
          : 'other';
    return {
      id: r.id,
      profileId: r.profile_id,
      profileName: prof?.full_name || prof?.first_name || 'Без имени',
      profileEmail: prof?.email ?? null,
      profileType,
      reason: r.reason,
      bannedAt: r.banned_at,
    };
  });
}

export async function isProfileBanned(profileId: string): Promise<boolean> {
  const db = admin();
  const { data } = await db
    .from('platform_blacklist')
    .select('id')
    .eq('profile_id', profileId)
    .maybeSingle();
  return !!data;
}

export async function getBanReason(profileId: string): Promise<string | null> {
  const db = admin();
  const { data } = await db
    .from('platform_blacklist')
    .select('reason')
    .eq('profile_id', profileId)
    .maybeSingle();
  return data?.reason ?? null;
}
