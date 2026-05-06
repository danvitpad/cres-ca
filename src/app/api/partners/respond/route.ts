/** --- YAML
 * name: Partner Respond API
 * description: Accept or decline an incoming partnership invite. Optionally end an active partnership.
 * created: 2026-04-17
 * updated: 2026-04-17
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdmin } from '@supabase/supabase-js';
import { notifyUser } from '@/lib/notifications/notify';

async function notifyInitiator(initiatorMasterId: string, responderMasterId: string, accepted: boolean) {
  try {
    const admin = createAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    const { data: initiator } = await admin
      .from('masters').select('profile_id').eq('id', initiatorMasterId).maybeSingle();
    if (!initiator?.profile_id) return;
    const { data: responder } = await admin
      .from('masters')
      .select('display_name, profile:profiles!masters_profile_id_fkey(full_name)')
      .eq('id', responderMasterId).maybeSingle();
    const responderProfile = responder ? (Array.isArray(responder.profile) ? responder.profile[0] : responder.profile) : null;
    const responderName = responder?.display_name ?? responderProfile?.full_name ?? 'Мастер';
    await notifyUser(admin, {
      profileId: initiator.profile_id,
      title: accepted ? '✅ Партнёрство принято' : '❌ Партнёрство отклонено',
      body: accepted
        ? `${responderName} принял ваш запрос в партнёры. Теперь вы можете рекомендовать друг друга на публичных страницах.`
        : `${responderName} отклонил ваш запрос в партнёры.`,
      data: { type: 'partner_response', accepted, master_id: responderMasterId },
      deepLinkPath: '/telegram/m/clients?tab=partners',
      deepLinkLabel: 'Открыть',
    });
  } catch { /* best-effort */ }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, action } = await request.json() as {
    id?: string;
    action?: 'accept' | 'decline' | 'end' | 'withdraw';
  };
  if (!id || !action) return NextResponse.json({ error: 'id + action required' }, { status: 400 });

  const { data: me } = await supabase.from('masters').select('id').eq('profile_id', user.id).maybeSingle();
  if (!me) return NextResponse.json({ error: 'Profile not set up' }, { status: 403 });

  const { data: row } = await supabase
    .from('master_partnerships')
    .select('id, master_id, partner_id, status')
    .eq('id', id)
    .maybeSingle();
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const isTarget = row.partner_id === me.id;
  const isInitiator = row.master_id === me.id;
  if (!isTarget && !isInitiator) return NextResponse.json({ error: 'Not your partnership' }, { status: 403 });

  // accept / decline — only target (recipient) can
  if (action === 'accept') {
    if (!isTarget) return NextResponse.json({ error: 'Only recipient can accept' }, { status: 403 });
    if (row.status !== 'pending') return NextResponse.json({ error: 'Not pending' }, { status: 409 });
    await supabase.from('master_partnerships').update({
      status: 'active',
      accepted_at: new Date().toISOString(),
    }).eq('id', id);
    void notifyInitiator(row.master_id, me.id, true);
    return NextResponse.json({ ok: true, status: 'active' });
  }

  if (action === 'decline') {
    if (!isTarget) return NextResponse.json({ error: 'Only recipient can decline' }, { status: 403 });
    if (row.status !== 'pending') return NextResponse.json({ error: 'Not pending' }, { status: 409 });
    await supabase.from('master_partnerships').update({
      status: 'declined',
      ended_at: new Date().toISOString(),
    }).eq('id', id);
    void notifyInitiator(row.master_id, me.id, false);
    return NextResponse.json({ ok: true, status: 'declined' });
  }

  // withdraw — only initiator can, and only when pending
  if (action === 'withdraw') {
    if (!isInitiator) return NextResponse.json({ error: 'Only initiator can withdraw' }, { status: 403 });
    if (row.status !== 'pending') return NextResponse.json({ error: 'Not pending' }, { status: 409 });
    await supabase.from('master_partnerships').delete().eq('id', id);
    return NextResponse.json({ ok: true, status: 'withdrawn' });
  }

  // end — either side can end an active partnership
  if (action === 'end') {
    if (row.status !== 'active') return NextResponse.json({ error: 'Not active' }, { status: 409 });
    await supabase.from('master_partnerships').update({
      status: 'ended',
      ended_at: new Date().toISOString(),
    }).eq('id', id);
    return NextResponse.json({ ok: true, status: 'ended' });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
