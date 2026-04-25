/** --- YAML
 * name: Followed Masters Next Slots
 * description: Для клиента — ближайшее свободное 30-мин окно в ближайшие 7 дней у каждого из
 *              подписанных мастеров (client_master_links). Используется в "Контакты" → Мастера.
 * created: 2026-04-24
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

interface WorkingDay {
  start: string;
  end: string;
  break_start?: string;
  break_end?: string;
}

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

const DEFAULT_WH: Record<string, WorkingDay | null> = {
  sunday: null,
  monday: { start: '10:00', end: '19:00' },
  tuesday: { start: '10:00', end: '19:00' },
  wednesday: { start: '10:00', end: '19:00' },
  thursday: { start: '10:00', end: '19:00' },
  friday: { start: '10:00', end: '19:00' },
  saturday: { start: '11:00', end: '18:00' },
};

const SLOT_DURATION_MIN = 30;
const LOOKAHEAD_DAYS = 7;
const MAX_MASTERS = 10;

function t2m(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function m2t(m: number): string {
  return `${Math.floor(m / 60).toString().padStart(2, '0')}:${(m % 60).toString().padStart(2, '0')}`;
}

interface MasterSlot {
  masterId: string;
  name: string | null;
  avatar: string | null;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  iso: string;  // full ISO timestamp
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const profileId = searchParams.get('profileId');
  if (!profileId) return NextResponse.json({ error: 'missing_profile_id' }, { status: 400 });

  const supabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  // Followed masters
  const { data: links } = await supabase
    .from('client_master_links')
    .select(
      'master_id, masters:masters!client_master_links_master_id_fkey(id, display_name, avatar_url, working_hours, is_busy, busy_until, profiles:profiles!masters_profile_id_fkey(full_name, avatar_url))',
    )
    .eq('profile_id', profileId)
    .limit(MAX_MASTERS);

  if (!links || links.length === 0) return NextResponse.json({ items: [] });

  const masterIds: string[] = (links as { master_id: string }[]).map((l) => l.master_id);
  const now = new Date();
  const horizon = new Date(now.getTime() + LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000);

  const [apptRes, blockRes] = await Promise.all([
    supabase
      .from('appointments')
      .select('master_id, starts_at, ends_at, status')
      .in('master_id', masterIds)
      .gte('starts_at', now.toISOString())
      .lte('starts_at', horizon.toISOString()),
    supabase
      .from('blocked_times')
      .select('master_id, starts_at, ends_at')
      .in('master_id', masterIds)
      .gte('ends_at', now.toISOString())
      .lte('starts_at', horizon.toISOString()),
  ]);

  const busyByMaster = new Map<string, { date: string; start: number; end: number }[]>();
  for (const id of masterIds) busyByMaster.set(id, []);

  for (const a of (apptRes.data ?? []) as { master_id: string; starts_at: string; ends_at: string; status: string }[]) {
    if (['cancelled', 'cancelled_by_client', 'cancelled_by_master', 'no_show'].includes(a.status)) continue;
    const s = new Date(a.starts_at);
    const e = new Date(a.ends_at);
    busyByMaster.get(a.master_id)?.push({
      date: s.toISOString().slice(0, 10),
      start: s.getHours() * 60 + s.getMinutes(),
      end: e.getHours() * 60 + e.getMinutes(),
    });
  }
  for (const b of (blockRes.data ?? []) as { master_id: string; starts_at: string; ends_at: string }[]) {
    const s = new Date(b.starts_at);
    const e = new Date(b.ends_at);
    busyByMaster.get(b.master_id)?.push({
      date: s.toISOString().slice(0, 10),
      start: s.getHours() * 60 + s.getMinutes(),
      end: e.getHours() * 60 + e.getMinutes(),
    });
  }

  const items: MasterSlot[] = [];

  for (const link of links as unknown as {
    master_id: string;
    masters: {
      id: string;
      display_name: string | null;
      avatar_url: string | null;
      working_hours: Record<string, WorkingDay | null> | null;
      is_busy: boolean | null;
      busy_until: string | null;
      profiles: { full_name: string | null; avatar_url: string | null } | { full_name: string | null; avatar_url: string | null }[] | null;
    } | null;
  }[]) {
    const m = link.masters;
    if (!m) continue;
    const profile = Array.isArray(m.profiles) ? m.profiles[0] ?? null : m.profiles;
    const busyUntil = m.busy_until ? new Date(m.busy_until) : null;
    const busyActive = m.is_busy && (!busyUntil || busyUntil > now);
    const wh = m.working_hours ?? DEFAULT_WH;

    let found: MasterSlot | null = null;
    for (let d = 0; d < LOOKAHEAD_DAYS && !found; d++) {
      const day = new Date(now.getTime() + d * 24 * 60 * 60 * 1000);
      const dateStr = day.toISOString().slice(0, 10);
      if (busyActive && busyUntil && busyUntil.toISOString().slice(0, 10) >= dateStr) continue;

      const weekday = WEEKDAYS[day.getDay()];
      const hours = wh[weekday] ?? DEFAULT_WH[weekday];
      if (!hours) continue;

      const startMin = t2m(hours.start);
      const endMin = t2m(hours.end);
      const breakS = hours.break_start ? t2m(hours.break_start) : null;
      const breakE = hours.break_end ? t2m(hours.break_end) : null;

      const earliestMin = d === 0 ? Math.max(startMin, day.getHours() * 60 + day.getMinutes() + 15) : startMin;

      const busyList = (busyByMaster.get(link.master_id) ?? [])
        .filter((x) => x.date === dateStr)
        .sort((a, b) => a.start - b.start);

      for (let t = Math.ceil(earliestMin / 30) * 30; t + SLOT_DURATION_MIN <= endMin; t += 30) {
        if (breakS !== null && breakE !== null && t < breakE && t + SLOT_DURATION_MIN > breakS) continue;
        const conflict = busyList.some((bs) => t < bs.end && t + SLOT_DURATION_MIN > bs.start);
        if (conflict) continue;
        const time = m2t(t);
        const isoDate = new Date(day);
        isoDate.setHours(Math.floor(t / 60), t % 60, 0, 0);
        found = {
          masterId: link.master_id,
          name: m.display_name ?? profile?.full_name ?? null,
          avatar: m.avatar_url ?? profile?.avatar_url ?? null,
          date: dateStr,
          time,
          iso: isoDate.toISOString(),
        };
        break;
      }
    }
    if (found) items.push(found);
  }

  items.sort((a, b) => a.iso.localeCompare(b.iso));
  return NextResponse.json({ items });
}
