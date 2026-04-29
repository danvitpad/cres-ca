/** --- YAML
 * name: Superadmin beta API — list/add
 * description: GET — список всех заявок (через view beta_invites_admin).
 *   POST — ручное добавление новой заявки сразу со статусом 'approved'
 *   (Данил вписывает email знакомого человека).
 * created: 2026-04-29
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { requireSuperadmin } from '@/lib/superadmin/auth';
import { logSuperadminAction } from '@/lib/superadmin/access';

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

async function guard(): Promise<{ profileId: string; email: string } | NextResponse> {
  try {
    return await requireSuperadmin();
  } catch (r) {
    if (r instanceof NextResponse) return r;
    if (r instanceof Response) return new NextResponse(r.body, { status: r.status });
    return new NextResponse('not found', { status: 404 });
  }
}

export async function GET() {
  const sa = await guard();
  if (sa instanceof NextResponse) return sa;

  const db = admin();
  const { data, error } = await db
    .from('beta_invites_admin')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(req: Request) {
  const sa = await guard();
  if (sa instanceof NextResponse) return sa;

  const body = (await req.json().catch(() => ({}))) as {
    email?: string;
    telegram_id?: number;
    full_name?: string;
    note?: string;
    auto_approve?: boolean;
  };

  const email = body.email?.trim().toLowerCase() || null;
  const tgId = typeof body.telegram_id === 'number' ? body.telegram_id : null;

  if (!email && !tgId) {
    return NextResponse.json({ error: 'email_or_tg_required' }, { status: 400 });
  }

  const db = admin();
  const status = body.auto_approve === false ? 'pending' : 'approved';
  const { data, error } = await db
    .from('beta_invites')
    .insert({
      email,
      telegram_id: tgId,
      full_name: body.full_name?.trim() || null,
      source: 'manual',
      status,
      approved_at: status === 'approved' ? new Date().toISOString() : null,
      approved_by: status === 'approved' ? sa.profileId : null,
      note: body.note?.trim() || null,
    })
    .select('id')
    .single();

  if (error) {
    // Дубликат по email или tg_id
    if (error.code === '23505') {
      return NextResponse.json({ error: 'already_exists' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logSuperadminAction(sa.profileId, 'beta_add', 'beta_invite', data?.id ?? null, {
    email,
    telegram_id: tgId,
    status,
  });

  return NextResponse.json({ ok: true, id: data?.id });
}
