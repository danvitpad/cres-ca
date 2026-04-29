/** --- YAML
 * name: Contacts Search API
 * description: Универсальный поиск любого человека или команды в системе.
 *              GET ?q=<text>&limit=20
 *              Ищет по: имени/фамилии/имени+фамилии (любой порядок), email,
 *              номеру телефона (только цифры), cres-id (masters.invite_code),
 *              названию команды (salons.name).
 *              Возвращает unified карточки c type ('client'|'master'|'salon').
 *              isLinked = уже в моих контактах (если я мастер).
 * created: 2026-04-29
 * updated: 2026-04-29
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface ResultCard {
  id: string;            // dedup key
  type: 'client' | 'master' | 'salon';
  fullName: string;
  subtitle: string | null;
  avatarUrl: string | null;
  phone: string | null;
  email: string | null;
  isLinked: boolean;
  payload: {
    profileId?: string;
    masterId?: string;
    salonId?: string;
    inviteCode?: string | null;
  };
}

function normalizePhone(s: string): string {
  return s.replace(/\D/g, '');
}

function escLike(s: string): string {
  return s.replace(/([%,()\\])/g, '\\$1');
}

function tokenize(s: string): string[] {
  return s
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 0);
}

interface ProfileRow {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  email: string | null;
  role: string | null;
}

interface MasterRow {
  id: string;
  profile_id: string;
  display_name: string | null;
  specialization: string | null;
  city: string | null;
  avatar_url: string | null;
  invite_code: string | null;
}

interface SalonRow {
  id: string;
  owner_id: string;
  name: string;
  city: string | null;
  logo_url: string | null;
  phone: string | null;
  email: string | null;
}

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const raw = (searchParams.get('q') ?? '').trim();
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') ?? '20', 10), 1), 50);

    if (!raw || raw.length < 2) {
      return NextResponse.json({ results: [] });
    }

    const tokens = tokenize(raw);
    const phoneDigits = normalizePhone(raw);
    const isEmail = raw.includes('@');
    const isInviteCode = /^[0-9a-f]{4,}$/i.test(raw); // hex >= 4 chars

    // ====================================================================
    // 1. PROFILES — search by full_name (multi-word AND), phone, email
    // ====================================================================
    const profilePromises: Promise<{ data: ProfileRow[] | null }>[] = [];

    // Multi-word AND: each token must appear in full_name (handles "имя фамилия"
    // и "фамилия имя" равнозначно).
    if (tokens.length > 0) {
      let q = supabase.from('profiles').select('id, full_name, avatar_url, phone, email, role');
      for (const t of tokens) {
        q = q.ilike('full_name', `%${escLike(t)}%`);
      }
      profilePromises.push(q.limit(limit) as unknown as Promise<{ data: ProfileRow[] | null }>);
    }

    // Phone search (digits-only ilike — phone column may have +/-/spaces in stored format)
    if (phoneDigits.length >= 4) {
      profilePromises.push(
        supabase
          .from('profiles')
          .select('id, full_name, avatar_url, phone, email, role')
          .ilike('phone', `%${phoneDigits}%`)
          .limit(limit) as unknown as Promise<{ data: ProfileRow[] | null }>,
      );
    }

    // Email search
    if (isEmail) {
      profilePromises.push(
        supabase
          .from('profiles')
          .select('id, full_name, avatar_url, phone, email, role')
          .ilike('email', `%${escLike(raw.toLowerCase())}%`)
          .limit(limit) as unknown as Promise<{ data: ProfileRow[] | null }>,
      );
    }

    // ====================================================================
    // 2. MASTERS — search by display_name, specialization, invite_code
    //    (master profile also will be in profiles search, but we want to
    //     enrich with master fields and add by display_name match.)
    // ====================================================================
    const masterPromises: Promise<{ data: MasterRow[] | null }>[] = [];
    if (tokens.length > 0) {
      let q = supabase
        .from('masters')
        .select('id, profile_id, display_name, specialization, city, avatar_url, invite_code')
        .eq('is_active', true);
      for (const t of tokens) {
        // OR within the row across display_name + specialization for each token,
        // multiple tokens still AND'd through repeated .or() (each .or adds AND).
        q = q.or(`display_name.ilike.%${escLike(t)}%,specialization.ilike.%${escLike(t)}%`);
      }
      masterPromises.push(q.limit(limit) as unknown as Promise<{ data: MasterRow[] | null }>);
    }
    if (isInviteCode) {
      masterPromises.push(
        supabase
          .from('masters')
          .select('id, profile_id, display_name, specialization, city, avatar_url, invite_code')
          .eq('is_active', true)
          .eq('invite_code', raw.toLowerCase())
          .limit(limit) as unknown as Promise<{ data: MasterRow[] | null }>,
      );
    }

    // ====================================================================
    // 3. SALONS — search by name, city, phone, email
    // ====================================================================
    const salonPromises: Promise<{ data: SalonRow[] | null }>[] = [];
    if (tokens.length > 0) {
      let q = supabase.from('salons').select('id, owner_id, name, city, logo_url, phone, email');
      for (const t of tokens) {
        q = q.or(`name.ilike.%${escLike(t)}%,city.ilike.%${escLike(t)}%`);
      }
      salonPromises.push(q.limit(limit) as unknown as Promise<{ data: SalonRow[] | null }>);
    }
    if (phoneDigits.length >= 4) {
      salonPromises.push(
        supabase
          .from('salons')
          .select('id, owner_id, name, city, logo_url, phone, email')
          .ilike('phone', `%${phoneDigits}%`)
          .limit(limit) as unknown as Promise<{ data: SalonRow[] | null }>,
      );
    }
    if (isEmail) {
      salonPromises.push(
        supabase
          .from('salons')
          .select('id, owner_id, name, city, logo_url, phone, email')
          .ilike('email', `%${escLike(raw.toLowerCase())}%`)
          .limit(limit) as unknown as Promise<{ data: SalonRow[] | null }>,
      );
    }

    // Run all in parallel
    const [profileResults, masterResults, salonResults] = await Promise.all([
      Promise.all(profilePromises),
      Promise.all(masterPromises),
      Promise.all(salonPromises),
    ]);

    // ====================================================================
    // Merge profiles
    // ====================================================================
    const profileById = new Map<string, ProfileRow>();
    for (const r of profileResults) {
      for (const p of (r.data ?? [])) {
        if (p.id === user.id) continue; // не себя
        if (!profileById.has(p.id)) profileById.set(p.id, p);
      }
    }

    // ====================================================================
    // Merge masters — also pull profile_ids of these masters
    // ====================================================================
    const mastersByProfileId = new Map<string, MasterRow>();
    const masterProfileIds = new Set<string>();
    for (const r of masterResults) {
      for (const m of (r.data ?? [])) {
        if (m.profile_id === user.id) continue;
        if (!mastersByProfileId.has(m.profile_id)) {
          mastersByProfileId.set(m.profile_id, m);
          masterProfileIds.add(m.profile_id);
        }
      }
    }

    // Master profiles that weren't already in profileById need fetching
    const missingMasterProfileIds = [...masterProfileIds].filter((id) => !profileById.has(id));
    if (missingMasterProfileIds.length > 0) {
      const { data: extraProfiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, phone, email, role')
        .in('id', missingMasterProfileIds);
      for (const p of (extraProfiles ?? []) as ProfileRow[]) {
        profileById.set(p.id, p);
      }
    }

    // For ALL profiles in result, also check if they are masters (enrichment)
    // — if not already in mastersByProfileId.
    const profileIds = [...profileById.keys()];
    if (profileIds.length > 0) {
      const missingMasterCheck = profileIds.filter((id) => !mastersByProfileId.has(id));
      if (missingMasterCheck.length > 0) {
        const { data: enrichMasters } = await supabase
          .from('masters')
          .select('id, profile_id, display_name, specialization, city, avatar_url, invite_code')
          .in('profile_id', missingMasterCheck)
          .eq('is_active', true);
        for (const m of (enrichMasters ?? []) as MasterRow[]) {
          mastersByProfileId.set(m.profile_id, m);
        }
      }
    }

    // ====================================================================
    // Build cards
    // ====================================================================
    const cards: ResultCard[] = [];

    // Profile cards (each profile may also be a master → enriched type)
    for (const [profileId, p] of profileById) {
      const master = mastersByProfileId.get(profileId);
      if (master) {
        cards.push({
          id: `master:${master.id}`,
          type: 'master',
          fullName: master.display_name || p.full_name || 'Мастер',
          subtitle: master.specialization || master.city || (p.full_name && master.display_name ? p.full_name : null),
          avatarUrl: master.avatar_url || p.avatar_url,
          phone: p.phone,
          email: p.email,
          isLinked: false,
          payload: { profileId, masterId: master.id, inviteCode: master.invite_code },
        });
      } else {
        cards.push({
          id: `profile:${profileId}`,
          type: 'client',
          fullName: p.full_name || 'Без имени',
          subtitle: p.phone || p.email || null,
          avatarUrl: p.avatar_url,
          phone: p.phone,
          email: p.email,
          isLinked: false,
          payload: { profileId },
        });
      }
    }

    // Salon cards
    const seenSalons = new Set<string>();
    for (const r of salonResults) {
      for (const s of (r.data ?? [])) {
        if (seenSalons.has(s.id)) continue;
        seenSalons.add(s.id);
        cards.push({
          id: `salon:${s.id}`,
          type: 'salon',
          fullName: s.name,
          subtitle: s.city,
          avatarUrl: s.logo_url,
          phone: s.phone,
          email: s.email,
          isLinked: false,
          payload: { salonId: s.id, profileId: s.owner_id },
        });
      }
    }

    // ====================================================================
    // isLinked: пометить тех, кто уже в clients у текущего юзера-мастера
    // ====================================================================
    if (cards.length > 0) {
      const { data: myMaster } = await supabase
        .from('masters')
        .select('id')
        .eq('profile_id', user.id)
        .maybeSingle();

      if (myMaster?.id) {
        const allProfileIds = cards.map((c) => c.payload.profileId).filter(Boolean) as string[];
        if (allProfileIds.length > 0) {
          const { data: linked } = await supabase
            .from('clients')
            .select('profile_id')
            .eq('master_id', myMaster.id)
            .in('profile_id', allProfileIds);
          const linkedSet = new Set((linked ?? []).map((l) => l.profile_id as string));
          for (const c of cards) {
            if (c.payload.profileId && linkedSet.has(c.payload.profileId)) {
              c.isLinked = true;
            }
          }
        }
      }
    }

    // ====================================================================
    // Sorting: exact full name match → starts-with → ranked by relevance
    // ====================================================================
    const ql = raw.toLowerCase();
    cards.sort((a, b) => {
      const aN = a.fullName.toLowerCase();
      const bN = b.fullName.toLowerCase();
      const aExact = aN === ql ? 0 : 1;
      const bExact = bN === ql ? 0 : 1;
      if (aExact !== bExact) return aExact - bExact;
      const aStarts = aN.startsWith(ql) ? 0 : 1;
      const bStarts = bN.startsWith(ql) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
      return aN.localeCompare(bN);
    });

    return NextResponse.json({ results: cards.slice(0, limit) });
  } catch (err) {
    console.error('Contacts search error:', err);
    return NextResponse.json({ error: 'search_failed', detail: String(err) }, { status: 500 });
  }
}
