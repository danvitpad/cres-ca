/** --- YAML
 * name: Universal Follow Toggle
 * description: POST {targetId} → toggles follow in universal follows table. Sends notifications, detects mutual.
 * created: 2026-04-14
 * updated: 2026-04-16
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { notifyUser } from '@/lib/notifications/notify';

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { targetId?: string };
  const targetId = body.targetId?.trim();
  if (!targetId) return NextResponse.json({ error: 'invalid_target' }, { status: 400 });
  if (targetId === user.id) return NextResponse.json({ error: 'cannot_follow_self' }, { status: 400 });

  const { data: existing } = await supabase
    .from('follows')
    .select('follower_id')
    .eq('follower_id', user.id)
    .eq('following_id', targetId)
    .maybeSingle();

  if (existing) {
    // Unfollow
    await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', targetId);
    return NextResponse.json({ following: false, mutual: false });
  }

  // Follow
  const { error } = await supabase.from('follows').insert({ follower_id: user.id, following_id: targetId });
  if (error) return NextResponse.json({ error: 'insert_failed', detail: error.message }, { status: 500 });

  // Check if mutual (reverse row exists)
  const { data: reverse } = await supabase
    .from('follows')
    .select('follower_id')
    .eq('follower_id', targetId)
    .eq('following_id', user.id)
    .maybeSingle();

  const mutual = !!reverse;

  // Get names for notification
  const [{ data: myProfile }, { data: targetProfile }] = await Promise.all([
    supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle(),
    supabase.from('profiles').select('full_name').eq('id', targetId).maybeSingle(),
  ]);

  const myName = myProfile?.full_name || 'Пользователь';
  const adm = admin();

  // Notify target about new follower (in-app + TG)
  await notifyUser(adm, {
    profileId: targetId,
    title: 'Новый подписчик',
    body: `${myName} подписался на вас`,
    data: { type: 'new_follower', follower_profile_id: user.id },
    deepLinkPath: '/telegram/m/clients',
    deepLinkLabel: 'Открыть',
  });

  // If mutual — notify the new follower too
  if (mutual) {
    const targetName = targetProfile?.full_name || 'Пользователь';
    await notifyUser(adm, {
      profileId: user.id,
      title: 'Взаимная подписка',
      body: `${targetName} тоже подписан на вас`,
      data: { type: 'mutual_follow', profile_id: targetId },
      deepLinkPath: '/telegram/app/connections',
      deepLinkLabel: 'Открыть',
    });
  }

  return NextResponse.json({ following: true, mutual });
}
