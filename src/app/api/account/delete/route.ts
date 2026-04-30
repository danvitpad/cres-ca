/** --- YAML
 * name: Delete Account API
 * description: Phase 2.6 — soft-delete. Marks profiles.deleted_at and signs out. A 30-day cron (api/cron/account-purge) performs the hard delete. User can restore by logging in within 30 days.
 * created: 2026-04-17
 * updated: 2026-04-19
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { confirmation, password } = body as { confirmation?: string; password?: string };
    if (confirmation !== 'УДАЛИТЬ') {
      return NextResponse.json({ error: 'Введите "УДАЛИТЬ" для подтверждения' }, { status: 400 });
    }
    if (!password) {
      return NextResponse.json({ error: 'Введите текущий пароль' }, { status: 400 });
    }

    // Re-verify password by attempting a sign-in with the same credentials.
    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const verify = await admin.auth.signInWithPassword({ email: user.email!, password });
    if (verify.error) {
      return NextResponse.json({ error: 'Неверный пароль' }, { status: 403 });
    }

    // Soft-delete: set deleted_at. Cron /api/cron/account-purge hard-deletes after 30 days.
    const deletedAt = new Date();
    const { error: softErr } = await admin
      .from('profiles')
      .update({ deleted_at: deletedAt.toISOString() })
      .eq('id', user.id);
    if (softErr) {
      console.error('[delete-account] soft-delete failed:', softErr);
      return NextResponse.json({ error: softErr.message }, { status: 500 });
    }

    // Уведомление пользователю: «через 30 дней — стираем безвозвратно».
    try {
      const { notifyUser } = await import('@/lib/notifications/notify');
      const purgeDate = new Date(deletedAt.getTime() + 30 * 24 * 60 * 60 * 1000);
      const purgeDateStr = purgeDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
      await notifyUser(admin, {
        profileId: user.id,
        title: 'Запрос на удаление аккаунта принят',
        body: `Учётная запись будет удалена ${purgeDateStr}. Восстановление доступно в течение 30 дней: выполните вход под этим адресом электронной почты и подтвердите восстановление. По истечении срока данные удаляются без возможности восстановления.`,
        data: { type: 'account_deletion_requested', purge_at: purgeDate.toISOString() },
      });
    } catch (e) {
      console.error('[delete-account] notify failed (non-fatal):', e);
    }

    // Уведомить клиентов с будущими записями: мастер уходит.
    try {
      const { data: master } = await admin
        .from('masters')
        .select('id, display_name')
        .eq('profile_id', user.id)
        .maybeSingle();
      if (master) {
        const { data: futureApts } = await admin
          .from('appointments')
          .select('id, client_id, profile_id')
          .eq('master_id', master.id)
          .gte('starts_at', deletedAt.toISOString())
          .in('status', ['booked', 'confirmed']);
        const masterName = (master as { display_name?: string | null }).display_name ?? 'Мастер';
        const { notifyUser } = await import('@/lib/notifications/notify');
        for (const apt of (futureApts ?? []) as Array<{ id: string; client_id: string | null; profile_id: string | null }>) {
          const targetProfileId = apt.profile_id;
          if (!targetProfileId) continue;
          await notifyUser(admin, {
            profileId: targetProfileId,
            title: 'Изменение статуса записи',
            body: `Специалист ${masterName} приостановил приём. Возможна отмена ранее подтверждённой записи. Рекомендуем связаться со специалистом для уточнения деталей.`,
            data: { type: 'master_unavailable', appointment_id: apt.id },
          });
        }
      }
    } catch (e) {
      console.error('[delete-account] notify clients failed (non-fatal):', e);
    }

    await supabase.auth.signOut();
    return NextResponse.json({ ok: true, deleted_at: deletedAt.toISOString() });
  } catch (err) {
    console.error('[delete-account] error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
