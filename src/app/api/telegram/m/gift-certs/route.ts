/** --- YAML
 * name: Master Gift Certificates API
 * description: >
 *   GET /api/telegram/m/gift-certs — list master's gift certificates.
 *   POST /api/telegram/m/gift-certs — create a new gift certificate
 *         body: { amount, expires_at? }. Generates a unique code.
 *   Auth via X-TG-Init-Data or cookie session.
 * created: 2026-05-09
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { resolveUserId } from '@/lib/auth/resolve-user';

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

async function getMasterId(userId: string): Promise<string | null> {
  const adm = admin();
  const { data } = await adm.from('masters').select('id').eq('profile_id', userId).maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

export async function GET(req: Request) {
  const userId = await resolveUserId(req);
  if (!userId) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const masterId = await getMasterId(userId);
  if (!masterId) return NextResponse.json({ certs: [] });

  const adm = admin();
  const { data } = await adm
    .from('gift_certificates')
    .select('id, code, amount, currency, balance_remaining, is_redeemed, expires_at, created_at')
    .eq('master_id', masterId)
    .order('created_at', { ascending: false })
    .limit(50);

  return NextResponse.json({ certs: data ?? [] });
}

export async function POST(req: Request) {
  const userId = await resolveUserId(req);
  if (!userId) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const masterId = await getMasterId(userId);
  if (!masterId) return NextResponse.json({ error: 'master_not_found' }, { status: 404 });

  const body = await req.json().catch(() => null) as { amount?: number; expires_at?: string } | null;
  if (!body?.amount || isNaN(Number(body.amount)) || Number(body.amount) <= 0) {
    return NextResponse.json({ error: 'invalid_amount' }, { status: 400 });
  }

  const adm = admin();
  const { data, error } = await adm
    .from('gift_certificates')
    .insert({
      master_id: masterId,
      purchased_by: userId,
      amount: Number(body.amount),
      balance_remaining: Number(body.amount),
      currency: 'UAH',
      is_redeemed: false,
      ...(body.expires_at ? { expires_at: body.expires_at } : {}),
    })
    .select('id, code, amount, currency, expires_at')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'insert_failed' }, { status: 500 });
  }

  return NextResponse.json({ cert: data });
}
