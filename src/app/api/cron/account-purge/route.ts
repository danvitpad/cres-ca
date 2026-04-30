/** --- YAML
 * name: Account Purge Cron
 * description: Daily cron для GDPR-удаления.
 *              · pre-warning за 7 дней до фактического удаления (in-app + TG)
 *              · pre-warning за 1 день
 *              · hard-delete auth.users через 30 дней с момента deleted_at
 *              Дедупликация warning'ов через notifications.data->>'purge_warn_kind'.
 * created: 2026-04-19
 * updated: 2026-04-30
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { notifyUser } from '@/lib/notifications/notify';

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

  const now = Date.now();
  const cutoff30 = new Date(now - 30 * 24 * 60 * 60 * 1000);
  // Аккаунты, у которых deleted_at старше чем 23 дня, но младше 24 дней — за 7 дней до purge.
  const warn7Lo = new Date(now - 24 * 24 * 60 * 60 * 1000);
  const warn7Hi = new Date(now - 22 * 24 * 60 * 60 * 1000);
  // Аккаунты, у которых deleted_at старше 29 дней, но младше 30 — за 1 день до purge.
  const warn1Lo = new Date(now - 30 * 24 * 60 * 60 * 1000);
  const warn1Hi = new Date(now - 28 * 24 * 60 * 60 * 1000);

  async function alreadyWarned(profileId: string, kind: string): Promise<boolean> {
    const since = new Date(now - 36 * 60 * 60 * 1000).toISOString();
    const { count } = await admin
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('profile_id', profileId)
      .gte('created_at', since)
      .filter('data->>purge_warn_kind', 'eq', kind);
    return (count ?? 0) > 0;
  }

  const result = { warned_7day: 0, warned_1day: 0, purged: 0, failed: 0 };

  // 1) Pre-warning за 7 дней.
  const { data: warn7 } = await admin
    .from('profiles')
    .select('id, deleted_at')
    .gte('deleted_at', warn7Lo.toISOString())
    .lt('deleted_at', warn7Hi.toISOString())
    .not('deleted_at', 'is', null);

  for (const p of (warn7 ?? []) as Array<{ id: string; deleted_at: string }>) {
    if (await alreadyWarned(p.id, 'purge_7day')) continue;
    const purgeDate = new Date(new Date(p.deleted_at).getTime() + 30 * 24 * 60 * 60 * 1000);
    const purgeDateStr = purgeDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
    await notifyUser(admin, {
      profileId: p.id,
      title: 'Напоминание: до удаления аккаунта осталось 7 дней',
      body: `${purgeDateStr} учётная запись и связанные с ней данные будут удалены без возможности восстановления. Чтобы отменить удаление, выполните вход в систему и подтвердите восстановление.`,
      data: { type: 'account_purge_warning', purge_warn_kind: 'purge_7day', purge_at: purgeDate.toISOString() },
    });
    result.warned_7day += 1;
  }

  // 2) Pre-warning за 1 день.
  const { data: warn1 } = await admin
    .from('profiles')
    .select('id, deleted_at')
    .gte('deleted_at', warn1Lo.toISOString())
    .lt('deleted_at', warn1Hi.toISOString())
    .not('deleted_at', 'is', null);

  for (const p of (warn1 ?? []) as Array<{ id: string; deleted_at: string }>) {
    if (await alreadyWarned(p.id, 'purge_1day')) continue;
    await notifyUser(admin, {
      profileId: p.id,
      title: 'Финальное уведомление: удаление аккаунта завтра',
      body: 'Это последнее напоминание. Завтра учётная запись и все связанные данные будут удалены без возможности восстановления. Чтобы отменить удаление, выполните вход в систему до окончания текущих суток.',
      data: { type: 'account_purge_warning', purge_warn_kind: 'purge_1day' },
    });
    result.warned_1day += 1;
  }

  // 3) Hard-delete тех, кому уже >30 дней.
  const { data: pending, error } = await admin
    .from('profiles')
    .select('id, email, deleted_at')
    .not('deleted_at', 'is', null)
    .lt('deleted_at', cutoff30.toISOString());

  if (error) return NextResponse.json({ error: error.message, ...result }, { status: 500 });

  const results: { id: string; ok: boolean; error?: string }[] = [];
  for (const p of pending ?? []) {
    const { error: delErr } = await admin.auth.admin.deleteUser(p.id);
    if (delErr) {
      console.error('[account-purge] failed', p.id, delErr);
      results.push({ id: p.id, ok: false, error: delErr.message });
      result.failed += 1;
    } else {
      results.push({ id: p.id, ok: true });
      result.purged += 1;
    }
  }

  return NextResponse.json({ ok: true, ...result, results });
}
