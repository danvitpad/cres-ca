/** --- YAML
 * name: Home Feed API (slot-only)
 * description: GET /api/feed → ближайшие свободные окна у мастеров и салонов из контактов клиента.
 *              Источник — feed_posts с type='burning_slot' (создаются cron'ом burning-slots).
 *              Без infinite cursor: возвращает ближайшие N окон в порядке времени.
 * created: 2026-04-14
 * updated: 2026-04-25
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { validateInitData } from '@/lib/telegram/validate-init-data';

const LIMIT = 30;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminDb = any;

async function resolveViewer(req: Request): Promise<{ id: string; admin: AdminDb } | null> {
  const initData = req.headers.get('x-tg-init-data');
  if (initData) {
    const res = validateInitData(initData);
    if (!('error' in res)) {
      const admin = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } },
      );
      const { data: p } = await admin.from('profiles').select('id').eq('telegram_id', res.user.id).maybeSingle();
      if (p?.id) return { id: p.id, admin };
    }
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    return { id: user.id, admin };
  }
  return null;
}

export async function GET(req: Request) {
  const viewer = await resolveViewer(req);
  if (!viewer) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const supabase = viewer.admin;

  const { data: cmls } = await supabase
    .from('client_master_links')
    .select('master_id')
    .eq('profile_id', viewer.id);

  const masterIds = ((cmls ?? []) as Array<{ master_id: string }>).map((c) => c.master_id);
  if (masterIds.length === 0) {
    return NextResponse.json({ items: [], nextCursor: null });
  }

  const nowIso = new Date().toISOString();

  const { data: rows, error } = await supabase
    .from('feed_posts')
    .select('id, master_id, title, body, linked_service_id, expires_at, created_at')
    .in('master_id', masterIds)
    .eq('type', 'burning_slot')
    .gt('expires_at', nowIso)
    .order('expires_at', { ascending: true })
    .limit(LIMIT);

  if (error) {
    return NextResponse.json({ error: 'query_failed', detail: error.message }, { status: 500 });
  }

  const slotRows = (rows ?? []) as Array<{
    id: string;
    master_id: string;
    title: string | null;
    body: string | null;
    linked_service_id: string | null;
    expires_at: string | null;
    created_at: string;
  }>;

  if (slotRows.length === 0) {
    return NextResponse.json({ items: [], nextCursor: null });
  }

  const masterIdSet = Array.from(new Set(slotRows.map((s) => s.master_id)));
  const serviceIds = Array.from(
    new Set(slotRows.map((s) => s.linked_service_id).filter((x): x is string => !!x)),
  );

  type SalonEmbed = { id: string; name: string; logo_url: string | null; city: string | null };
  const [{ data: masters }, { data: services }] = await Promise.all([
    supabase
      .from('masters')
      .select(
        'id, display_name, avatar_url, specialization, salon:salons(id, name, logo_url, city), profiles:profiles!masters_profile_id_fkey(full_name, avatar_url)',
      )
      .in('id', masterIdSet),
    serviceIds.length
      ? supabase.from('services').select('id, name, price, duration_minutes').in('id', serviceIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string; price: number | null; duration_minutes: number | null }> }),
  ]);

  type MasterRow = {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
    specialization: string | null;
    salon: SalonEmbed | SalonEmbed[] | null;
    profiles: { full_name: string | null; avatar_url: string | null } | { full_name: string | null; avatar_url: string | null }[] | null;
  };
  const masterMap = new Map<string, {
    id: string;
    name: string | null;
    avatar: string | null;
    specialization: string | null;
    salon: SalonEmbed | null;
  }>();
  for (const m of (masters ?? []) as MasterRow[]) {
    const profile = Array.isArray(m.profiles) ? m.profiles[0] ?? null : m.profiles;
    const salon = Array.isArray(m.salon) ? m.salon[0] ?? null : m.salon;
    masterMap.set(m.id, {
      id: m.id,
      name: m.display_name ?? profile?.full_name ?? null,
      avatar: m.avatar_url ?? profile?.avatar_url ?? null,
      specialization: m.specialization,
      salon,
    });
  }

  const serviceMap = new Map<string, { id: string; name: string; price: number | null; duration_minutes: number | null }>();
  for (const s of (services ?? []) as Array<{ id: string; name: string; price: number | null; duration_minutes: number | null }>) {
    serviceMap.set(s.id, s);
  }

  const items = slotRows.map((s) => ({
    id: s.id,
    master: masterMap.get(s.master_id) ?? null,
    service: s.linked_service_id ? serviceMap.get(s.linked_service_id) ?? null : null,
    title: s.title,
    body: s.body,
    starts_at: s.expires_at,
    created_at: s.created_at,
  }));

  return NextResponse.json({ items, nextCursor: null });
}
