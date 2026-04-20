/** --- YAML
 * name: Telegram Client Next Appointment API
 * description: Returns the user's upcoming appointment (booked/confirmed, starts_at >= now).
 * created: 2026-04-17
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { validateInitData } from '@/lib/telegram/validate-init-data';

export async function POST(request: Request) {
  const { initData } = await request.json().catch(() => ({}));
  if (!initData) return NextResponse.json({ error: 'missing_init_data' }, { status: 400 });

  const result = validateInitData(initData);
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 403 });

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: profile } = await admin.from('profiles').select('id').eq('telegram_id', result.user.id).maybeSingle();
  if (!profile) return NextResponse.json({ next: null });

  const { data: clientRows } = await admin.from('clients').select('id').eq('profile_id', profile.id);
  const clientIds = (clientRows ?? []).map((c) => c.id);
  if (clientIds.length === 0) return NextResponse.json({ next: null });

  const { data: apt } = await admin
    .from('appointments')
    .select('id, starts_at, price, master:masters(id, salon_id, specialization, display_name, avatar_url, profile:profiles!masters_profile_id_fkey(full_name, avatar_url), salon:salons(id, name, logo_url, city)), service:services(name)')
    .in('client_id', clientIds)
    .gte('starts_at', new Date().toISOString())
    .in('status', ['booked', 'confirmed'])
    .order('starts_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({ next: apt ?? null });
}
