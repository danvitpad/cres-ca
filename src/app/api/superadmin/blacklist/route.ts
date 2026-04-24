/** --- YAML
 * name: Superadmin blacklist API
 * description: POST (ban) / DELETE (unban) for platform_blacklist. Ban also cancels subscription + removes whitelist. All actions audit-logged. 404s for non-superadmin.
 * created: 2026-04-21
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

interface AddBody {
  profile_id: string;
  reason?: string | null;
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

export async function POST(req: Request) {
  const sa = await guard();
  if (sa instanceof NextResponse) return sa;

  const body = (await req.json().catch(() => null)) as AddBody | null;
  if (!body?.profile_id) return NextResponse.json({ error: 'bad_request' }, { status: 400 });

  // Defensive: never let a superadmin ban themself.
  if (body.profile_id === sa.profileId) {
    return NextResponse.json({ error: 'cannot_ban_self' }, { status: 400 });
  }

  const db = admin();

  // Ban
  const { data, error } = await db
    .from('platform_blacklist')
    .upsert(
      {
        profile_id: body.profile_id,
        reason: body.reason ?? null,
        banned_by: sa.profileId,
      },
      { onConflict: 'profile_id' },
    )
    .select('id')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Side effects: remove any whitelist + cancel subscription
  await db.from('platform_whitelist').delete().eq('profile_id', body.profile_id);
  await db
    .from('subscriptions')
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString(), cancel_reason: 'banned' })
    .eq('profile_id', body.profile_id);

  await logSuperadminAction(sa.profileId, 'blacklist_add', 'profile', body.profile_id, {
    reason: body.reason ?? null,
    blacklist_id: data?.id,
  });

  return NextResponse.json({ ok: true, id: data?.id });
}

export async function DELETE(req: Request) {
  const sa = await guard();
  if (sa instanceof NextResponse) return sa;
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  const profileId = url.searchParams.get('profile_id');
  if (!id && !profileId) return NextResponse.json({ error: 'id_or_profile_id_required' }, { status: 400 });

  const db = admin();
  const q = db.from('platform_blacklist').delete();
  const { error } = id ? await q.eq('id', id) : await q.eq('profile_id', profileId!);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logSuperadminAction(
    sa.profileId,
    'blacklist_remove',
    'profile',
    profileId ?? 'by_id',
    { blacklist_id: id ?? null },
  );
  return NextResponse.json({ ok: true });
}
