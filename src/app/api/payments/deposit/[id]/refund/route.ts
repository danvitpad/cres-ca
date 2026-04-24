/** --- YAML
 * name: Refund deposit API
 * description: POST — master (or client within 24h of appointment) requests a refund of a held deposit.
 *              MVP: marks intent as refunded in DB. Actual money back via LiqPay refund API is a follow-up
 *              (see /lib/payments/escrow.ts refund() — operator handles until webhook arrives).
 * created: 2026-04-24
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { refund } from '@/lib/payments/escrow';

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { reason?: string } | null;

  const db = admin();
  const { data: intent } = await db
    .from('payment_intents')
    .select('id, master_id, client_id, status, ' +
      'masters:master_id!payment_intents_master_id_fkey(profile_id), ' +
      'clients:client_id!payment_intents_client_id_fkey(profile_id)')
    .eq('id', id)
    .maybeSingle();

  type Loaded = {
    id: string;
    master_id: string;
    client_id: string;
    status: string;
    masters: { profile_id: string } | null;
    clients: { profile_id: string | null } | null;
  };
  const row = intent as unknown as Loaded | null;
  if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const isMaster = row.masters?.profile_id === user.id;
  const isClient = row.clients?.profile_id === user.id;
  if (!isMaster && !isClient) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  if (row.status !== 'held' && row.status !== 'pending') {
    return NextResponse.json({ error: 'cannot_refund', current_status: row.status }, { status: 400 });
  }

  const ok = await refund(db, row.id, body?.reason ?? (isMaster ? 'refunded_by_master' : 'refunded_by_client'));
  return NextResponse.json({ ok });
}
