/** --- YAML
 * name: Team Roles Helper
 * description: Server-side helpers for determining a user's role inside a salon (admin/master/receptionist)
 *              and guarding server components. Based on salons.owner_id + salon_members.role.
 * created: 2026-04-19
 * --- */

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export type SalonRole = 'admin' | 'master' | 'receptionist';

/**
 * Returns the effective role of the current user in a given salon, or null if not a member.
 * - owner_id is always treated as 'admin', even without a salon_members row.
 * - Otherwise the first active salon_members row for (salon, profile) wins.
 */
export async function getCurrentUserRole(salonId: string): Promise<SalonRole | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: salon } = await supabase
    .from('salons')
    .select('owner_id')
    .eq('id', salonId)
    .maybeSingle();
  if (salon?.owner_id === user.id) return 'admin';

  const { data: member } = await supabase
    .from('salon_members')
    .select('role, status')
    .eq('salon_id', salonId)
    .eq('profile_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  return (member?.role as SalonRole | undefined) ?? null;
}

/**
 * Server-component guard. Redirects to /login if unauthenticated,
 * or to fallbackPath if the user's role is not in the allowed list.
 */
export async function requireSalonRole(
  salonId: string,
  allowed: SalonRole[],
  fallbackPath = '/today',
): Promise<SalonRole> {
  const role = await getCurrentUserRole(salonId);
  if (!role) redirect(fallbackPath);
  if (!allowed.includes(role)) redirect(fallbackPath);
  return role;
}

/**
 * Lists all salons the current user has a role in (as owner or active member).
 * Returns owned salons first, then ones they joined via membership.
 */
export async function getUserSalons(): Promise<Array<{ id: string; name: string; role: SalonRole; team_mode: 'unified' | 'marketplace' }>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const [ownedRes, memberRes] = await Promise.all([
    supabase
      .from('salons')
      .select('id, name, team_mode')
      .eq('owner_id', user.id),
    supabase
      .from('salon_members')
      .select('role, salon:salon_id(id, name, team_mode)')
      .eq('profile_id', user.id)
      .eq('status', 'active'),
  ]);

  const owned = (ownedRes.data ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    team_mode: (s.team_mode ?? 'unified') as 'unified' | 'marketplace',
    role: 'admin' as SalonRole,
  }));

  const joined = ((memberRes.data ?? []) as Array<{
    role: SalonRole;
    salon: { id: string; name: string; team_mode: 'unified' | 'marketplace' } | { id: string; name: string; team_mode: 'unified' | 'marketplace' }[] | null;
  }>)
    .map((m) => {
      const s = Array.isArray(m.salon) ? m.salon[0] : m.salon;
      if (!s) return null;
      return { id: s.id, name: s.name, team_mode: s.team_mode, role: m.role };
    })
    .filter((x): x is { id: string; name: string; team_mode: 'unified' | 'marketplace'; role: SalonRole } => x !== null)
    .filter((x) => !owned.some((o) => o.id === x.id));

  return [...owned, ...joined];
}
