/** --- YAML
 * name: Superadmin plans API
 * description: PATCH — update subscription_plans fields (price_monthly, price_yearly, features, limits). Audit-logged.
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

interface PatchBody {
  id: string;
  price_monthly?: number;
  price_yearly?: number;
  features?: string[];
  limits?: Record<string, number>;
}

export async function PATCH(req: Request) {
  const sa = await guard();
  if (sa instanceof NextResponse) return sa;

  const body = (await req.json().catch(() => null)) as PatchBody | null;
  if (!body?.id) return NextResponse.json({ error: 'bad_request' }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (typeof body.price_monthly === 'number') patch.price_monthly = body.price_monthly;
  if (typeof body.price_yearly === 'number') patch.price_yearly = body.price_yearly;
  if (Array.isArray(body.features)) patch.features = body.features;
  if (body.limits && typeof body.limits === 'object') patch.limits = body.limits;
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'nothing_to_update' }, { status: 400 });

  const db = admin();
  const { error } = await db.from('subscription_plans').update(patch).eq('id', body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logSuperadminAction(sa.profileId, 'plan_update', 'plan', body.id, patch);
  return NextResponse.json({ ok: true });
}
