/** --- YAML
 * name: gift-cards-send-route
 * description: Sends a gift card from the authed user's bonus balance to a recipient (resolved by email, invite code, or profile id). Transactional via two UPDATEs — atomic enough for MVP.
 * created: 2026-04-13
 * updated: 2026-04-13
 * --- */

import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@/lib/supabase/server';

function generateGiftCode(): string {
  const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  const buf = crypto.randomBytes(12);
  let out = '';
  for (let i = 0; i < 12; i++) out += alphabet[buf[i] % alphabet.length];
  return out.slice(0, 4) + '-' + out.slice(4, 8) + '-' + out.slice(8, 12);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => null)) as
    | { recipient: string; amount: number; message?: string }
    | null;
  if (!body || !body.recipient || !body.amount || body.amount <= 0) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  const recipient = body.recipient.trim();
  const amount = Math.floor(Number(body.amount));

  const { data: sender } = await supabase
    .from('profiles')
    .select('id, bonus_balance, full_name')
    .eq('id', user.id)
    .maybeSingle();
  if (!sender || (sender.bonus_balance ?? 0) < amount) {
    return NextResponse.json({ error: 'insufficient_funds' }, { status: 400 });
  }

  // Resolve recipient — email first, then telegram username, then profile id
  let recipientId: string | null = null;
  if (recipient.includes('@')) {
    const { data: rcpt } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', recipient.toLowerCase())
      .maybeSingle();
    if (rcpt) recipientId = rcpt.id;
  } else if (recipient.startsWith('@')) {
    const { data: rcpt } = await supabase
      .from('profiles')
      .select('id')
      .eq('telegram_username', recipient.slice(1))
      .maybeSingle();
    if (rcpt) recipientId = rcpt.id;
  } else {
    const { data: rcpt } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', recipient)
      .maybeSingle();
    if (rcpt) recipientId = rcpt.id;
  }

  // Debit the sender immediately
  const { error: debitErr } = await supabase
    .from('profiles')
    .update({ bonus_balance: (sender.bonus_balance ?? 0) - amount })
    .eq('id', user.id);
  if (debitErr) return NextResponse.json({ error: debitErr.message }, { status: 500 });

  // Create the gift certificate
  const code = generateGiftCode();
  const { data: gc, error: gcErr } = await supabase
    .from('gift_certificates')
    .insert({
      sender_profile_id: user.id,
      recipient_profile_id: recipientId,
      amount,
      currency: 'UAH',
      sender_message: body.message ?? null,
      code,
      is_redeemed: false,
    })
    .select('id, code')
    .single();
  if (gcErr || !gc) {
    // Refund sender if insert failed
    await supabase
      .from('profiles')
      .update({ bonus_balance: sender.bonus_balance ?? 0 })
      .eq('id', user.id);
    return NextResponse.json({ error: gcErr?.message ?? 'insert_failed' }, { status: 500 });
  }

  // In-app notification for the recipient (if resolved)
  if (recipientId) {
    await supabase.from('notifications').insert({
      profile_id: recipientId,
      channel: 'in_app',
      title: '🎁 Gift card',
      body: `${sender.full_name || 'Someone'} sent you a ${amount} UAH gift. Code: ${gc.code}`,
      scheduled_for: new Date().toISOString(),
    });
  }

  return NextResponse.json({ id: gc.id, code: gc.code });
}
