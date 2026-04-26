/** --- YAML
 * name: Finance Form Autocomplete Options (Mini App)
 * description: Возвращает clients[] и services[] мастера для autocomplete
 *              в drawer'е добавления дохода. Telegram-side initData auth.
 * created: 2026-04-26
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { validateInitData } from '@/lib/telegram/validate-init-data';

interface Body { initData?: string }

export async function POST(req: Request) {
  const { initData } = (await req.json().catch(() => ({}))) as Body;
  if (!initData) return NextResponse.json({ error: 'no_init_data' }, { status: 400 });
  const v = validateInitData(initData);
  if ('error' in v) return NextResponse.json({ error: v.error }, { status: 401 });

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data: profile } = await admin.from('profiles').select('id').eq('telegram_id', v.user.id).maybeSingle();
  if (!profile) return NextResponse.json({ clients: [], services: [] });
  const { data: master } = await admin.from('masters').select('id').eq('profile_id', profile.id).maybeSingle();
  if (!master) return NextResponse.json({ clients: [], services: [] });

  const [clientsRes, servicesRes] = await Promise.all([
    admin.from('clients')
      .select('id, full_name, phone')
      .eq('master_id', master.id)
      .order('last_visit_at', { ascending: false, nullsFirst: false })
      .limit(200),
    admin.from('services')
      .select('id, name, price, currency')
      .eq('master_id', master.id)
      .eq('is_active', true)
      .order('total_uses', { ascending: false, nullsFirst: false })
      .order('name')
      .limit(200),
  ]);

  return NextResponse.json({
    clients: clientsRes.data ?? [],
    services: servicesRes.data ?? [],
  });
}
