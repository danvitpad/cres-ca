/** --- YAML
 * name: Superadmin whitelist API
 * description: POST (add or replace entry), PATCH (extend expires_at), DELETE (remove). On add — syncs user subscription row. All actions audit-logged. 404s for non-superadmin.
 * created: 2026-04-19
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
  granted_plan: 'starter' | 'pro' | 'business';
  reason?: string | null;
  expires_at?: string | null;
}

interface PatchBody {
  id: string;
  expires_at?: string | null;
  reason?: string | null;
  granted_plan?: 'starter' | 'pro' | 'business';
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
  if (!body?.profile_id || !body?.granted_plan) return NextResponse.json({ error: 'bad_request' }, { status: 400 });

  const db = admin();
  const payload = {
    profile_id: body.profile_id,
    granted_plan: body.granted_plan,
    reason: body.reason ?? null,
    expires_at: body.expires_at ?? null,
    granted_by: sa.profileId,
  };
  const { data, error } = await db
    .from('platform_whitelist')
    .upsert(payload, { onConflict: 'profile_id' })
    .select('id')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: existingSub } = await db
    .from('subscriptions')
    .select('id')
    .eq('profile_id', body.profile_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingSub) {
    await db.from('subscriptions').update({ tier: body.granted_plan, status: 'active' }).eq('id', existingSub.id);
  } else {
    await db.from('subscriptions').insert({
      profile_id: body.profile_id,
      tier: body.granted_plan,
      status: 'active',
      billing_period: 'monthly',
    });
  }

  await logSuperadminAction(sa.profileId, 'whitelist_add', 'profile', body.profile_id, {
    granted_plan: body.granted_plan,
    reason: body.reason ?? null,
    expires_at: body.expires_at ?? null,
    whitelist_id: data?.id,
  });

  return NextResponse.json({ ok: true, id: data?.id });
}

export async function PATCH(req: Request) {
  const sa = await guard();
  if (sa instanceof NextResponse) return sa;
  const body = (await req.json().catch(() => null)) as PatchBody | null;
  if (!body?.id) return NextResponse.json({ error: 'bad_request' }, { status: 400 });

  const db = admin();
  const patch: Record<string, unknown> = {};
  if (body.expires_at !== undefined) patch.expires_at = body.expires_at;
  if (body.reason !== undefined) patch.reason = body.reason;
  if (body.granted_plan) patch.granted_plan = body.granted_plan;
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'nothing_to_update' }, { status: 400 });

  const { data, error } = await db.from('platform_whitelist').update(patch).eq('id', body.id).select('profile_id').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (body.granted_plan && data?.profile_id) {
    await db.from('subscriptions').update({ tier: body.granted_plan, status: 'active' }).eq('profile_id', data.profile_id);
  }

  await logSuperadminAction(sa.profileId, 'whitelist_update', 'whitelist', body.id, patch);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const sa = await guard();
  if (sa instanceof NextResponse) return sa;
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id_required' }, { status: 400 });

  const db = admin();
  const { data: entry } = await db.from('platform_whitelist').select('profile_id, granted_plan').eq('id', id).maybeSingle();
  if (!entry) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const { error } = await db.from('platform_whitelist').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: ph } = await db
    .from('payment_history')
    .select('id')
    .eq('profile_id', entry.profile_id)
    .eq('status', 'paid')
    .limit(1);
  const hasPaid = (ph?.length ?? 0) > 0;
  if (!hasPaid) {
    await db.from('subscriptions').update({ tier: 'starter', status: 'expired' }).eq('profile_id', entry.profile_id);
  }

  await logSuperadminAction(sa.profileId, 'whitelist_remove', 'profile', entry.profile_id, { whitelist_id: id, hadPaidHistory: hasPaid });
  return NextResponse.json({ ok: true, downgraded: !hasPaid });
}
