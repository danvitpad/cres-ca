/** --- YAML
 * name: Client Queue Check-in API
 * description: >
 *   POST /api/telegram/c/queue — client self-check-in to a master's live queue.
 *   Body: { master_id, name? } + X-TG-Init-Data header.
 *   GET /api/telegram/c/queue?master_id=X — returns client's position and queue info.
 *   Auth via X-TG-Init-Data (Telegram users only).
 * created: 2026-05-09
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { validateInitData } from '@/lib/telegram/validate-init-data';

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

type ValidatedTg = { user: { id: number; first_name: string; language_code?: string } };

function getInitData(req: Request): ValidatedTg | null {
  const raw = req.headers.get('x-tg-init-data');
  if (!raw) return null;
  const result = validateInitData(raw);
  if ('error' in result) return null;
  return result as unknown as ValidatedTg;
}

/** GET — client queue position */
export async function GET(req: Request) {
  const tg = getInitData(req);
  if (!tg) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const masterId = searchParams.get('master_id');
  if (!masterId) return NextResponse.json({ error: 'master_id required' }, { status: 400 });

  const adm = admin();

  // Check master queue_mode
  const { data: master } = await adm
    .from('masters')
    .select('queue_mode, display_name, profile:profiles!masters_profile_id_fkey(full_name)')
    .eq('id', masterId)
    .maybeSingle();

  if (!master) return NextResponse.json({ error: 'master_not_found' }, { status: 404 });

  const masterRow = master as unknown as {
    queue_mode: boolean;
    display_name: string | null;
    profile: { full_name: string | null } | null;
  };
  const masterName = masterRow.display_name ?? masterRow.profile?.full_name ?? '';

  if (!masterRow.queue_mode) {
    return NextResponse.json({ open: false, masterName });
  }

  // Find this client's active entry
  const { data: myEntry } = await adm
    .from('queue_entries')
    .select('id, position, status, joined_at')
    .eq('master_id', masterId)
    .eq('client_telegram_id', tg.user.id)
    .in('status', ['waiting', 'in_service'])
    .maybeSingle();

  // Count total waiting
  const { count } = await adm
    .from('queue_entries')
    .select('*', { count: 'exact', head: true })
    .eq('master_id', masterId)
    .eq('status', 'waiting');

  return NextResponse.json({
    open: true,
    masterName,
    myEntry: myEntry ?? null,
    totalWaiting: count ?? 0,
  });
}

/** POST — client self-check-in */
export async function POST(req: Request) {
  const tg = getInitData(req);
  if (!tg) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const body = await req.json().catch(() => null) as { master_id?: string; name?: string } | null;
  const masterId = body?.master_id;
  if (!masterId) return NextResponse.json({ error: 'master_id required' }, { status: 400 });

  const adm = admin();

  // Check queue_mode is on
  const { data: master } = await adm
    .from('masters')
    .select('id, queue_mode')
    .eq('id', masterId)
    .maybeSingle();

  if (!master || !(master as { queue_mode: boolean }).queue_mode) {
    return NextResponse.json({ error: 'queue_closed' }, { status: 409 });
  }

  // Check if already in queue
  const { data: existing } = await adm
    .from('queue_entries')
    .select('id, position')
    .eq('master_id', masterId)
    .eq('client_telegram_id', tg.user.id)
    .in('status', ['waiting', 'in_service'])
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ ok: true, entry: existing, alreadyQueued: true });
  }

  // Get max position
  const { data: maxRow } = await adm
    .from('queue_entries')
    .select('position')
    .eq('master_id', masterId)
    .in('status', ['waiting', 'in_service'])
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();

  const position = ((maxRow as { position?: number } | null)?.position ?? 0) + 1;
  const clientName = body?.name ?? tg.user.first_name ?? 'Клієнт';

  const { data: entry } = await adm
    .from('queue_entries')
    .insert({
      master_id: masterId,
      client_name: clientName,
      client_telegram_id: tg.user.id,
      position,
      status: 'waiting',
    })
    .select('id, position')
    .single();

  return NextResponse.json({ ok: true, entry, alreadyQueued: false });
}
