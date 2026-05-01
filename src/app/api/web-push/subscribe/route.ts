/** --- YAML
 * name: Web Push subscribe / unsubscribe
 * description: POST  → upsert one push subscription for the current profile
 *              DELETE → remove subscription by endpoint
 *              GET   → return VAPID public key (for client subscribe call)
 * created: 2026-05-01
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  return NextResponse.json({
    publicKey: process.env.VAPID_PUBLIC_KEY ?? null,
    enabled: Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
  });
}

interface SubscribeBody {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  user_agent?: string;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: SubscribeBody;
  try {
    body = await request.json() as SubscribeBody;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
    return NextResponse.json({ error: 'invalid_subscription' }, { status: 400 });
  }

  // Upsert by endpoint — same browser/device re-subscribing just refreshes
  const { error } = await supabase
    .from('web_push_subscriptions')
    .upsert(
      {
        profile_id: user.id,
        endpoint: body.endpoint,
        p256dh: body.keys.p256dh,
        auth: body.keys.auth,
        user_agent: body.user_agent ?? null,
        last_used_at: new Date().toISOString(),
        failure_count: 0,
      },
      { onConflict: 'endpoint' },
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let endpoint: string | null = null;
  try {
    const body = await request.json() as { endpoint?: string };
    endpoint = body.endpoint ?? null;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  if (!endpoint) return NextResponse.json({ error: 'endpoint_required' }, { status: 400 });

  const { error } = await supabase
    .from('web_push_subscriptions')
    .delete()
    .eq('profile_id', user.id)
    .eq('endpoint', endpoint);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
