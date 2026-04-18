/** --- YAML
 * name: Telegram Client Notifications API
 * description: List + unread count + mark read. Validates initData.
 * created: 2026-04-17
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { validateInitData } from '@/lib/telegram/validate-init-data';

export async function POST(request: Request) {
  const { initData, mode, ids } = await request.json().catch(() => ({}));
  if (!initData) return NextResponse.json({ error: 'missing_init_data' }, { status: 400 });

  const result = validateInitData(initData);
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 403 });

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: profile } = await admin.from('profiles').select('id').eq('telegram_id', result.user.id).maybeSingle();
  if (!profile) return NextResponse.json({ unread: 0, notifications: [] });

  if (mode === 'mark_read') {
    const q = admin.from('notifications').update({ read_at: new Date().toISOString() }).eq('profile_id', profile.id);
    if (Array.isArray(ids) && ids.length > 0) {
      await q.in('id', ids);
    } else {
      await q.is('read_at', null);
    }
    return NextResponse.json({ ok: true });
  }

  const { data: notifications } = await admin
    .from('notifications')
    .select('id, title, body, channel, status, sent_at, created_at, read_at, data')
    .eq('profile_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(100);

  const unread = (notifications ?? []).filter((n) => !n.read_at).length;
  return NextResponse.json({ unread, notifications: notifications ?? [] });
}
