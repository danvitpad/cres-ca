/** --- YAML
 * name: Partner Invite API
 * description: Send partnership invite to another master by master_id (found via /api/partners/search).
 * created: 2026-04-17
 * updated: 2026-04-17
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdmin } from '@supabase/supabase-js';
import { notifyUser } from '@/lib/notifications/notify';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { partner_id, note } = await request.json() as { partner_id?: string; note?: string };
  if (!partner_id) return NextResponse.json({ error: 'partner_id required' }, { status: 400 });

  const { data: me } = await supabase.from('masters').select('id, display_name, profile:profiles!masters_profile_id_fkey(full_name)').eq('profile_id', user.id).maybeSingle();
  if (!me) return NextResponse.json({ error: 'Profile not set up' }, { status: 403 });

  if (me.id === partner_id) {
    return NextResponse.json({ error: 'Cannot partner with yourself' }, { status: 400 });
  }

  // Check target exists
  const { data: target } = await supabase.from('masters').select('id, profile_id').eq('id', partner_id).maybeSingle();
  if (!target) return NextResponse.json({ error: 'Master not found' }, { status: 404 });

  // Does a partnership already exist (either direction)?
  const { data: existing } = await supabase
    .from('master_partnerships')
    .select('id, status, master_id')
    .or(`and(master_id.eq.${me.id},partner_id.eq.${partner_id}),and(master_id.eq.${partner_id},partner_id.eq.${me.id})`)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({
      error: existing.status === 'active'
        ? 'Уже в партнёрстве'
        : existing.status === 'pending'
          ? 'Запрос уже отправлен'
          : 'Партнёрство ранее завершено',
    }, { status: 409 });
  }

  const { error } = await supabase.from('master_partnerships').insert({
    master_id: me.id,
    partner_id,
    status: 'pending',
    note: note?.trim() || null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // TG-уведомление приглашаемому мастеру (best-effort, через service-role чтобы
  // обойти RLS на profiles при чтении telegram_id чужого пользователя).
  if (target.profile_id) {
    try {
      const admin = createAdmin(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
      );
      const inviterProfile = Array.isArray(me.profile) ? me.profile[0] : me.profile;
      const inviterName = me.display_name ?? inviterProfile?.full_name ?? 'Мастер';
      await notifyUser(admin, {
        profileId: target.profile_id,
        title: '🤝 Запрос в партнёры',
        body: `${inviterName} приглашает вас в партнёрство.${note?.trim() ? `\n«${note.trim()}»` : ''}\n\nПринять или отклонить — в разделе «Партнёры».`,
        data: { type: 'partner_invite', master_id: me.id },
        deepLinkPath: '/telegram/m/clients?tab=partners',
        deepLinkLabel: 'Открыть',
      });
    } catch { /* best-effort */ }
  }

  return NextResponse.json({ ok: true });
}
