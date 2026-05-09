/** --- YAML
 * name: Telegram Client Booking Draft API
 * description: >
 *   POST — upsert a draft record when client reaches the confirm step.
 *   PATCH — mark draft as converted after successful booking.
 *   Auth via resolveUserId (cookie OR X-TG-Init-Data header).
 * created: 2026-05-09
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { resolveUserId } from '@/lib/auth/resolve-user';

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

/** Upsert a booking draft (client reached confirm step but hasn't confirmed yet). */
export async function POST(request: Request) {
  const userId = await resolveUserId(request);
  if (!userId) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const body = await request.json().catch(() => null) as {
    master_id?: string;
    service_id?: string | null;
    slot_date?: string;
    slot_time?: string;
  } | null;

  if (!body?.master_id || !body?.slot_date || !body?.slot_time) {
    return NextResponse.json({ error: 'missing_params' }, { status: 400 });
  }

  const adm = admin();

  // Upsert: one active draft per (profile_id, master_id, slot_date, slot_time).
  // expires_at is reset to +2h so user gets a fresh window on each visit.
  const { data, error } = await adm
    .from('booking_drafts')
    .upsert(
      {
        profile_id: userId,
        master_id: body.master_id,
        service_id: body.service_id ?? null,
        slot_date: body.slot_date,
        slot_time: body.slot_time,
        expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'profile_id,master_id,slot_date,slot_time', ignoreDuplicates: false },
    )
    .select('id')
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, id: (data as { id: string } | null)?.id ?? null });
}

/** Mark all matching drafts as converted (called after successful booking). */
export async function PATCH(request: Request) {
  const userId = await resolveUserId(request);
  if (!userId) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const body = await request.json().catch(() => null) as {
    master_id?: string;
    slot_date?: string;
    slot_time?: string;
  } | null;

  if (!body?.master_id || !body?.slot_date || !body?.slot_time) {
    return NextResponse.json({ error: 'missing_params' }, { status: 400 });
  }

  const adm = admin();

  await adm
    .from('booking_drafts')
    .update({ converted_at: new Date().toISOString() })
    .eq('profile_id', userId)
    .eq('master_id', body.master_id)
    .eq('slot_date', body.slot_date)
    .eq('slot_time', body.slot_time)
    .is('converted_at', null);

  return NextResponse.json({ ok: true });
}
