/** --- YAML
 * name: ClientRisk
 * description: >
 *   GET /api/telegram/m/client-risk?client_id=X — returns no-show risk score
 *   (low/medium/high/null) for a client based on their appointment history
 *   with the requesting master. Auth via X-TG-Init-Data or cookie session.
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

export async function GET(req: Request) {
  const userId = await resolveUserId(req);
  if (!userId) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const adm = admin();
  const { data: master } = await adm
    .from('masters')
    .select('id')
    .eq('profile_id', userId)
    .maybeSingle();
  if (!master?.id) return NextResponse.json({ risk: null });

  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get('client_id');
  if (!clientId) return NextResponse.json({ error: 'client_id required' }, { status: 400 });

  const { data: rows } = await adm
    .from('appointments')
    .select('status')
    .eq('master_id', master.id)
    .eq('client_id', clientId)
    .in('status', ['completed', 'no_show', 'cancelled', 'cancelled_by_client'])
    .order('starts_at', { ascending: false })
    .limit(30);

  if (!rows || rows.length < 3) {
    return NextResponse.json({ risk: null });
  }

  const total = rows.length;
  const noShows = rows.filter((r) => r.status === 'no_show').length;
  const cancels = rows.filter((r) => r.status === 'cancelled' || r.status === 'cancelled_by_client').length;

  const noShowRate = noShows / total;
  const cancelRate = cancels / total;

  let risk: 'low' | 'medium' | 'high';
  if (noShowRate > 0.3 || cancelRate > 0.5) {
    risk = 'high';
  } else if (noShowRate > 0.15 || cancelRate > 0.3) {
    risk = 'medium';
  } else {
    risk = 'low';
  }

  return NextResponse.json({ risk });
}
