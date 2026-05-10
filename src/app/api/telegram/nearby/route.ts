/** --- YAML
 * name: Telegram Nearby API
 * description: Returns masters and salons near given coordinates. Uses admin client to bypass RLS.
 *              Параметр `vertical` (опциональный) фильтрует мастеров по точной нише
 *              (beauty/health/auto/pets/fitness/education/...) с fallback на ilike
 *              по specialization для legacy-мастеров без проставленной vertical.
 * created: 2026-04-16
 * updated: 2026-05-10
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import type { VerticalKey } from '@/lib/search/category-vertical';

const RADIUS_DEG = 0.15;

const VERTICAL_FALLBACK_TERMS: Record<VerticalKey, string[]> = {
  beauty: ['красота', 'краса', 'beauty'],
  health: ['здоровье', "здоров'я", 'health', 'wellness', 'массаж', 'масаж'],
  auto: ['авто', 'auto', 'car'],
  tattoo: ['тату', 'tattoo', 'пирсинг', 'пірсинг'],
  pets: ['питомцы', 'тварини', 'pets', 'pet', 'груминг', 'грумінг'],
  craft: ['ремонт', 'мастерская', 'майстерня', 'craft'],
  fitness: ['фитнес', 'фітнес', 'fitness', 'йога', 'yoga'],
  events: ['ивент', 'івент', 'event', 'ведущий', 'ведучий'],
  education: ['обучение', 'навчання', 'education', 'репетитор', 'tutor'],
  other: [],
};

function escLike(s: string): string {
  return s.replace(/([%,()\\])/g, '\\$1');
}

function isValidVertical(v: unknown): v is VerticalKey {
  return typeof v === 'string' && v in VERTICAL_FALLBACK_TERMS;
}

/**
 * Возвращает строку для `.or(...)`, которая матчит мастера если:
 *   - его vertical = выбранной нише, ИЛИ
 *   - vertical IS NULL И specialization содержит одно из fallback-слов.
 *
 * Это важно для совместимости со старыми мастерами, у которых vertical
 * не проставлен (онбординг-вертикаль появилась позже самой таблицы).
 */
function verticalOrClause(v: VerticalKey): string {
  const terms = VERTICAL_FALLBACK_TERMS[v];
  const ilikes = terms.map((t) => `specialization.ilike.%${escLike(t)}%`);
  return [`vertical.eq.${v}`, ...ilikes].join(',');
}

export async function POST(request: Request) {
  const { lat, lng, q, vertical } = await request.json();

  const hasCoords = typeof lat === 'number' && typeof lng === 'number';
  const hasQuery = typeof q === 'string' && q.trim().length >= 2;
  const verticalFilter = isValidVertical(vertical) ? vertical : null;

  if (!hasCoords && !hasQuery) {
    return NextResponse.json({ error: 'invalid_params' }, { status: 400 });
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const masterSelect =
    'id, specialization, rating, salon_id, latitude, longitude, address, city, workplace_name, display_name, avatar_url, vertical, profile:profiles!masters_profile_id_fkey(full_name), salon:salons(id, name, logo_url, city), services(price)';

  // Name-based search — multi-word AND (ловит «имя фамилия» И «фамилия имя»).
  if (hasQuery) {
    const tokens = q.trim().toLowerCase().split(/\s+/).filter(Boolean);

    // Masters: chain ilike per token across display_name OR specialization OR city
    let mastersQuery = admin.from('masters').select(masterSelect).eq('is_active', true);
    if (verticalFilter) {
      mastersQuery = mastersQuery.or(verticalOrClause(verticalFilter));
    }
    for (const t of tokens) {
      const esc = escLike(t);
      mastersQuery = mastersQuery.or(`display_name.ilike.%${esc}%,specialization.ilike.%${esc}%,city.ilike.%${esc}%`);
    }

    let salonsQuery = admin
      .from('salons')
      .select('id, name, logo_url, address, city, rating, latitude, longitude');
    for (const t of tokens) {
      const esc = escLike(t);
      salonsQuery = salonsQuery.or(`name.ilike.%${esc}%,city.ilike.%${esc}%`);
    }

    const [mastersRes, salonsRes] = await Promise.all([
      mastersQuery.limit(30),
      salonsQuery.limit(30),
    ]);

    let masters = mastersRes.data ?? [];

    // Always also do a profile-name fallback: catches ANY master whose profile.full_name
    // matches all tokens (this is the only way to find e.g. "Падалко Даниил" when
    // master's display_name is empty or different).
    let fallbackQuery = admin
      .from('masters')
      .select(masterSelect)
      .eq('is_active', true);
    if (verticalFilter) {
      fallbackQuery = fallbackQuery.or(verticalOrClause(verticalFilter));
    }
    const fallback = await fallbackQuery.limit(200);
    const tokenList = tokens;
    const profileMatches = (fallback.data ?? []).filter((m: Record<string, unknown>) => {
      const p = Array.isArray(m.profile) ? m.profile[0] : m.profile;
      const fullName = ((p as { full_name?: string })?.full_name ?? '').toLowerCase();
      const displayName = ((m.display_name as string) ?? '').toLowerCase();
      const spec = ((m.specialization as string) ?? '').toLowerCase();
      const hay = `${fullName} ${displayName} ${spec}`;
      return tokenList.every((t) => hay.includes(t));
    });

    // Merge masters + profileMatches by id (de-dup)
    const seen = new Set(masters.map((m: Record<string, unknown>) => m.id as string));
    for (const m of profileMatches) {
      if (!seen.has(m.id as string)) {
        masters.push(m);
        seen.add(m.id as string);
      }
    }

    return NextResponse.json({ masters, salons: salonsRes.data ?? [] });
  }

  // Geo-based search — nearby masters & salons
  let geoMasters = admin
    .from('masters')
    .select(masterSelect)
    .eq('is_active', true)
    .gte('latitude', lat - RADIUS_DEG)
    .lte('latitude', lat + RADIUS_DEG)
    .gte('longitude', lng - RADIUS_DEG)
    .lte('longitude', lng + RADIUS_DEG);
  if (verticalFilter) {
    geoMasters = geoMasters.or(verticalOrClause(verticalFilter));
  }

  const [mastersRes, salonsRes] = await Promise.all([
    geoMasters.limit(50),
    admin
      .from('salons')
      .select('id, name, logo_url, address, city, rating, latitude, longitude')
      .gte('latitude', lat - RADIUS_DEG)
      .lte('latitude', lat + RADIUS_DEG)
      .gte('longitude', lng - RADIUS_DEG)
      .lte('longitude', lng + RADIUS_DEG)
      .limit(50),
  ]);

  let masters = mastersRes.data ?? [];
  const salons = salonsRes.data ?? [];

  // Fallback: if no nearby masters found, fetch all active masters regardless of location
  if (masters.length === 0) {
    let wide = admin
      .from('masters')
      .select(masterSelect)
      .eq('is_active', true);
    if (verticalFilter) {
      wide = wide.or(verticalOrClause(verticalFilter));
    }
    const fallback = await wide.limit(50);
    masters = fallback.data ?? [];
  }

  return NextResponse.json({ masters, salons });
}
