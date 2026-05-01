/** --- YAML
 * name: Superadmin — purge user
 * description: Полностью удаляет пользователя отовсюду: auth.users + profile +
 *   master + salon + appointments + clients + services + inventory + expenses
 *   + рассылки + бонусы + рефералы + уведомления и т.д. Безвозвратно.
 *   Защита: только superadmin, только не сам себя, нужен email-confirm в body.
 *   Использование: тестирование (зарегистрировался → проверил → удалил →
 *   зарегистрировался заново на тот же email).
 * created: 2026-05-01
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { requireSuperadmin } from '@/lib/superadmin/auth';

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  // 1. Auth
  let actor: { profileId: string; email: string };
  try {
    actor = await requireSuperadmin();
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { id: targetId } = await context.params;
  if (targetId === actor.profileId) {
    return NextResponse.json({ error: 'cannot_purge_self' }, { status: 400 });
  }

  // 2. Body confirmation: caller must send the target email back.
  const body = await req.json().catch(() => ({}));
  const confirmEmail = String((body as { confirm_email?: string }).confirm_email ?? '').trim().toLowerCase();
  if (!confirmEmail) {
    return NextResponse.json({ error: 'confirm_email_required' }, { status: 400 });
  }

  const db = admin();

  // 3. Resolve target profile
  const { data: target } = await db
    .from('profiles')
    .select('id, email')
    .eq('id', targetId)
    .maybeSingle();

  if (!target) {
    // maybe the profile is gone but auth.users row remains — allow purge by id only
    const { data: { user: authUser }, error: authErr } = await db.auth.admin.getUserById(targetId);
    if (authErr || !authUser) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    if ((authUser.email ?? '').toLowerCase() !== confirmEmail) {
      return NextResponse.json({ error: 'confirm_email_mismatch', expected_email_hint: maskEmail(authUser.email) }, { status: 400 });
    }
  } else {
    if ((target.email ?? '').toLowerCase() !== confirmEmail) {
      return NextResponse.json({ error: 'confirm_email_mismatch', expected_email_hint: maskEmail(target.email) }, { status: 400 });
    }
  }

  // 4. Discover related ids
  const { data: masterRow } = await db
    .from('masters')
    .select('id')
    .eq('profile_id', targetId)
    .maybeSingle();
  const masterId = masterRow?.id ?? null;

  const { data: salonRows } = await db
    .from('salons')
    .select('id')
    .eq('owner_id', targetId);
  const salonIds = (salonRows ?? []).map((r) => r.id as string);

  const { data: clientRows } = await db
    .from('clients')
    .select('id')
    .or(masterId ? `profile_id.eq.${targetId},master_id.eq.${masterId}` : `profile_id.eq.${targetId}`);
  const clientIds = (clientRows ?? []).map((r) => r.id as string);

  const log: Record<string, number | string> = {};

  // 5. Delete in dependency order. Each table is wrapped — failures don't abort
  //    the purge (we want a best-effort sweep, finishing with auth.users).
  //    Возвращаем deleted-rows из delete().select('id') чтобы посчитать.
  async function nuke(table: string, filter: (q: ReturnType<typeof db.from>) => ReturnType<ReturnType<typeof db.from>['delete']>) {
    try {
      const { data, error } = await filter(db.from(table)).select('id');
      if (error) {
        log[table] = `error: ${error.message}`;
        return;
      }
      log[table] = (data as unknown as unknown[] | null)?.length ?? 0;
    } catch (e) {
      log[table] = `exception: ${(e as Error).message}`;
    }
  }

  // appointments — клиент или мастер
  await nuke('appointments', (q) => {
    let qq = q.delete();
    if (masterId) qq = qq.or(`master_id.eq.${masterId},client_id.in.(${clientIds.join(',')})`);
    else if (clientIds.length) qq = qq.in('client_id', clientIds);
    else qq = qq.eq('id', '00000000-0000-0000-0000-000000000000'); // no-op
    return qq;
  });

  // master-side data (only if master)
  if (masterId) {
    await nuke('inventory_usage', (q) => q.delete().in('item_id', []).or(`appointment_id.is.null`)); // safe noop; cascade from appointments
    await nuke('inventory_items', (q) => q.delete().eq('master_id', masterId));
    await nuke('service_materials', (q) => q.delete().eq('master_id', masterId));
    await nuke('material_transactions', (q) => q.delete().eq('master_id', masterId));
    await nuke('supplier_orders', (q) => q.delete().eq('master_id', masterId));
    await nuke('suppliers', (q) => q.delete().eq('master_id', masterId));
    await nuke('services', (q) => q.delete().eq('master_id', masterId));
    await nuke('service_categories', (q) => q.delete().eq('master_id', masterId));
    await nuke('promo_codes', (q) => q.delete().eq('master_id', masterId));
    await nuke('expenses', (q) => q.delete().eq('master_id', masterId));
    await nuke('manual_incomes', (q) => q.delete().eq('master_id', masterId));
    await nuke('recurring_expenses', (q) => q.delete().eq('master_id', masterId));
    await nuke('master_broadcasts', (q) => q.delete().eq('master_id', masterId));
    await nuke('master_portfolio', (q) => q.delete().eq('master_id', masterId));
    await nuke('master_stories', (q) => q.delete().eq('master_id', masterId));
    await nuke('reviews', (q) => q.delete().eq('master_id', masterId));
    await nuke('referrals', (q) => q.delete().or(`referrer_master_id.eq.${masterId},referee_master_id.eq.${masterId}`));
    await nuke('loyalty_balances', (q) => q.delete().eq('master_id', masterId));
    await nuke('loyalty_transactions', (q) => q.delete().eq('master_id', masterId));
    await nuke('block_time_templates', (q) => q.delete().eq('master_id', masterId));
    await nuke('waitlist', (q) => q.delete().eq('master_id', masterId));
    await nuke('master_automation_settings', (q) => q.delete().eq('master_id', masterId));
    await nuke('message_templates', (q) => q.delete().eq('master_id', masterId));
    await nuke('master_partnerships', (q) => q.delete().or(`master_a_id.eq.${masterId},master_b_id.eq.${masterId}`));
    await nuke('client_master_links', (q) => q.delete().eq('master_id', masterId));
    await nuke('client_favorites', (q) => q.delete().eq('master_id', masterId));
    await nuke('master_likes', (q) => q.delete().eq('master_id', masterId));
    await nuke('clients', (q) => q.delete().eq('master_id', masterId));
    await nuke('masters', (q) => q.delete().eq('id', masterId));
  }

  // salon-side
  for (const sid of salonIds) {
    await nuke('salon_members', (q) => q.delete().eq('salon_id', sid));
    await nuke('master_team_invites', (q) => q.delete().eq('salon_id', sid));
    await nuke('salons', (q) => q.delete().eq('id', sid));
  }

  // generic per-profile
  await nuke('subscriptions', (q) => q.delete().eq('profile_id', targetId));
  await nuke('notifications', (q) => q.delete().eq('profile_id', targetId));
  await nuke('notification_preferences', (q) => q.delete().eq('profile_id', targetId));
  await nuke('web_push_subscriptions', (q) => q.delete().eq('profile_id', targetId));
  await nuke('telegram_link_tokens', (q) => q.delete().eq('profile_id', targetId));
  await nuke('telegram_sessions', (q) => q.delete().eq('profile_id', targetId));
  await nuke('feedback', (q) => q.delete().eq('profile_id', targetId));
  await nuke('client_files', (q) => q.delete().eq('profile_id', targetId));
  await nuke('voice_notes', (q) => q.delete().eq('profile_id', targetId));
  await nuke('master_broadcast_deliveries', (q) => q.delete().eq('profile_id', targetId));
  await nuke('follows', (q) => q.delete().or(`follower_id.eq.${targetId},followee_id.eq.${targetId}`));
  await nuke('clients', (q) => q.delete().eq('profile_id', targetId)); // client-side links
  await nuke('feed_posts', (q) => q.delete().eq('profile_id', targetId));
  await nuke('superadmin_whitelist', (q) => q.delete().eq('profile_id', targetId));
  await nuke('superadmin_blacklist', (q) => q.delete().eq('profile_id', targetId));
  await nuke('beta_signups', (q) => q.delete().eq('profile_id', targetId));
  await nuke('master_tasks', (q) => q.delete().eq('profile_id', targetId));

  // profile last (FK from many; rest cascade or already deleted)
  await nuke('profiles', (q) => q.delete().eq('id', targetId));

  // 6. auth.users — самое последнее. Удалит все остатки через ON DELETE CASCADE
  //    на FK со ссылкой на auth.users.
  const { error: authErr } = await db.auth.admin.deleteUser(targetId);
  if (authErr) {
    return NextResponse.json({
      ok: false,
      stage: 'auth_delete',
      error: authErr.message,
      log,
      hint: 'Часть таблиц подчищена, но auth.users удалить не удалось. Проверь логи.',
    }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    purged_id: targetId,
    purged_email: confirmEmail,
    actor: actor.email,
    log,
  });
}

function maskEmail(email: string | null | undefined): string {
  if (!email) return '—';
  const [name, domain] = email.split('@');
  if (!domain) return email;
  return `${name.slice(0, 2)}***@${domain}`;
}
