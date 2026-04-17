/** --- YAML
 * name: Telegram Master Appointment Update API
 * description: Update appointment status (complete/cancel/no_show). Validates initData + ownership.
 * created: 2026-04-17
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { validateInitData } from '@/lib/telegram/validate-init-data';

const ALLOWED_STATUSES = new Set([
  'booked', 'confirmed', 'in_progress', 'completed',
  'cancelled', 'no_show', 'cancelled_by_client', 'cancelled_by_master',
]);

export async function POST(request: Request) {
  const { initData, id, status, extra } = await request.json().catch(() => ({}));
  if (!initData || !id || !status) {
    return NextResponse.json({ error: 'missing_params' }, { status: 400 });
  }
  if (!ALLOWED_STATUSES.has(status)) {
    return NextResponse.json({ error: 'invalid_status' }, { status: 400 });
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
    .select('id')
    .eq('telegram_id', tg.id)
    .maybeSingle();
  if (!profile) return NextResponse.json({ error: 'no_profile' }, { status: 403 });

  const { data: master } = await admin
    .from('masters')
    .select('id')
    .eq('profile_id', profile.id)
    .maybeSingle();
  if (!master) return NextResponse.json({ error: 'not_master' }, { status: 403 });

  // Verify ownership of appointment
  const { data: apt } = await admin
    .from('appointments')
    .select('id, master_id')
    .eq('id', id)
    .maybeSingle();
  if (!apt || apt.master_id !== master.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const safeExtra: Record<string, unknown> = {};
  if (extra && typeof extra === 'object') {
    for (const [k, v] of Object.entries(extra as Record<string, unknown>)) {
      if (['notes', 'price', 'tip_amount', 'cancellation_reason'].includes(k)) safeExtra[k] = v;
    }
  }

  const { error } = await admin
    .from('appointments')
    .update({ status, ...safeExtra })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
