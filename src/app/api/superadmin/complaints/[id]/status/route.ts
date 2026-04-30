/** --- YAML
 * name: Superadmin Complaint Status API
 * description: POST — superadmin меняет статус жалобы (open / in_progress /
 *              closed) + опциональный resolution_note. Audit log в
 *              superadmin_audit_log.
 * created: 2026-04-30
 * --- */

import { NextRequest, NextResponse } from 'next/server';
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

const ALLOWED_STATUSES = ['open', 'in_progress', 'closed'] as const;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let sa;
  try {
    sa = await requireSuperadmin();
  } catch (r) {
    if (r instanceof NextResponse) return r;
    if (r instanceof Response) return new NextResponse(r.body, { status: r.status });
    return new NextResponse('not found', { status: 404 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null) as {
    status?: string;
    resolution_note?: string | null;
  } | null;

  if (!body?.status || !ALLOWED_STATUSES.includes(body.status as typeof ALLOWED_STATUSES[number])) {
    return NextResponse.json({ error: 'invalid_status' }, { status: 400 });
  }

  const update: Record<string, unknown> = { status: body.status };
  if (body.status === 'closed') {
    update.closed_at = new Date().toISOString();
    update.closed_by = sa.profileId;
    if (body.resolution_note) update.resolution_note = body.resolution_note.slice(0, 1000);
  } else if (body.status === 'open') {
    update.closed_at = null;
    update.closed_by = null;
    update.resolution_note = null;
  }

  const db = admin();
  const { error } = await db.from('complaints').update(update).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logSuperadminAction(sa.profileId, 'complaint_status_change', 'complaint', id, {
    new_status: body.status,
    note: body.resolution_note ?? null,
  });

  return NextResponse.json({ ok: true });
}
