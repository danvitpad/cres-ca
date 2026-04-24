/** --- YAML
 * name: Superadmin verification review API
 * description: POST /api/superadmin/verification/[id] with {action: 'approve'|'reject', reason?} — flips verification_requests.status and sets masters.verified_at / expertise_verified_at on approve.
 * created: 2026-04-24
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

interface Body {
  action: 'approve' | 'reject';
  reason?: string;
}

async function guard() {
  try {
    return await requireSuperadmin();
  } catch (r) {
    if (r instanceof Response) return new NextResponse(r.body, { status: r.status });
    return new NextResponse('not found', { status: 404 });
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const sa = await guard();
  if (sa instanceof NextResponse) return sa;

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body || (body.action !== 'approve' && body.action !== 'reject')) {
    return NextResponse.json({ error: 'bad_action' }, { status: 400 });
  }

  const db = admin();
  const { data: request } = await db
    .from('verification_requests')
    .select('id, profile_id, master_id, kind, status')
    .eq('id', id)
    .maybeSingle();

  if (!request) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (request.status !== 'pending') return NextResponse.json({ error: 'already_reviewed' }, { status: 400 });

  const now = new Date().toISOString();
  if (body.action === 'approve') {
    await db
      .from('verification_requests')
      .update({ status: 'approved', reviewed_at: now, reviewed_by: sa.profileId })
      .eq('id', id);

    if (request.master_id) {
      const column = request.kind === 'identity' ? 'verified_at' : 'expertise_verified_at';
      await db.from('masters').update({ [column]: now }).eq('id', request.master_id);
    }

    await logSuperadminAction(sa.profileId, 'verification_approve', 'verification_request', id, {
      kind: request.kind,
      profile_id: request.profile_id,
    });
  } else {
    await db
      .from('verification_requests')
      .update({
        status: 'rejected',
        reviewed_at: now,
        reviewed_by: sa.profileId,
        rejection_reason: body.reason ?? null,
      })
      .eq('id', id);

    await logSuperadminAction(sa.profileId, 'verification_reject', 'verification_request', id, {
      kind: request.kind,
      reason: body.reason ?? null,
    });
  }

  return NextResponse.json({ ok: true });
}

/** GET — return signed URLs for superadmin to preview document/selfie. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const sa = await guard();
  if (sa instanceof NextResponse) return sa;

  const { id } = await ctx.params;
  const db = admin();
  const res = await db
    .from('verification_requests')
    .select('id, document_url, selfie_url, kind, status, note, profile_id, rejection_reason, ' +
      'profiles:profile_id(full_name, email)')
    .eq('id', id)
    .maybeSingle();

  type Row = {
    id: string;
    document_url: string | null;
    selfie_url: string | null;
    kind: 'identity' | 'expertise';
    status: string;
    note: string | null;
    profile_id: string;
    rejection_reason: string | null;
    profiles: { full_name: string | null; email: string | null } | null;
  };
  const r = res.data as unknown as Row | null;

  if (!r) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const signed = async (key: string | null) => {
    if (!key) return null;
    const { data } = await db.storage.from('verification').createSignedUrl(key, 3600);
    return data?.signedUrl ?? null;
  };

  return NextResponse.json({
    id: r.id,
    kind: r.kind,
    status: r.status,
    note: r.note,
    rejectionReason: r.rejection_reason,
    documentUrl: await signed(r.document_url),
    selfieUrl: await signed(r.selfie_url),
    profile: r.profiles,
  });
}
