/** --- YAML
 * name: Subscriptions Lifecycle Cron
 * description: Ежедневно прогоняет subscriptions — trial→past_due при истекшем trial_ends_at, past_due→expired при >7 дней просрочки, current_period_end → past_due при просрочке активной подписки.
 * created: 2026-04-13
 * updated: 2026-04-13
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendMessage } from '@/lib/telegram/bot';

async function notifyTg(
  supabase: Awaited<ReturnType<typeof createClient>>,
  profileId: string,
  title: string,
  body: string,
) {
  const { data } = await supabase
    .from('profiles')
    .select('telegram_id')
    .eq('id', profileId)
    .maybeSingle();
  const tgId = (data as { telegram_id: string | null } | null)?.telegram_id;
  if (!tgId) return;
  try {
    await sendMessage(tgId, `<b>${title}</b>\n\n${body}`, { parse_mode: 'HTML' });
  } catch {
    // swallow TG errors — cron must not fail on one missing chat
  }
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = await createClient();
  const now = new Date();
  const nowIso = now.toISOString();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const result = { trial_to_past_due: 0, active_to_past_due: 0, past_due_to_expired: 0 };

  // 1. trial → past_due: trial закончился, оплата не пришла
  const { data: expiredTrials } = await supabase
    .from('subscriptions')
    .select('id, profile_id')
    .eq('tier', 'trial')
    .eq('status', 'trial')
    .lt('trial_ends_at', nowIso);

  for (const sub of expiredTrials || []) {
    const title = 'Пробный период завершён';
    const body = 'Выберите тариф, чтобы продолжить пользоваться платными функциями.';
    await supabase
      .from('subscriptions')
      .update({ status: 'past_due' })
      .eq('id', sub.id);
    await supabase.from('notifications').insert({
      profile_id: sub.profile_id,
      type: 'subscription',
      title,
      body,
      link: '/settings/billing',
    });
    await notifyTg(supabase, sub.profile_id, title, body);
    result.trial_to_past_due += 1;
  }

  // 2. active → past_due: current_period_end прошёл
  const { data: expiredActive } = await supabase
    .from('subscriptions')
    .select('id, profile_id')
    .eq('status', 'active')
    .lt('current_period_end', nowIso);

  for (const sub of expiredActive || []) {
    const title = 'Оплата просрочена';
    const body = 'Не удалось продлить подписку. Обновите способ оплаты в биллинге.';
    await supabase
      .from('subscriptions')
      .update({ status: 'past_due' })
      .eq('id', sub.id);
    await supabase.from('notifications').insert({
      profile_id: sub.profile_id,
      type: 'subscription',
      title,
      body,
      link: '/settings/billing',
    });
    await notifyTg(supabase, sub.profile_id, title, body);
    result.active_to_past_due += 1;
  }

  // 3. past_due → expired: >7 дней просрочки (даунгрейд в trial-блок)
  const { data: longPastDue } = await supabase
    .from('subscriptions')
    .select('id, profile_id, updated_at')
    .eq('status', 'past_due')
    .lt('updated_at', sevenDaysAgo);

  for (const sub of longPastDue || []) {
    const title = 'Подписка приостановлена';
    const body = 'Вы автоматически переведены на минимальный тариф. Платные функции отключены.';
    await supabase
      .from('subscriptions')
      .update({ status: 'expired', tier: 'starter' })
      .eq('id', sub.id);
    await supabase.from('notifications').insert({
      profile_id: sub.profile_id,
      type: 'subscription',
      title,
      body,
      link: '/settings/billing',
    });
    await notifyTg(supabase, sub.profile_id, title, body);
    result.past_due_to_expired += 1;
  }

  return NextResponse.json({ ok: true, ...result });
}
