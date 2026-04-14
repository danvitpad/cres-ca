/** --- YAML
 * name: Consent Sign API
 * description: Публичный endpoint — клиент отправляет signature_data + подтверждение. Использует service role (без auth), ищет форму по sign_token, фиксирует agreed_at + client_ip.
 * created: 2026-04-13
 * updated: 2026-04-13
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const token = body?.token;
  const signature = body?.signature;
  if (!token || !signature) {
    return NextResponse.json({ error: 'token and signature required' }, { status: 400 });
  }

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    null;

  const supabase = admin();
  const { data: form } = await supabase
    .from('consent_forms')
    .select('id, client_agreed')
    .eq('sign_token', token)
    .maybeSingle();

  if (!form) return NextResponse.json({ error: 'Form not found' }, { status: 404 });
  if (form.client_agreed) {
    return NextResponse.json({ error: 'Already signed' }, { status: 409 });
  }

  const { error } = await supabase
    .from('consent_forms')
    .update({
      client_agreed: true,
      agreed_at: new Date().toISOString(),
      client_ip: ip,
      signature_data: signature,
    })
    .eq('id', form.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
