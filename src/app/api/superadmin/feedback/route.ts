/** --- YAML
 * name: Superadmin feedback API
 * description: PATCH — change feedback status (new | reviewed | actioned | closed). Audit-logged. 404 for non-superadmin.
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

async function guard(): Promise<{ profileId: string; email: string } | NextResponse> {
  try {
    return await requireSuperadmin();
  } catch (r) {
    if (r instanceof NextResponse) return r;
    if (r instanceof Response) return new NextResponse(r.body, { status: r.status });
    return new NextResponse('not found', { status: 404 });
  }
}

const ALLOWED_STATUS = new Set(['new', 'reviewed', 'actioned', 'closed']);

export async function PATCH(req: Request) {
  const sa = await guard();
  if (sa instanceof NextResponse) return sa;

  const body = (await req.json().catch(() => null)) as { id?: string; status?: string } | null;
  if (!body?.id || !body.status || !ALLOWED_STATUS.has(body.status)) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const db = admin();
  const { error } = await db.from('feedback').update({ status: body.status }).eq('id', body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logSuperadminAction(sa.profileId, 'feedback_status_change', 'feedback', body.id, { status: body.status });
  return NextResponse.json({ ok: true });
}
