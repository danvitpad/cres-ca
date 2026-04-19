/** --- YAML
 * name: Referral — My Stats
 * description: GET returns current user's referral_code, absolute link, bonus_balance,
 *              recent bonus transactions, and count of referred users (via referrals table).
 * created: 2026-04-19
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const [{ data: profile }, { data: txs }, { count: referralsCount }] = await Promise.all([
    supabase
      .from('profiles')
      .select('referral_code, bonus_balance, full_name')
      .eq('id', user.id)
      .maybeSingle(),
    supabase
      .from('bonus_transactions')
      .select('id, kind, amount, balance_after, note, created_at')
      .eq('profile_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('referrals')
      .select('id', { count: 'exact', head: true })
      .eq('referrer_master_profile_id', user.id),
  ]);

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? '';
  const link = profile?.referral_code ? `${origin}/ref/${profile.referral_code}` : null;

  return NextResponse.json({
    referral_code: profile?.referral_code ?? null,
    link,
    bonus_balance: profile?.bonus_balance ?? 0,
    full_name: profile?.full_name ?? null,
    referrals_count: referralsCount ?? 0,
    recent_transactions: txs ?? [],
  });
}
