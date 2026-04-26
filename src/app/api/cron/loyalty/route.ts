/** --- YAML
 * name: Loyalty Cron
 * description: Daily worker for the unified loyalty system. Two responsibilities:
 *   1) Birthday gift promo codes — for every client whose birthday is today,
 *      issues a one-shot, time-limited promo_code at every master they're linked
 *      to (only at masters with loyalty_enabled + loyalty_birthday_enabled).
 *      Sends a TG notification with the code so the client can apply it next visit.
 *   2) Balance expiry — sweeps loyalty_transactions whose visit_earn rows have
 *      passed their expiry window and writes corresponding kind=expiry entries
 *      to the audit log (handled inside the SECURITY DEFINER RPC).
 * created: 2026-04-26
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  // 1. Expire stale balances first so birthday promos are computed against
  //    fresh totals.
  const { data: expiredCount } = await admin.rpc('expire_loyalty_balances');

  // 2. Birthday gift sweep.
  const today = new Date();
  const monthDay = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const { data: clients } = await admin
    .from('clients')
    .select('id, full_name, master_id, profile_id, date_of_birth')
    .not('date_of_birth', 'is', null)
    .not('profile_id', 'is', null);

  const todays = (clients ?? []).filter((c) => {
    if (!c.date_of_birth) return false;
    const dob = new Date(c.date_of_birth);
    const md = `${String(dob.getMonth() + 1).padStart(2, '0')}-${String(dob.getDate()).padStart(2, '0')}`;
    return md === monthDay;
  });

  let promosIssued = 0;
  for (const c of todays) {
    if (!c.profile_id || !c.master_id) continue;
    const { data: promoId } = await admin.rpc('issue_birthday_promo', {
      p_master_id: c.master_id,
      p_profile_id: c.profile_id,
    });
    if (!promoId) continue;
    promosIssued++;

    const { data: promo } = await admin
      .from('promo_codes')
      .select('code, discount_percent, valid_until')
      .eq('id', promoId)
      .single();
    if (!promo) continue;

    const supabase = await createClient();
    await supabase.from('notifications').insert({
      profile_id: c.profile_id,
      channel: 'telegram',
      title: '🎂 С Днём рождения!',
      body: `Поздравляем! У тебя личный промокод ${promo.code} — скидка ${promo.discount_percent}% на следующую запись. Действует до ${new Date(promo.valid_until).toLocaleDateString('ru-RU')}.`,
      scheduled_for: new Date().toISOString(),
      data: {
        kind: 'birthday_promo',
        promo_code_id: promoId,
        master_id: c.master_id,
      },
    });
  }

  return NextResponse.json({
    expired: expiredCount ?? 0,
    birthdays_processed: todays.length,
    promos_issued: promosIssued,
  });
}
