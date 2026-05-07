/** --- YAML
 * name: Telegram Master Clients API
 * description: Returns clients of the master who owns the validated Telegram session.
 *              Used by /telegram/m/clients page — Supabase JWT cookies don't persist
 *              in Telegram WebView, so we validate via initData HMAC + service-role.
 * created: 2026-04-17
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { resolveUserId } from '@/lib/auth/resolve-user';

export async function POST(request: Request) {
  const userId = await resolveUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: master } = await admin
    .from('masters')
    .select('id')
    .eq('profile_id', userId)
    .maybeSingle();
  if (!master) {
    return NextResponse.json({ clients: [], masterId: null });
  }

  // Загружаем profile_id всех мастеров — клиенты с такими profile_id не должны
  // показываться в чужих списках (мастер не клиент в чужой воронке).
  const { data: allMasters } = await admin.from('masters').select('profile_id');
  const masterProfileIds = new Set(
    ((allMasters ?? []) as Array<{ profile_id: string | null }>)
      .map((m) => m.profile_id)
      .filter((v): v is string => !!v),
  );

  const { data: clientsRaw, error } = await admin
    .from('clients')
    .select('id, full_name, phone, profile_id, total_visits, total_spent, last_visit_at, has_health_alert, behavior_indicators')
    .eq('master_id', master.id)
    .order('last_visit_at', { ascending: false, nullsFirst: false })
    .limit(500);

  // Отфильтровываем клиентов чьи profile_id принадлежат мастерам.
  // profile_id NULL — обычные ручные клиенты без TG-привязки, оставляем.
  const clients = ((clientsRaw ?? []) as Array<{ profile_id: string | null } & Record<string, unknown>>)
    .filter((c) => !c.profile_id || !masterProfileIds.has(c.profile_id));

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ clients: clients ?? [], masterId: master.id });
}
