/** --- YAML
 * name: Telegram Master Voice Booking Confirm API
 * description: Takes parsed voice-booking payload and creates (or reuses) client + appointment.
 * created: 2026-04-17
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { validateInitData } from '@/lib/telegram/validate-init-data';

export async function POST(request: Request) {
  const { initData, client_name, date, time, duration_min } = await request.json().catch(() => ({}));
  if (!initData || !client_name || !date || !time) {
    return NextResponse.json({ error: 'missing_params' }, { status: 400 });
  }

  const result = validateInitData(initData);
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 403 });

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: profile } = await admin.from('profiles').select('id').eq('telegram_id', result.user.id).maybeSingle();
  if (!profile) return NextResponse.json({ error: 'no_profile' }, { status: 403 });
  const { data: master } = await admin.from('masters').select('id, salon_id').eq('profile_id', profile.id).maybeSingle();
  if (!master) return NextResponse.json({ error: 'not_master' }, { status: 403 });

  let salonIdForAppt: string | null = null;
  if (master.salon_id) {
    const { data: salon } = await admin
      .from('salons')
      .select('id, team_mode')
      .eq('id', master.salon_id)
      .maybeSingle();
    if (salon && salon.team_mode === 'unified') salonIdForAppt = salon.id;
  }

  // Find or create client
  const { data: existing } = await admin
    .from('clients')
    .select('id')
    .eq('master_id', master.id)
    .ilike('full_name', `%${client_name}%`)
    .limit(1)
    .maybeSingle();

  let clientId = existing?.id as string | undefined;
  if (!clientId) {
    const { data: created, error: insErr } = await admin
      .from('clients')
      .insert({ master_id: master.id, full_name: client_name })
      .select('id')
      .single();
    if (insErr || !created) {
      return NextResponse.json({ error: insErr?.message ?? 'client_insert_failed' }, { status: 500 });
    }
    clientId = created.id;
  }

  const dur = duration_min ?? 60;
  const startsAt = new Date(`${date}T${time}:00`);
  const endsAt = new Date(startsAt.getTime() + dur * 60 * 1000);

  const { error: aptErr } = await admin.from('appointments').insert({
    master_id: master.id,
    salon_id: salonIdForAppt,
    client_id: clientId,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    status: 'booked',
    price: 0,
    currency: 'UAH',
    created_by_role: 'voice_ai',
  });

  if (aptErr) return NextResponse.json({ error: aptErr.message }, { status: 500 });
  return NextResponse.json({ ok: true, clientId });
}
