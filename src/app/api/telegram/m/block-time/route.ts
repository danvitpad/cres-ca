/** --- YAML
 * name: Telegram Master block-time API
 * description: GET returns master's block_time_templates. POST creates a
 *              `blocked_times` row. DELETE removes it.
 *              Auth via resolveUserId (cookie OR initData). Validates that
 *              the requester owns the master.
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

export async function GET(request: Request) {
  const userId = await resolveUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  const adm = admin();
  const { data: master } = await adm
    .from('masters')
    .select('id')
    .eq('profile_id', userId)
    .maybeSingle();
  if (!master?.id) {
    return NextResponse.json({ templates: [] });
  }
  const { data } = await adm
    .from('block_time_templates')
    .select('id, title, duration_minutes')
    .eq('master_id', master.id)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  return NextResponse.json({ templates: data ?? [] });
}

interface CreateBody {
  starts_at?: string;
  ends_at?: string;
  reason?: string | null;
}

export async function POST(request: Request) {
  const userId = await resolveUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as CreateBody | null;
  if (!body?.starts_at || !body?.ends_at) {
    return NextResponse.json({ error: 'missing_dates' }, { status: 400 });
  }

  const start = new Date(body.starts_at);
  const end = new Date(body.ends_at);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return NextResponse.json({ error: 'invalid_dates' }, { status: 400 });
  }
  if (end.getTime() <= start.getTime()) {
    return NextResponse.json({ error: 'end_before_start' }, { status: 400 });
  }

  const adm = admin();
  const { data: master } = await adm
    .from('masters')
    .select('id')
    .eq('profile_id', userId)
    .maybeSingle();
  if (!master?.id) {
    return NextResponse.json({ error: 'no_master' }, { status: 403 });
  }

  const { data, error } = await adm
    .from('blocked_times')
    .insert({
      master_id: master.id,
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      reason: body.reason?.trim() || null,
    })
    .select('id')
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id: data?.id ?? null });
}

interface DeleteBody {
  id?: string;
}

export async function DELETE(request: Request) {
  const userId = await resolveUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as DeleteBody | null;
  if (!body?.id) {
    return NextResponse.json({ error: 'missing_id' }, { status: 400 });
  }

  const adm = admin();
  const { data: master } = await adm
    .from('masters')
    .select('id')
    .eq('profile_id', userId)
    .maybeSingle();
  if (!master?.id) {
    return NextResponse.json({ error: 'no_master' }, { status: 403 });
  }

  const { error } = await adm
    .from('blocked_times')
    .delete()
    .eq('id', body.id)
    .eq('master_id', master.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
