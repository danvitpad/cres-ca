/** --- YAML
 * name: Telegram Master — Team membership API
 * description: GET-via-POST returns master's current team membership for Mini App
 *              profile screen. action='leave' calls leave_salon_for RPC and notifies
 *              salon owner. Owner/admin не может выйти этим путём — только обычный мастер.
 * created: 2026-04-29
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { validateInitData } from '@/lib/telegram/validate-init-data';
import { notifyUser } from '@/lib/notifications/notify';

interface Body {
  initData?: string;
  action?: 'status' | 'leave';
  salonId?: string;
}

const ERROR_LABELS: Record<string, string> = {
  not_a_member: 'Вы уже не в этой команде.',
  admin_cannot_leave_use_transfer_or_close:
    'Админ команды не может просто выйти. Передайте роль другому или закройте команду.',
  owner_cannot_leave_use_transfer_or_close:
    'Владелец команды не может выйти. Передайте команду другому владельцу или закройте её.',
  master_profile_not_found: 'Профиль мастера не найден.',
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Body;
  const initData = body.initData;
  const action = body.action ?? 'status';

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
    .select('id, full_name')
    .eq('telegram_id', tg.id)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ in_team: false });
  }

  if (action === 'status') {
    const { data: membership } = await admin
      .from('salon_members')
      .select(`
        role,
        joined_at,
        salon:salons!salon_members_salon_id_fkey(id, name, logo_url, owner_id)
      `)
      .eq('profile_id', profile.id)
      .eq('status', 'active')
      .order('joined_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    type SalonField = { id: string; name: string | null; logo_url: string | null; owner_id: string | null };
    type MemberRow = { role: string; joined_at: string | null; salon: SalonField | SalonField[] | null };
    const row = membership as MemberRow | null;
    if (!row || !row.salon) {
      return NextResponse.json({ in_team: false });
    }
    const salon = Array.isArray(row.salon) ? row.salon[0] : row.salon;
    if (!salon) return NextResponse.json({ in_team: false });

    return NextResponse.json({
      in_team: true,
      salon_id: salon.id,
      salon_name: salon.name,
      salon_logo_url: salon.logo_url,
      role: row.role,
      is_owner: salon.owner_id === profile.id,
      joined_at: row.joined_at,
    });
  }

  if (action === 'leave') {
    const salonId = body.salonId;
    if (!salonId) {
      return NextResponse.json({ error: 'missing_salon_id' }, { status: 400 });
    }

    const { data: rpcData, error: rpcError } = await admin.rpc('leave_salon_for', {
      p_profile_id: profile.id,
      p_salon_id: salonId,
    });

    if (rpcError) {
      const code = rpcError.message.match(/^(\w+)/)?.[1] ?? 'leave_failed';
      const label = ERROR_LABELS[code] ?? rpcError.message;
      return NextResponse.json({ error: code, message: label }, { status: 400 });
    }

    type LeaveResult = {
      ok: boolean;
      salon_name: string | null;
      salon_owner_id: string | null;
      moved_appointments: number;
    };
    const result = rpcData as LeaveResult;

    // Уведомляем владельца команды (best-effort).
    if (result.salon_owner_id) {
      const masterName = profile.full_name ?? tg.first_name ?? 'Мастер';
      await notifyUser(admin, {
        profileId: result.salon_owner_id,
        title: `${masterName} вышел из команды`,
        body: `Команда «${result.salon_name ?? 'без названия'}». Будущие записи мастера ушли в его соло-календарь (${result.moved_appointments}).`,
        data: { type: 'salon_member_left', salon_id: salonId, profile_id: profile.id },
        deepLinkPath: `/telegram/m/salon/${salonId}/team`,
        deepLinkLabel: 'Открыть команду',
      });
    }

    return NextResponse.json({
      ok: true,
      moved_appointments: result.moved_appointments,
    });
  }

  return NextResponse.json({ error: 'unknown_action' }, { status: 400 });
}
