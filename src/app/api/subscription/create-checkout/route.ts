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

  console.log('[hutko] create-checkout requested', { user: user.id, plan_slug, billing_period });

  return NextResponse.json({
    url: null,
    message: 'Оплата через hutko.org скоро будет доступна. Сейчас доступна LiqPay.',
    provider: 'hutko',
    stub: true,
  });
}
