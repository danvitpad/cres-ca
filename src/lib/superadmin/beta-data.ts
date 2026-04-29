/** --- YAML
 * name: Superadmin beta-list data
 * description: Server-side queries for /superadmin/beta — список заявок + текущее
 *   состояние глобального флага public_signup_open.
 * created: 2026-04-29
 * --- */

import { createClient as createAdminClient } from '@supabase/supabase-js';

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export interface BetaInviteRow {
  id: string;
  email: string | null;
  telegram_id: number | null;
  full_name: string | null;
  source: 'manual' | 'bot_request' | 'self_signup' | 'imported';
  status: 'pending' | 'approved' | 'rejected' | 'used';
  note: string | null;
  request_text: string | null;
  created_at: string;
  approved_at: string | null;
  rejected_at: string | null;
  used_at: string | null;
  used_by_profile_id: string | null;
  profile_email: string | null;
  profile_full_name: string | null;
  profile_role: string | null;
  approved_by_email: string | null;
}

export interface BetaPageData {
  invites: BetaInviteRow[];
  publicSignupOpen: boolean;
  grantPlan: string;
  grantMonths: number;
  counts: {
    pending: number;
    approved: number;
    used: number;
    rejected: number;
  };
}

export async function getBetaPageData(): Promise<BetaPageData> {
  const db = admin();

  const [invitesRes, settingsRes] = await Promise.all([
    db.from('beta_invites_admin').select('*').order('created_at', { ascending: false }),
    db.from('app_settings').select('key, value').in('key', ['public_signup_open', 'beta_grant_plan', 'beta_grant_months']),
  ]);

  const invites = (invitesRes.data ?? []) as BetaInviteRow[];

  const settings: Record<string, unknown> = {};
  for (const row of settingsRes.data ?? []) {
    settings[row.key as string] = row.value;
  }

  const publicSignupOpen = settings.public_signup_open === true || settings.public_signup_open === 'true';
  const grantPlan = typeof settings.beta_grant_plan === 'string'
    ? settings.beta_grant_plan
    : 'business';
  const grantMonths = typeof settings.beta_grant_months === 'number'
    ? settings.beta_grant_months
    : 6;

  const counts = {
    pending: invites.filter((i) => i.status === 'pending').length,
    approved: invites.filter((i) => i.status === 'approved').length,
    used: invites.filter((i) => i.status === 'used').length,
    rejected: invites.filter((i) => i.status === 'rejected').length,
  };

  return { invites, publicSignupOpen, grantPlan, grantMonths, counts };
}
