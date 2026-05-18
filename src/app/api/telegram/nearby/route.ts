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

export const dynamic = 'force-dynamic';
const NO_STORE = { headers: { 'Cache-Control': 'no-store' } } as const;
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
  const { lat, lng, q, terms, vertical, categoryKey, subcategoryKey } = await request.json();

  const hasCoords = typeof lat === 'number' && typeof lng === 'number';
  const hasQuery = typeof q === 'string' && q.trim().length >= 2;
  // `terms` — массив синонимов категории (OR ilike по specialization).
  // Используется когда юзер тапнул на категорию на главной (hair → ['волос',
  // 'парикмахер', 'перукар', 'barber'...]) — без него мастер с specialization
  // 'Парикмахер' не попадал в 'волос' / 'hair' категорию.
  const termsArr: string[] = Array.isArray(terms)
    ? (terms as unknown[]).filter((x): x is string => typeof x === 'string' && x.length > 0)
    : [];
  const hasTerms = termsArr.length > 0;
  const verticalFilter = isValidVertical(vertical) ? vertical : null;
  const catKey = typeof categoryKey === 'string' && categoryKey.length > 0 ? categoryKey : null;
  const subKey = typeof subcategoryKey === 'string' && subcategoryKey.length > 0 ? subcategoryKey : null;

  if (!hasCoords && !hasQuery && !hasTerms && !catKey && !subKey) {
    return NextResponse.json({ error: 'invalid_params' }, { status: 400, ...NO_STORE });
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  // Если задан categoryKey/subcategoryKey — заранее тянем master_id's из новой
  // структуры. Применим как .in('id', allowedIds) ко всем masters-запросам.
  let allowedMasterIds: string[] | null = null;
  if (catKey || subKey) {
    if (subKey) {
      const { data: subRow } = await admin
        .from('industry_subcategories')
        .select('id')
        .eq('key', subKey)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle();
      if (subRow?.id) {
        const { data: rows } = await admin
          .from('master_industry_subcategories')
          .select('master_id')
          .eq('subcategory_id', subRow.id);
        allowedMasterIds = (rows ?? []).map(r => r.master_id);
      } else {
        allowedMasterIds = [];
      }
    } else if (catKey) {
      const { data: catRow } = await admin
        .from('industry_categories')
        .select('id')
        .eq('key', catKey)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle();
      if (catRow?.id) {
        const { data: rows } = await admin
          .from('master_industry_categories')
          .select('master_id')
          .eq('category_id', catRow.id);
        allowedMasterIds = (rows ?? []).map(r => r.master_id);
      } else {
        allowedMasterIds = [];
      }
    }
    // Пусто → нечего показывать
    if (allowedMasterIds && allowedMasterIds.length === 0) {
      return NextResponse.json({ masters: [], salons: [] }, NO_STORE);
    }
  }

  // FK-explicit embeds: services has two FKs to masters (master_id + recommended_master_id),
  // so PostgREST refuses to auto-pick. salon:salons uses masters.salon_id (single FK, but
  // we still name it for clarity).
  const masterSelect =
    'id, specialization, rating, salon_id, latitude, longitude, address, city, workplace_name, display_name, avatar_url, vertical, profile:profiles!masters_profile_id_fkey(full_name), salon:salons!masters_salon_id_fkey(id, name, logo_url, city), services:services!services_master_id_fkey(price)';

  // Name-based search — multi-word AND (ловит «имя фамилия» И «фамилия имя»).
  if (hasQuery) {
    const tokens = q.trim().toLowerCase().split(/\s+/).filter(Boolean);

    // Query 1: search masters by display_name / specialization / city
    let mastersQuery = admin.from('masters').select(masterSelect).eq('is_active', true);
    if (allowedMasterIds) {
      mastersQuery = mastersQuery.in('id', allowedMasterIds);
    } else if (verticalFilter) {
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

    // Query 2: search profiles by full_name — OR across tokens at DB level (reliable),
    // then AND-filter in JS. Catches masters whose display_name is null/empty.
    const profileOrCond = tokens.map((t) => `full_name.ilike.%${escLike(t)}%`).join(',');
    const profilesQuery = admin.from('profiles').select('id,full_name').or(profileOrCond).limit(100);

    const [mastersRes, salonsRes, profilesRes] = await Promise.all([
      mastersQuery.limit(30),
      salonsQuery.limit(30),
      profilesQuery,
    ]);

    let masters = mastersRes.data ?? [];

    // JS AND-filter: all tokens must appear in full_name
    const profileIds = (profilesRes.data ?? [])
      .filter((p: { id: string; full_name: string | null }) => {
        const name = (p.full_name ?? '').toLowerCase();
        return tokens.every((t) => name.includes(t));
      })
      .map((p: { id: string }) => p.id);

    if (profileIds.length > 0) {
      let profileMastersQuery = admin
        .from('masters')
        .select(masterSelect)
        .eq('is_active', true)
        .in('profile_id', profileIds);
      if (allowedMasterIds) {
        profileMastersQuery = profileMastersQuery.in('id', allowedMasterIds);
      } else if (verticalFilter) {
        profileMastersQuery = profileMastersQuery.or(verticalOrClause(verticalFilter));
      }
      const profileMastersRes = await profileMastersQuery.limit(30);
      const seen = new Set(masters.map((m: Record<string, unknown>) => m.id as string));
      for (const m of profileMastersRes.data ?? []) {
        if (!seen.has(m.id as string)) {
          masters.push(m);
          seen.add(m.id as string);
        }
      }
    }

    return NextResponse.json({ masters, salons: salonsRes.data ?? [] }, NO_STORE);
  }

  // Geo-based search — nearby masters & salons.
  // hasCoords может быть false (юзер не дал гео + категория ?cat=hair), тогда
  // координаты пропускаем — поиск идёт только по terms через wide fallback ниже.
  let geoMasters = admin
    .from('masters')
    .select(masterSelect)
    .eq('is_active', true);
  if (hasCoords) {
    geoMasters = geoMasters
      .gte('latitude', lat - RADIUS_DEG)
      .lte('latitude', lat + RADIUS_DEG)
      .gte('longitude', lng - RADIUS_DEG)
      .lte('longitude', lng + RADIUS_DEG);
  }
  if (allowedMasterIds) {
    geoMasters = geoMasters.in('id', allowedMasterIds);
  } else if (verticalFilter) {
    geoMasters = geoMasters.or(verticalOrClause(verticalFilter));
  }
  // OR-фильтр по terms — мастер попадает если specialization содержит хотя
  // бы один из синонимов (`%парикмахер%`, `%волос%` и т.д.).
  if (hasTerms) {
    const orClause = termsArr.map((t) => `specialization.ilike.%${escLike(t)}%`).join(',');
    geoMasters = geoMasters.or(orClause);
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
    if (allowedMasterIds) {
      wide = wide.in('id', allowedMasterIds);
    } else if (verticalFilter) {
      wide = wide.or(verticalOrClause(verticalFilter));
    }
    if (hasTerms) {
      const orClause = termsArr.map((t) => `specialization.ilike.%${escLike(t)}%`).join(',');
      wide = wide.or(orClause);
    }
    const fallback = await wide.limit(50);
    masters = fallback.data ?? [];
  }

  return NextResponse.json({ masters, salons }, NO_STORE);
}
