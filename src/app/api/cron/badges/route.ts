/** --- YAML
 * name: Master Badges Cron
 * description: Computes master badges (verified, top-week, top-rated, fast-responder) and writes masters.badges array. Daily.
 * created: 2026-04-14
 * updated: 2026-04-14
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const VERIFIED_MIN_VISITS = 100;
const TOP_RATED_MIN_AVG = 4.8;
const TOP_RATED_MIN_COUNT = 10;

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = await createClient();
  const { data: masters } = await supabase.from('masters').select('id');
  if (!masters) return NextResponse.json({ ok: true, updated: 0 });

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();

  // Two weeks of completed appointments (current vs prior week — for trending)
  const { data: periodAppts } = await supabase
    .from('appointments')
    .select('master_id, price, status, starts_at, created_at')
    .gte('starts_at', twoWeeksAgo)
    .eq('status', 'completed');
  type Row = { master_id: string; price: number | null; status: string; starts_at: string; created_at: string | null };
  const revByMaster = new Map<string, number>();
  const weekCount = new Map<string, number>();
  const prevWeekCount = new Map<string, number>();
  for (const a of ((periodAppts ?? []) as unknown) as Row[]) {
    const isThisWeek = a.starts_at >= weekAgo;
    if (isThisWeek) {
      revByMaster.set(a.master_id, (revByMaster.get(a.master_id) ?? 0) + Number(a.price ?? 0));
      weekCount.set(a.master_id, (weekCount.get(a.master_id) ?? 0) + 1);
    } else {
      prevWeekCount.set(a.master_id, (prevWeekCount.get(a.master_id) ?? 0) + 1);
    }
  }
  const topWeekIds = new Set(
    Array.from(revByMaster.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id]) => id),
  );
  // Trending: week count ≥ 3 and ≥ 50% growth over previous week
  const trendingIds = new Set<string>();
  for (const [id, curr] of weekCount.entries()) {
    const prev = prevWeekCount.get(id) ?? 0;
    if (curr >= 3 && curr >= Math.ceil(prev * 1.5) && curr > prev) trendingIds.add(id);
  }

  // Fast responder: avg (confirmed_at - created_at) < 30 min on recent 30 days
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: confirmedAppts } = await supabase
    .from('appointments')
    .select('master_id, created_at, confirmed_at')
    .gte('created_at', monthAgo)
    .not('confirmed_at', 'is', null);
  type CR = { master_id: string; created_at: string; confirmed_at: string };
  const latencies = new Map<string, number[]>();
  for (const a of ((confirmedAppts ?? []) as unknown) as CR[]) {
    const dt = (new Date(a.confirmed_at).getTime() - new Date(a.created_at).getTime()) / 60000;
    if (dt < 0 || dt > 24 * 60) continue;
    const arr = latencies.get(a.master_id) ?? [];
    arr.push(dt);
    latencies.set(a.master_id, arr);
  }
  const fastResponderIds = new Set<string>();
  for (const [id, arr] of latencies.entries()) {
    if (arr.length < 3) continue;
    const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
    if (avg < 30) fastResponderIds.add(id);
  }

  let updated = 0;
  for (const m of masters) {
    const masterId = m.id as string;
    const badges: string[] = [];

    // Verified: 100+ completed appointments
    const { count: completedCount } = await supabase
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('master_id', masterId)
      .eq('status', 'completed');
    if ((completedCount ?? 0) >= VERIFIED_MIN_VISITS) badges.push('verified');
    const level = Math.floor((completedCount ?? 0) / 50);

    // Top-rated: avg review score >= 4.8 with 10+ reviews
    const { data: reviews } = await supabase
      .from('reviews')
      .select('score')
      .eq('target_type', 'master')
      .eq('target_id', masterId)
      .eq('is_published', true);
    const rs = (reviews ?? []) as { score: number }[];
    const avg = rs.length ? rs.reduce((a, b) => a + Number(b.score), 0) / rs.length : 0;
    if (rs.length >= TOP_RATED_MIN_COUNT && avg >= TOP_RATED_MIN_AVG) badges.push('top-rated');

    // Top week
    if (topWeekIds.has(masterId)) badges.push('top-week');
    if (trendingIds.has(masterId)) badges.push('trending');
    if (fastResponderIds.has(masterId)) badges.push('fast-responder');

    const { error } = await supabase
      .from('masters')
      .update({ badges, level })
      .eq('id', masterId);
    if (!error) updated++;
  }

  return NextResponse.json({ ok: true, updated, top_week_count: topWeekIds.size });
}
