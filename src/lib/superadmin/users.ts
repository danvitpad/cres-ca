/** --- YAML
 * name: Superadmin users helpers
 * description: Server-only helpers for /superadmin/users — search/filter list + single-profile detail (subscription + whitelist + activity).
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

export type UserType = 'all' | 'client' | 'master' | 'salon';
export type UserSubFilter = 'all' | 'trial' | 'starter' | 'pro' | 'business' | 'none' | 'whitelist';

export interface UsersListRow {
  id: string;
  email: string | null;
  displayName: string;
  phone: string | null;
  role: string;
  type: 'client' | 'master' | 'salon' | 'other';
  subscriptionTier: string | null;
  subscriptionStatus: string | null;
  whitelisted: boolean;
  city: string | null;
  createdAt: string;
}

export interface UsersListFilters {
  query?: string;
  type?: UserType;
  sub?: UserSubFilter;
  limit?: number;
  offset?: number;
}

export interface UsersListResult {
  rows: UsersListRow[];
  total: number;
}

export async function listUsers(f: UsersListFilters = {}): Promise<UsersListResult> {
  const db = admin();
  const limit = Math.min(f.limit ?? 50, 200);
  const offset = f.offset ?? 0;

  let q = db
    .from('profiles')
    .select(
      'id, email, full_name, first_name, phone, role, created_at, masters:masters!masters_profile_id_fkey(id, city), salons:salons!salons_owner_id_fkey(id, city), subscriptions(tier, status, created_at), platform_whitelist(profile_id)',
      { count: 'exact' },
    )
    .is('deleted_at', null);

  if (f.query && f.query.trim()) {
    const term = f.query.trim().replace(/%/g, '');
    q = q.or(`full_name.ilike.%${term}%,first_name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`);
  }

  if (f.type === 'client') q = q.eq('role', 'client');
  else if (f.type === 'master') q = q.eq('role', 'master');
  else if (f.type === 'salon') q = q.eq('role', 'salon_admin');

  q = q.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

  const { data, count } = await q;

  type Row = {
    id: string;
    email: string | null;
    full_name: string | null;
    first_name: string | null;
    phone: string | null;
    role: string;
    created_at: string;
    masters: Array<{ id: string; city: string | null }> | null;
    salons: Array<{ id: string; city: string | null }> | null;
    subscriptions: Array<{ tier: string; status: string; created_at: string }> | null;
    platform_whitelist: Array<{ profile_id: string }> | null;
  };

  const rows: UsersListRow[] = ((data ?? []) as unknown as Row[]).map((r) => {
    const hasMaster = (r.masters?.length ?? 0) > 0;
    const hasSalon = (r.salons?.length ?? 0) > 0;
    const type: UsersListRow['type'] = hasSalon ? 'salon' : hasMaster ? 'master' : r.role === 'client' ? 'client' : 'other';

    const subs = (r.subscriptions ?? []).slice().sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    const latest = subs[0] ?? null;

    return {
      id: r.id,
      email: r.email,
      displayName: r.full_name || r.first_name || 'Без имени',
      phone: r.phone,
      role: r.role,
      type,
      subscriptionTier: latest?.tier ?? null,
      subscriptionStatus: latest?.status ?? null,
      whitelisted: (r.platform_whitelist?.length ?? 0) > 0,
      city: r.masters?.[0]?.city ?? r.salons?.[0]?.city ?? null,
      createdAt: r.created_at,
    };
  });

  const filtered = f.sub && f.sub !== 'all'
    ? rows.filter((x) => {
        if (f.sub === 'whitelist') return x.whitelisted;
        if (f.sub === 'none') return !x.subscriptionTier;
        return x.subscriptionTier === f.sub;
      })
    : rows;

  return { rows: filtered, total: count ?? filtered.length };
}

export interface UserDetail {
  profile: {
    id: string;
    email: string | null;
    displayName: string;
    phone: string | null;
    role: string;
    createdAt: string;
    telegramUsername: string | null;
    locale: string | null;
  };
  master: { id: string; city: string | null; specialization: string | null; isActive: boolean } | null;
  salon: { id: string; name: string; city: string | null } | null;
  subscription: {
    tier: string;
    status: string;
    trialEndsAt: string | null;
    currentPeriodEnd: string | null;
    billingPeriod: string | null;
    createdAt: string;
  } | null;
  whitelist: {
    grantedPlan: string;
    reason: string | null;
    expiresAt: string | null;
    createdAt: string;
  } | null;
  activity: {
    lastSignInAt: string | null;
    appointmentsCount: number;
    completedAppointmentsCount: number;
    voiceActionsCount: number;
  };
  paymentsCount: number;
}

export async function getUserDetail(profileId: string): Promise<UserDetail | null> {
  const db = admin();
  const { data: p } = await db
    .from('profiles')
    .select('id, email, full_name, first_name, phone, role, created_at, telegram_username, locale')
    .eq('id', profileId)
    .maybeSingle();
  if (!p) return null;

  const [master, salon, sub, wl, appts, apptsDone, voice, payments] = await Promise.all([
    db.from('masters').select('id, city, specialization, is_active').eq('profile_id', profileId).maybeSingle(),
    db.from('salons').select('id, name, city').eq('owner_id', profileId).maybeSingle(),
    db.from('subscriptions').select('tier, status, trial_ends_at, current_period_end, billing_period, created_at').eq('profile_id', profileId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    db.from('platform_whitelist').select('granted_plan, reason, expires_at, created_at').eq('profile_id', profileId).maybeSingle(),
    db.from('appointments').select('id', { count: 'exact', head: true }).or(`client_id.eq.${profileId},master_id.eq.${profileId}`),
    db.from('appointments').select('id', { count: 'exact', head: true }).eq('status', 'completed').or(`client_id.eq.${profileId},master_id.eq.${profileId}`),
    db.from('ai_actions_log').select('id', { count: 'exact', head: true }).eq('profile_id', profileId).eq('source', 'voice'),
    db.from('payment_history').select('id', { count: 'exact', head: true }).eq('profile_id', profileId),
  ]);

  return {
    profile: {
      id: p.id,
      email: p.email,
      displayName: p.full_name || p.first_name || 'Без имени',
      phone: p.phone,
      role: p.role,
      createdAt: p.created_at,
      telegramUsername: p.telegram_username,
      locale: p.locale,
    },
    master: master.data ? { id: master.data.id, city: master.data.city, specialization: master.data.specialization, isActive: master.data.is_active } : null,
    salon: salon.data ? { id: salon.data.id, name: salon.data.name, city: salon.data.city } : null,
    subscription: sub.data
      ? {
          tier: sub.data.tier,
          status: sub.data.status,
          trialEndsAt: sub.data.trial_ends_at,
          currentPeriodEnd: sub.data.current_period_end,
          billingPeriod: sub.data.billing_period,
          createdAt: sub.data.created_at,
        }
      : null,
    whitelist: wl.data ? { grantedPlan: wl.data.granted_plan, reason: wl.data.reason, expiresAt: wl.data.expires_at, createdAt: wl.data.created_at } : null,
    activity: {
      lastSignInAt: null,
      appointmentsCount: appts.count ?? 0,
      completedAppointmentsCount: apptsDone.count ?? 0,
      voiceActionsCount: voice.count ?? 0,
    },
    paymentsCount: payments.count ?? 0,
  };
}
