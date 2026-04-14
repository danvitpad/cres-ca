/** --- YAML
 * name: CreateBusinessApi
 * description: Создаёт бизнес (masters row для solo / salons+masters для team) с вертикалью и bulk-insert выбранных услуг. Используется мастером в конце /onboarding/create-business wizard.
 * created: 2026-04-13
 * updated: 2026-04-13
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { DefaultService } from '@/lib/verticals/default-services';

interface Payload {
  name: string;
  vertical: string | null;
  teamType: 'solo' | 'team';
  categories: string[];
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  city: string | null;
  services: DefaultService[];
  avatarUrl: string | null;
  coverUrl: string | null;
  specialization: string | null;
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await req.json()) as Payload;
  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'name_required' }, { status: 400 });
  }

  let masterId: string | null = null;
  let salonId: string | null = null;

  if (body.teamType === 'team') {
    const { data: salon, error: salonErr } = await supabase
      .from('salons')
      .insert({
        owner_id: user.id,
        name: body.name,
        address: body.address,
        latitude: body.latitude,
        longitude: body.longitude,
        city: body.city,
        vertical: body.vertical,
      })
      .select('id')
      .single();

    if (salonErr || !salon) {
      return NextResponse.json({ error: salonErr?.message ?? 'salon_insert_failed' }, { status: 500 });
    }
    salonId = salon.id;
  }

  if (body.avatarUrl) {
    await supabase.from('profiles').update({ avatar_url: body.avatarUrl }).eq('id', user.id);
  }

  const masterPayload = {
    profile_id: user.id,
    salon_id: salonId,
    display_name: body.name,
    specialization: body.specialization ?? body.categories[0] ?? null,
    address: body.address,
    latitude: body.latitude,
    longitude: body.longitude,
    city: body.city,
    vertical: body.vertical,
    avatar_url: body.avatarUrl,
    cover_url: body.coverUrl,
    is_active: true,
  };

  const { data: existing } = await supabase
    .from('masters')
    .select('id, invite_code')
    .eq('profile_id', user.id)
    .maybeSingle();

  let inviteCode: string | null = null;

  if (existing) {
    const { data: updated, error: updErr } = await supabase
      .from('masters')
      .update(masterPayload)
      .eq('id', existing.id)
      .select('id, invite_code')
      .single();
    if (updErr || !updated) {
      return NextResponse.json({ error: updErr?.message ?? 'master_update_failed' }, { status: 500 });
    }
    masterId = updated.id;
    inviteCode = updated.invite_code;
  } else {
    const { data: master, error: insErr } = await supabase
      .from('masters')
      .insert(masterPayload)
      .select('id, invite_code')
      .single();
    if (insErr || !master) {
      return NextResponse.json({ error: insErr?.message ?? 'master_insert_failed' }, { status: 500 });
    }
    masterId = master.id;
    inviteCode = master.invite_code;
  }

  if (body.services && body.services.length > 0 && masterId) {
    const rows = body.services.map((s) => ({
      master_id: masterId,
      salon_id: salonId,
      name: s.name,
      duration_minutes: s.duration_minutes,
      price: s.price,
      currency: 'UAH',
      is_active: true,
    }));
    const { error: svcErr } = await supabase.from('services').insert(rows);
    if (svcErr) {
      return NextResponse.json({ error: svcErr.message, masterId, salonId }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, masterId, salonId, inviteCode });
}
