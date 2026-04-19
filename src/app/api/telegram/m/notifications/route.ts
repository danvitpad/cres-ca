/** --- YAML
 * name: Telegram Master Notifications API
 * description: Returns unread + recent notifications list. Supports mark_read, dismiss_id, dismiss_all actions. Validates initData.
 * created: 2026-04-17
 * updated: 2026-04-19
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { validateInitData } from '@/lib/telegram/validate-init-data';

export async function POST(request: Request) {
  const { initData, mark_read, dismiss_id, dismiss_all } = await request.json().catch(() => ({}));
  if (!initData) {
    return NextResponse.json({ error: 'missing_init_data' }, { status: 400 });
  }

  const result = validateInitData(initData);
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 403 });
  }

  const tg = result.user;
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: profile } = await admin
    .from('profiles')
    .select('id')
    .eq('telegram_id', tg.id)
    .maybeSingle();
  if (!profile) {
    return NextResponse.json({ unread: 0, notifications: [] });
  }

  const now = new Date().toISOString();

  if (dismiss_id && typeof dismiss_id === 'string') {
    await admin
      .from('notifications')
      .update({ dismissed_at: now })
      .eq('id', dismiss_id)
      .eq('profile_id', profile.id);
  }

  if (dismiss_all) {
    await admin
      .from('notifications')
      .update({ dismissed_at: now })
      .eq('profile_id', profile.id)
      .is('dismissed_at', null);
  }

  if (mark_read) {
    await admin
      .from('notifications')
      .update({ read_at: now })
      .eq('profile_id', profile.id)
      .is('read_at', null);
  }

  const { data: notifications } = await admin
    .from('notifications')
    .select('id, title, body, channel, status, created_at, read_at, dismissed_at, data')
    .eq('profile_id', profile.id)
    .is('dismissed_at', null)
    .order('created_at', { ascending: false })
    .limit(50);

  const unread = (notifications ?? []).filter((n) => !n.read_at).length;

  return NextResponse.json({ unread, notifications: notifications ?? [] });
}
