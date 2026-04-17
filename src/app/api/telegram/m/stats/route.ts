/** --- YAML
 * name: Telegram Master Stats API
 * description: Returns appointments for the last N days for the stats screen.
 * created: 2026-04-17
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { validateInitData } from '@/lib/telegram/validate-init-data';

export async function POST(request: Request) {
  const { initData, period } = await request.json().catch(() => ({}));
  if (!initData) return NextResponse.json({ error: 'missing_init_data' }, { status: 400 });

  const result = validateInitData(initData);
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 403 });

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: profile } = await admin.from('profiles').select('id').eq('telegram_id', result.user.id).maybeSingle();
  if (!profile) return NextResponse.json({ appointments: [] });
  const { data: master } = await admin.from('masters').select('id').eq('profile_id', profile.id).maybeSingle();
  if (!master) return NextResponse.json({ appointments: [] });

  const days = period === 'month' ? 30 : 7;
  const now = new Date();
  const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  const { data } = await admin
    .from('appointments')
    .select('id, starts_at, status, price, service:services(name)')
    .eq('master_id', master.id)
    .gte('starts_at', from.toISOString())
    .lte('starts_at', now.toISOString());

  return NextResponse.json({ appointments: data ?? [] });
}
