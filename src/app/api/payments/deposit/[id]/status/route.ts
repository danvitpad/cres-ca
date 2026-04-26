/** --- YAML
 * name: Intent status API
 * description: GET — polled by /payments/return page while waiting for LiqPay callback.
 * created: 2026-04-24
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';


export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data } = await supabase
    .from('payment_intents')
    .select('id, status, amount, currency, appointment_id')
    .eq('id', id)
    .maybeSingle();

  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json(data);
}
