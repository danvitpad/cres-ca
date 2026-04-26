/** --- YAML
 * name: Promo Code Validate
 * description: Public-facing validator for the booking flow. Accepts {code, masterId,
 *              serviceId, basePrice} and returns either a normalised discount payload
 *              or a typed error code (not_found / inactive / expired / not_started /
 *              max_uses_reached / service_not_applicable / wrong_master). The booking
 *              client uses this to render «Применить» feedback before the appointment
 *              insert. The actual discount + uses_count increment happens later in
 *              /api/promo-codes/redeem (called from the same booking submit path) so
 *              validation alone is read-only and safe to call as the user types.
 * created: 2026-04-26
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

interface Body {
  code?: string;
  masterId?: string;
  serviceId?: string;
  basePrice?: number;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.code?.trim() || !body?.masterId) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  const code = body.code.trim().toUpperCase();
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: promo, error } = await admin
    .from('promo_codes')
    .select('id, master_id, code, discount_type, discount_value, discount_percent, max_uses, uses_count, valid_from, valid_until, is_active, applicable_service_ids')
    .ilike('code', code)
    .eq('master_id', body.masterId)
    .maybeSingle();
  if (error || !promo) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (promo.master_id !== body.masterId) {
    return NextResponse.json({ error: 'wrong_master' }, { status: 400 });
  }
  if (!promo.is_active) {
    return NextResponse.json({ error: 'inactive' }, { status: 400 });
  }
  const now = Date.now();
  if (promo.valid_from && new Date(promo.valid_from).getTime() > now) {
    return NextResponse.json({ error: 'not_started' }, { status: 400 });
  }
  if (promo.valid_until && new Date(promo.valid_until).getTime() < now) {
    return NextResponse.json({ error: 'expired' }, { status: 400 });
  }
  if (promo.max_uses != null && (promo.uses_count ?? 0) >= promo.max_uses) {
    return NextResponse.json({ error: 'max_uses_reached' }, { status: 400 });
  }
  if (
    body.serviceId &&
    Array.isArray(promo.applicable_service_ids) &&
    promo.applicable_service_ids.length > 0 &&
    !promo.applicable_service_ids.includes(body.serviceId)
  ) {
    return NextResponse.json({ error: 'service_not_applicable' }, { status: 400 });
  }

  // Compute discount amount in UAH from the (legacy or new) columns. Prefer the
  // newer typed pair (discount_type + discount_value); fall back to legacy
  // discount_percent if the row was created before migration 00101.
  const base = Number(body.basePrice ?? 0);
  let amount = 0;
  if (promo.discount_type === 'percentage') {
    amount = Math.round((base * Number(promo.discount_value ?? 0)) / 100);
  } else if (promo.discount_type === 'fixed') {
    amount = Math.round(Number(promo.discount_value ?? 0));
  } else {
    // Legacy fallback
    amount = Math.round((base * Number(promo.discount_percent ?? 0)) / 100);
  }
  amount = Math.max(0, Math.min(amount, base));

  return NextResponse.json({
    ok: true,
    promo_id: promo.id,
    code: promo.code,
    discount_type: promo.discount_type ?? 'percentage',
    discount_value: Number(promo.discount_value ?? promo.discount_percent ?? 0),
    discount_amount: amount,
    final_price: Math.max(0, base - amount),
  });
}
