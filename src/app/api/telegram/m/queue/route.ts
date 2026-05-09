/** --- YAML
 * name: Master Queue API
 * description: >
 *   GET /api/telegram/m/queue — list active queue entries for master.
 *   PATCH /api/telegram/m/queue?id=X&action=start|complete|skip —
 *         update a queue entry status (start sends TG push to client).
 *   POST /api/telegram/m/queue — toggle queue_mode on/off for master.
 *   Auth via X-TG-Init-Data or cookie session.
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

async function getMaster(userId: string) {
  const adm = admin();
  const { data } = await adm
    .from('masters')
    .select('id, queue_mode')
    .eq('profile_id', userId)
    .maybeSingle();
  return data as { id: string; queue_mode: boolean } | null;
}

/** GET — list active queue + queue_mode state */
export async function GET(req: Request) {
  const userId = await resolveUserId(req);
  if (!userId) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const master = await getMaster(userId);
  if (!master) return NextResponse.json({ queue: [], queueMode: false, masterId: null });

  const adm = admin();
  const { data } = await adm
    .from('queue_entries')
    .select('id, client_name, position, status, joined_at, started_at, service:services(name)')
    .eq('master_id', master.id)
    .in('status', ['waiting', 'in_service'])
    .order('position', { ascending: true });

  return NextResponse.json({ queue: data ?? [], queueMode: master.queue_mode, masterId: master.id });
}

/** POST — toggle queue_mode */
export async function POST(req: Request) {
  const userId = await resolveUserId(req);
  if (!userId) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const master = await getMaster(userId);
  if (!master) return NextResponse.json({ error: 'master_not_found' }, { status: 404 });

  const adm = admin();
  const newMode = !master.queue_mode;
  await adm.from('masters').update({ queue_mode: newMode }).eq('id', master.id);

  return NextResponse.json({ queueMode: newMode });
}

/** PATCH — update queue entry status */
export async function PATCH(req: Request) {
  const userId = await resolveUserId(req);
  if (!userId) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const master = await getMaster(userId);
  if (!master) return NextResponse.json({ error: 'master_not_found' }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const entryId = searchParams.get('id');
  const action = searchParams.get('action') as 'start' | 'complete' | 'skip' | null;
  if (!entryId || !action) return NextResponse.json({ error: 'missing_params' }, { status: 400 });

  const adm = admin();

  // Verify ownership
  const { data: entry } = await adm
    .from('queue_entries')
    .select('id, client_name, status')
    .eq('id', entryId)
    .eq('master_id', master.id)
    .maybeSingle();
  if (!entry) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const now = new Date().toISOString();
  let update: Record<string, unknown> = {};

  if (action === 'start') {
    update = { status: 'in_service', started_at: now };
  } else if (action === 'complete') {
    update = { status: 'completed', completed_at: now };
  } else if (action === 'skip') {
    update = { status: 'no_show' };
  }

  await adm.from('queue_entries').update(update).eq('id', entryId);

  // If starting — try to send TG push to the client
  if (action === 'start') {
    const { data: queueEntry } = await adm
      .from('queue_entries')
      .select('client_telegram_id')
      .eq('id', entryId)
      .maybeSingle();

    const tgId = (queueEntry as unknown as { client_telegram_id?: number | null })?.client_telegram_id;
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (tgId && botToken) {
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: tgId,
          parse_mode: 'HTML',
          text: '🟢 <b>Ваша черга!</b>\n\nМайстер готовий прийняти вас прямо зараз.',
        }),
      }).catch(() => null);
    }
  }

  return NextResponse.json({ ok: true });
}
