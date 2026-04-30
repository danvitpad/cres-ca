/** --- YAML
 * name: Subscriptions Lifecycle Cron
 * description: Ежедневно 03:00 UTC прогоняет subscriptions:
 *              · trial → past_due при истекшем trial_ends_at
 *              · past_due → expired (downgrade в starter) при >7 дней просрочки
 *              · current_period_end → past_due при просрочке активной подписки
 *              · pre-warning за 3 дня и 1 день до окончания trial / платного периода
 * created: 2026-04-13
 * updated: 2026-04-30
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

interface SubRow {
  id: string;
  profile_id: string;
  tier: string;
  status: string;
  trial_ends_at: string | null;
  current_period_end: string | null;
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
  const in1Day  = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000).toISOString();
  const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();

  const result = {
    trial_to_past_due: 0,
    active_to_past_due: 0,
    past_due_to_expired: 0,
    warned_3day: 0,
    warned_1day: 0,
  };

  /** Шлём warning только раз — фильтр через notifications.data->>'sub_warn_kind'. */
  async function alreadyWarned(profileId: string, kind: string): Promise<boolean> {
    const since = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('profile_id', profileId)
      .gte('created_at', since)
      .filter('data->>sub_warn_kind', 'eq', kind);
    return (count ?? 0) > 0;
  }

  // Профили, помеченные на удаление, исключаем из всех веток (биллинг ставится на паузу).
  const { data: deletedProfiles } = await supabase
    .from('profiles')
    .select('id')
    .not('deleted_at', 'is', null);
  const deletedSet = new Set<string>(((deletedProfiles ?? []) as Array<{ id: string }>).map((p) => p.id));
  const skipDeleted = <T extends { profile_id: string }>(rows: T[] | null | undefined): T[] =>
    (rows ?? []).filter((r) => !deletedSet.has(r.profile_id));

  // ── Pre-warning: за 3 дня до конца trial / платного периода ──
  const { data: warn3raw } = await supabase
    .from('subscriptions')
    .select('id, profile_id, tier, status, trial_ends_at, current_period_end')
    .or(`and(tier.eq.trial,status.eq.trial,trial_ends_at.gte.${nowIso},trial_ends_at.lt.${in3Days}),and(status.eq.active,current_period_end.gte.${nowIso},current_period_end.lt.${in3Days})`);
  const warn3 = skipDeleted((warn3raw ?? []) as SubRow[]);

  for (const sub of warn3 as SubRow[]) {
    if (await alreadyWarned(sub.profile_id, 'sub_3day')) continue;
    const isTrial = sub.tier === 'trial';
    const title = isTrial ? '⏰ 3 дня до конца пробного периода' : '⏰ 3 дня до окончания подписки';
    const body = isTrial
      ? 'Чтобы не потерять доступ к платным функциям — выбери тариф в Биллинге.'
      : 'Подписка скоро продлится автоматически. Если способ оплаты сменился — обнови в Биллинге.';
    await supabase.from('notifications').insert({
      profile_id: sub.profile_id,
      type: 'subscription', title, body, link: '/settings/billing',
      data: { sub_warn_kind: 'sub_3day' },
    });
    await notifyTg(supabase, sub.profile_id, title, body);
    result.warned_3day += 1;
  }

  // ── Pre-warning: за 1 день ──
  const { data: warn1raw } = await supabase
    .from('subscriptions')
    .select('id, profile_id, tier, status, trial_ends_at, current_period_end')
    .or(`and(tier.eq.trial,status.eq.trial,trial_ends_at.gte.${nowIso},trial_ends_at.lt.${in1Day}),and(status.eq.active,current_period_end.gte.${nowIso},current_period_end.lt.${in1Day})`);
  const warn1 = skipDeleted((warn1raw ?? []) as SubRow[]);

  for (const sub of warn1 as SubRow[]) {
    if (await alreadyWarned(sub.profile_id, 'sub_1day')) continue;
    const isTrial = sub.tier === 'trial';
    const title = isTrial ? '🔔 Завтра закончится пробный период' : '🔔 Завтра спишется оплата подписки';
    const body = isTrial
      ? 'Если не выберешь тариф — после окончания пробника платные функции отключатся.'
      : 'Проверь карту в Биллинге — если она удалена / просрочена, подписка перейдёт в просрочку.';
    await supabase.from('notifications').insert({
      profile_id: sub.profile_id,
      type: 'subscription', title, body, link: '/settings/billing',
      data: { sub_warn_kind: 'sub_1day' },
    });
    await notifyTg(supabase, sub.profile_id, title, body);
    result.warned_1day += 1;
  }

  // 1. trial → past_due: trial закончился, оплата не пришла
  const { data: expiredTrialsRaw } = await supabase
    .from('subscriptions')
    .select('id, profile_id')
    .eq('tier', 'trial')
    .eq('status', 'trial')
    .lt('trial_ends_at', nowIso);
  const expiredTrials = skipDeleted((expiredTrialsRaw ?? []) as Array<{ id: string; profile_id: string }>);

  for (const sub of expiredTrials) {
    const title = 'Пробный период завершён';
    const body = 'Выберите тариф, чтобы продолжить пользоваться платными функциями.';
    await supabase.from('subscriptions').update({ status: 'past_due' }).eq('id', sub.id);
    await supabase.from('notifications').insert({
      profile_id: sub.profile_id,
      type: 'subscription', title, body, link: '/settings/billing',
    });
    await notifyTg(supabase, sub.profile_id, title, body);
    result.trial_to_past_due += 1;
  }

  // 2. active → past_due: current_period_end прошёл
  const { data: expiredActiveRaw } = await supabase
    .from('subscriptions')
    .select('id, profile_id')
    .eq('status', 'active')
    .lt('current_period_end', nowIso);
  const expiredActive = skipDeleted((expiredActiveRaw ?? []) as Array<{ id: string; profile_id: string }>);

  for (const sub of expiredActive) {
    const title = 'Оплата просрочена';
    const body = 'Не удалось продлить подписку. Обнови способ оплаты в Биллинге — у тебя 7 дней до отключения платных функций.';
    await supabase.from('subscriptions').update({ status: 'past_due' }).eq('id', sub.id);
    await supabase.from('notifications').insert({
      profile_id: sub.profile_id,
      type: 'subscription', title, body, link: '/settings/billing',
    });
    await notifyTg(supabase, sub.profile_id, title, body);
    result.active_to_past_due += 1;
  }

  // 3. past_due → expired: >7 дней просрочки (downgrade в starter)
  const { data: longPastDueRaw } = await supabase
    .from('subscriptions')
    .select('id, profile_id, updated_at')
    .eq('status', 'past_due')
    .lt('updated_at', sevenDaysAgo);
  const longPastDue = skipDeleted((longPastDueRaw ?? []) as Array<{ id: string; profile_id: string; updated_at: string }>);

  for (const sub of longPastDue) {
    const title = 'Подписка приостановлена';
    const body = 'Вы автоматически переведены на минимальный тариф. Платные функции отключены до новой оплаты.';
    await supabase
      .from('subscriptions')
      .update({ status: 'expired', tier: 'starter' })
      .eq('id', sub.id);
    await supabase.from('notifications').insert({
      profile_id: sub.profile_id,
      type: 'subscription', title, body, link: '/settings/billing',
    });
    await notifyTg(supabase, sub.profile_id, title, body);
    result.past_due_to_expired += 1;
  }

  return NextResponse.json({ ok: true, ...result });
}
