/** --- YAML
 * name: Telegram Master Notifications API
 * description: Returns unread + recent notifications list. Supports mark_read, dismiss_id, dismiss_all actions. Validates initData.
 * created: 2026-04-17
 * updated: 2026-04-19
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { resolveUserId } from '@/lib/auth/resolve-user';

export async function POST(request: Request) {
  const { mark_read, dismiss_id, dismiss_all } = await request.json().catch(() => ({}));
  const userId = await resolveUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  // For backward compat with existing code below using `profile.id`
  const profile = { id: userId };

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
