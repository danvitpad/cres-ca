/** --- YAML
 * name: Subscription Create-Checkout (Hutko stub)
 * description: Phase 3 — stub. Returns { url: null, message } until hutko.org integration goes live. Existing LiqPay flow continues to work via /api/payments/create.
 * created: 2026-04-19
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { plan_slug, billing_period } = body as { plan_slug?: string; billing_period?: 'monthly' | 'yearly' };

  if (!plan_slug) return NextResponse.json({ error: 'plan_slug_required' }, { status: 400 });

  const hutkoReady = !!process.env.HUTKO_API_KEY;
  console.log('[hutko] create-checkout requested', { user: user.id, plan_slug, billing_period, hutkoReady });

  // When Hutko is fully integrated, this is where we'd POST to their
  // checkout API and return the redirect URL. For now we return a
  // structured stub so UI can detect and fall back to LiqPay via
  // /api/payments/create.
  return NextResponse.json({
    url: null,
    message: hutkoReady
      ? 'Hutko checkout API not wired yet (key present, client SDK missing).'
      : 'Hutko не подключён (HUTKO_API_KEY не задан). Используйте LiqPay (/api/payments/create).',
    provider: 'hutko',
    stub: true,
    fallback: '/api/payments/create',
  });
}
