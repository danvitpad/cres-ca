/** --- YAML
 * name: Client Gift Certificate Validate API
 * description: >
 *   GET /api/telegram/c/gift-cert?code=X&master_id=Y — validates a gift
 *   certificate code for a specific master. Returns cert details if valid,
 *   error otherwise. No auth required (code is the secret).
 * created: 2026-05-09
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code')?.trim().toUpperCase();
  const masterId = searchParams.get('master_id');

  if (!code || !masterId) {
    return NextResponse.json({ valid: false, error: 'missing_params' });
  }

  const adm = admin();
  const { data } = await adm
    .from('gift_certificates')
    .select('id, code, amount, balance_remaining, currency, is_redeemed, expires_at')
    .eq('master_id', masterId)
    .ilike('code', code)
    .maybeSingle();

  if (!data) return NextResponse.json({ valid: false, error: 'not_found' });

  const cert = data as {
    id: string; code: string; amount: number;
    balance_remaining: number | null; currency: string;
    is_redeemed: boolean; expires_at: string | null;
  };

  if (cert.is_redeemed) return NextResponse.json({ valid: false, error: 'already_redeemed' });

  if (cert.expires_at && new Date(cert.expires_at) < new Date()) {
    return NextResponse.json({ valid: false, error: 'expired' });
  }

  return NextResponse.json({
    valid: true,
    id: cert.id,
    amount: cert.balance_remaining ?? cert.amount,
    currency: cert.currency,
  });
}
