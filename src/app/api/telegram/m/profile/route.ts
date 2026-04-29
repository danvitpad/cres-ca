/** --- YAML
 * name: Telegram Master Profile API
 * description: Returns master self profile + subscription info + aggregate stats for Mini App profile.
 * created: 2026-04-17
 * updated: 2026-04-25
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { validateInitData } from '@/lib/telegram/validate-init-data';

export async function POST(request: Request) {
  const { initData } = await request.json().catch(() => ({}));
  if (!initData) {
    return NextResponse.json({ error: 'missing_init_data' }, { status: 400 });
  }

  const result = validateInitData(initData);
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 403 });
  }

  const tg = result.user;
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: profile } = await admin
    .from('profiles')
    .select('id, full_name, first_name, last_name, avatar_url')
    .eq('telegram_id', tg.id)
    .maybeSingle();
  if (!profile) {
    return NextResponse.json({ master: null, profile: null, subscription: null, stats: null });
  }

  const [{ data: master }, { data: subscription }] = await Promise.all([
    admin
      .from('masters')
      .select('id, display_name, specialization, bio, city, rating, total_reviews, avatar_url, invite_code')
      .eq('profile_id', profile.id)
      .maybeSingle(),
    admin
      .from('subscriptions')
      .select('tier, status, trial_ends_at, current_period_end')
      .eq('profile_id', profile.id)
      .maybeSingle(),
  ]);

  let stats = null as null | { appointments: number; clients: number };
  if (master) {
    const [{ count: appointmentsCount }, { count: clientsCount }] = await Promise.all([
      admin
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .eq('master_id', master.id)
        .eq('status', 'completed'),
      admin
        .from('clients')
        .select('id', { count: 'exact', head: true })
        .eq('master_id', master.id),
    ]);
    stats = {
      appointments: appointmentsCount ?? 0,
      clients: clientsCount ?? 0,
    };
  }

  return NextResponse.json({ profile, master, subscription, stats });
}


export async function PATCH(request: Request) {
  const body = await request.json().catch(() => ({})) as {
    initData?: string;
    first_name?: string;
    last_name?: string;
  };
  if (!body.initData) {
    return NextResponse.json({ error: "missing_init_data" }, { status: 400 });
  }
  const result = validateInitData(body.initData);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 403 });
  }
  const tg = result.user;
  const firstName = (body.first_name ?? "").trim();
  const lastName = (body.last_name ?? "").trim();
  if (!firstName) {
    return NextResponse.json({ error: "first_name_required" }, { status: 400 });
  }
  const fullName = [firstName, lastName].filter(Boolean).join(" ");

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { error } = await admin
    .from("profiles")
    .update({ first_name: firstName, last_name: lastName || null, full_name: fullName })
    .eq("telegram_id", tg.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, full_name: fullName });
}

