/** --- YAML
 * name: Telegram Client Waitlist API
 * description: POST — client joins waitlist when no free slots available.
 *              Auth via resolveUserId (cookie OR X-TG-Init-Data header).
 *              Idempotent: returns existing entry if already waiting.
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

export async function POST(request: Request) {
  const userId = await resolveUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const body = await request.json().catch(() => null) as {
    master_id?: string;
    service_id?: string | null;
  } | null;

  if (!body?.master_id) {
    return NextResponse.json({ error: 'missing_master_id' }, { status: 400 });
  }

  const adm = admin();

  // Idempotent — one active entry per (client, master)
  const { data: existing } = await adm
    .from('waitlist')
    .select('id')
    .eq('client_profile_id', userId)
    .eq('master_id', body.master_id)
    .eq('status', 'waiting')
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ ok: true, id: (existing as { id: string }).id, already: true });
  }

  const { data, error } = await adm
    .from('waitlist')
    .insert({
      client_profile_id: userId,
      master_id: body.master_id,
      service_id: body.service_id ?? null,
    })
    .select('id')
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: (data as { id: string } | null)?.id ?? null });
}
