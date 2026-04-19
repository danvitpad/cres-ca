/** --- YAML
 * name: Subscription Cancel
 * description: Phase 3 — marks the authenticated user's subscription as cancelled. Stores optional cancel_reason. If hutko integration is live, would also call hutko.org API to stop billing — currently stub-logs the intent.
 * created: 2026-04-19
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });

  const { reason } = await request.json().catch(() => ({})) as { reason?: string };

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: sub } = await admin
    .from('subscriptions')
    .select('id, hutko_subscription_id')
    .eq('profile_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!sub) return NextResponse.json({ error: 'no_active_subscription' }, { status: 404 });

  if (sub.hutko_subscription_id) {
    console.log('[hutko] cancel requested (stub)', { sub_id: sub.id, hutko_sub: sub.hutko_subscription_id, reason });
  }

  const { error } = await admin.from('subscriptions').update({
    status: 'cancelled',
    cancelled_at: new Date().toISOString(),
    cancel_reason: reason?.slice(0, 500) ?? null,
  }).eq('id', sub.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, cancelled_at: new Date().toISOString() });
}
