/** --- YAML
 * name: Superadmin subscriptions API
 * description: POST actions against subscriptions — extend_trial, override_plan, cancel. 404s for non-superadmin callers. Logs every action to superadmin_audit_log.
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

interface Body {
  action: 'extend_trial' | 'override_plan' | 'cancel';
  subscriptionId: string;
  days?: number;
  tier?: 'starter' | 'pro' | 'business';
  reason?: string;
}

export async function POST(req: Request) {
  let sa;
  try {
    sa = await requireSuperadmin();
  } catch (r) {
    if (r instanceof Response) return r;
    return new NextResponse('not found', { status: 404 });
  }

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.action || !body.subscriptionId) return NextResponse.json({ error: 'bad_request' }, { status: 400 });

  const db = admin();
  const { data: sub } = await db.from('subscriptions').select('id, profile_id, tier, status, trial_ends_at').eq('id', body.subscriptionId).maybeSingle();
  if (!sub) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  if (body.action === 'extend_trial') {
    const days = Math.max(1, Math.min(180, Number(body.days ?? 7)));
    const base = sub.trial_ends_at ? new Date(sub.trial_ends_at).getTime() : Date.now();
    const next = new Date(Math.max(base, Date.now()) + days * 24 * 3600 * 1000).toISOString();
    const { error } = await db.from('subscriptions').update({ trial_ends_at: next, status: 'active' }).eq('id', body.subscriptionId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await logSuperadminAction(sa.profileId, 'subscription_extend_trial', 'subscription', body.subscriptionId, { days, newTrialEndsAt: next, profileId: sub.profile_id });
    return NextResponse.json({ ok: true, trial_ends_at: next });
  }

  if (body.action === 'override_plan') {
    const tier = body.tier;
    if (!tier) return NextResponse.json({ error: 'tier_required' }, { status: 400 });
    const { error } = await db.from('subscriptions').update({ tier, status: 'active' }).eq('id', body.subscriptionId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await logSuperadminAction(sa.profileId, 'subscription_override', 'subscription', body.subscriptionId, { tier, previousTier: sub.tier, profileId: sub.profile_id });
    return NextResponse.json({ ok: true, tier });
  }

  if (body.action === 'cancel') {
    const reason = body.reason ?? 'superadmin_cancel';
    const { error } = await db.from('subscriptions').update({ status: 'cancelled', cancelled_at: new Date().toISOString(), cancel_reason: reason }).eq('id', body.subscriptionId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await logSuperadminAction(sa.profileId, 'subscription_cancel', 'subscription', body.subscriptionId, { reason, previousStatus: sub.status, profileId: sub.profile_id });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'unknown_action' }, { status: 400 });
}
