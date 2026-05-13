/** --- YAML
 * name: Mini App — Partner Invite
 * description: Отправка приглашения в партнёры другому мастеру. Auth через initData.
 *              Создаёт master_partnerships со status=pending + TG-уведомление.
 * created: 2026-05-13
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { resolveUserId } from '@/lib/auth/resolve-user';
import { notifyUser } from '@/lib/notifications/notify';

export async function POST(req: Request) {
  const userId = await resolveUserId(req);
  if (!userId) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const body = await req.json().catch(() => null) as { partner_id?: string; note?: string } | null;
  if (!body?.partner_id) return NextResponse.json({ error: 'partner_id required' }, { status: 400 });

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: me } = await admin
    .from('masters')
    .select('id, display_name, profile:profiles!masters_profile_id_fkey(full_name)')
    .eq('profile_id', userId)
    .maybeSingle();
  if (!me) return NextResponse.json({ error: 'not_master' }, { status: 403 });

  if (me.id === body.partner_id) {
    return NextResponse.json({ error: 'Cannot partner with yourself' }, { status: 400 });
  }

  const { data: target } = await admin
    .from('masters')
    .select('id, profile_id')
    .eq('id', body.partner_id)
    .maybeSingle<{ id: string; profile_id: string }>();
  if (!target) return NextResponse.json({ error: 'Master not found' }, { status: 404 });

  const { data: existing } = await admin
    .from('master_partnerships')
    .select('id, status')
    .or(`and(master_id.eq.${me.id},partner_id.eq.${body.partner_id}),and(master_id.eq.${body.partner_id},partner_id.eq.${me.id})`)
    .maybeSingle<{ id: string; status: string }>();

  if (existing) {
    return NextResponse.json({
      error: existing.status === 'active'
        ? 'Уже в партнёрстве'
        : existing.status === 'pending'
          ? 'Запрос уже отправлен'
          : 'Партнёрство ранее завершено',
    }, { status: 409 });
  }

  const { error } = await admin.from('master_partnerships').insert({
    master_id: me.id,
    partner_id: body.partner_id,
    status: 'pending',
    note: body.note?.trim() || null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (target.profile_id) {
    try {
      const meProfile = Array.isArray(me.profile) ? me.profile[0] : me.profile;
      const inviterName = (me.display_name ?? meProfile?.full_name ?? 'Мастер') as string;
      await notifyUser(admin, {
        profileId: target.profile_id,
        title: '🤝 Запрос в партнёры',
        body: `${inviterName} приглашает вас в партнёрство.${body.note?.trim() ? `\n«${body.note.trim()}»` : ''}\n\nПринять или отклонить — в разделе «Партнёры».`,
        data: { type: 'partner_invite', master_id: me.id },
        deepLinkPath: '/telegram/m/partners',
        deepLinkLabel: 'Открыть',
      });
    } catch { /* best-effort */ }
  }

  return NextResponse.json({ ok: true });
}
