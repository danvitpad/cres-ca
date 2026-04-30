/** --- YAML
 * name: Leave Team (Web)
 * description: POST {salonId, keepWithSalon} → master leaves the salon team.
 *              keepWithSalon=true: future appointments cancelled, clients
 *                notified to rebook with another team master.
 *              keepWithSalon=false (default): appointments go with master
 *                into his solo calendar.
 *              Calls leave_salon_for RPC. Notifies salon owner.
 * created: 2026-04-30
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

const ERROR_LABELS: Record<string, string> = {
  not_a_member: 'Вы уже не в этой команде.',
  admin_cannot_leave_use_transfer_or_close: 'Админ команды не может просто выйти. Передайте роль другому или закройте команду.',
  owner_cannot_leave_use_transfer_or_close: 'Владелец команды не может выйти. Передайте команду другому или закройте её.',
  master_profile_not_found: 'Профиль мастера не найден.',
};

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { salonId?: string; keepWithSalon?: boolean };
  const salonId = body.salonId?.trim();
  if (!salonId) return NextResponse.json({ error: 'invalid_salon' }, { status: 400 });

  const adm = admin();
  const { data: profile } = await adm.from('profiles').select('id, full_name').eq('id', user.id).maybeSingle();
  if (!profile) return NextResponse.json({ error: 'no_profile' }, { status: 404 });

  const { data: rpcData, error: rpcError } = await adm.rpc('leave_salon_for', {
    p_profile_id: profile.id,
    p_salon_id: salonId,
    p_keep_with_salon: body.keepWithSalon === true,
  });

  if (rpcError) {
    const code = rpcError.message.match(/^(\w+)/)?.[1] ?? 'leave_failed';
    const label = ERROR_LABELS[code] ?? rpcError.message;
    return NextResponse.json({ error: code, message: label }, { status: 400 });
  }

  type LeaveResult = {
    salon_name: string | null;
    salon_owner_id: string | null;
    moved_appointments?: number;
    cancelled_appointments?: number;
    mode: 'taken_with_master' | 'kept_with_salon';
  };
  const result = rpcData as LeaveResult;

  if (result.salon_owner_id) {
    const masterName = (profile as { full_name?: string | null }).full_name ?? 'Мастер';
    const apsLine = result.mode === 'kept_with_salon'
      ? `Будущие записи отменены (${result.cancelled_appointments ?? 0}). Клиенты получили уведомление о выборе другого мастера.`
      : `Будущие записи (${result.moved_appointments ?? 0}) ушли с ним в соло-календарь.`;
    await notifyUser(adm, {
      profileId: result.salon_owner_id,
      title: `${masterName} вышел из команды`,
      body: `Команда «${result.salon_name ?? 'без названия'}». ${apsLine}`,
      data: { type: 'salon_member_left', salon_id: salonId, profile_id: profile.id, mode: result.mode },
      deepLinkPath: `/telegram/m/salon/${salonId}/team`,
      deepLinkLabel: 'Открыть команду',
    });
  }

  return NextResponse.json({
    ok: true,
    mode: result.mode,
    moved_appointments: result.moved_appointments ?? 0,
    cancelled_appointments: result.cancelled_appointments ?? 0,
  });
}
