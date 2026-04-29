/** --- YAML
 * name: Contacts Search API
 * description: Универсальный поиск для добавления в контакты.
 *              GET ?q=<text>&scope=client|master|salon|partners|all&limit=20
 *              Ищет по: имени/фамилии (full_name ilike), email, phone (digits-only),
 *              cres-id (masters.invite_code exact), названию команды (salons.name).
 *              scope=client: только client-профили (для master/salon добавляющих клиента).
 *              scope=partners: только мастера (для master ищущего партнёра).
 *              scope=salon: только команды.
 *              scope=all: всё подряд.
 *              Возвращает карточки с isLinked (уже в моих контактах).
 * created: 2026-04-29
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface ResultCard {
  id: string;
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

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const raw = (searchParams.get('q') ?? '').trim();
    const scope = (searchParams.get('scope') ?? 'client') as 'client' | 'master' | 'salon' | 'partners' | 'all';
    const limitParam = parseInt(searchParams.get('limit') ?? '20', 10);
    const limit = Math.min(Math.max(limitParam, 1), 50);

    if (!raw || raw.length < 2) {
      return NextResponse.json({ results: [] });
    }

    const q = escLike(raw);
    const ql = raw.toLowerCase();
    const phoneDigits = normalizePhone(raw);
    const isEmail = ql.includes('@');
    // cres-id (master invite_code) — hex 6+ chars
    const isInviteCode = /^[0-9a-f]{6,}$/i.test(raw);

    const cards: ResultCard[] = [];
    const seen = new Set<string>();

    // --- SEARCH MASTERS (for partners tab + general "find master") ---
    if (scope === 'master' || scope === 'partners' || scope === 'all') {
      const orFilters = [`display_name.ilike.%${q}%`, `specialization.ilike.%${q}%`];
      if (isInviteCode) orFilters.push(`invite_code.eq.${raw.toLowerCase()}`);

      const queries = [
        supabase
          .from('masters')
          .select('id, profile_id, display_name, specialization, city, avatar_url, invite_code, profile:profiles!masters_profile_id_fkey(id, full_name, avatar_url, phone, email)')
          .eq('is_active', true)
          .or(orFilters.join(','))
          .limit(limit),
        supabase
          .from('masters')
          .select('id, profile_id, display_name, specialization, city, avatar_url, invite_code, profile:profiles!masters_profile_id_fkey(id, full_name, avatar_url, phone, email)')
          .eq('is_active', true)
          .ilike('profile.full_name', `%${q}%`)
          .limit(limit),
      ];
      if (phoneDigits.length >= 4) {
        queries.push(
          supabase
            .from('masters')
            .select('id, profile_id, display_name, specialization, city, avatar_url, invite_code, profile:profiles!masters_profile_id_fkey(id, full_name, avatar_url, phone, email)')
            .eq('is_active', true)
            .ilike('profile.phone', `%${phoneDigits}%`)
            .limit(limit),
        );
      }
      if (isEmail) {
        queries.push(
          supabase
            .from('masters')
            .select('id, profile_id, display_name, specialization, city, avatar_url, invite_code, profile:profiles!masters_profile_id_fkey(id, full_name, avatar_url, phone, email)')
            .eq('is_active', true)
            .ilike('profile.email', `%${q}%`)
            .limit(limit),
        );
      }

      type MasterRow = {
        id: string;
        profile_id: string;
        display_name: string | null;
        specialization: string | null;
        city: string | null;
        avatar_url: string | null;
        invite_code: string | null;
        profile: { id: string; full_name: string | null; avatar_url: string | null; phone: string | null; email: string | null } | { id: string; full_name: string | null; avatar_url: string | null; phone: string | null; email: string | null }[] | null;
      };
      const responses = await Promise.all(queries);
      for (const resp of responses) {
        for (const m of (resp.data ?? []) as unknown as MasterRow[]) {
          const key = `master:${m.id}`;
          if (seen.has(key)) continue;
          seen.add(key);
          if (m.profile_id === user.id) continue;
          const p = Array.isArray(m.profile) ? m.profile[0] : m.profile;
          cards.push({
            id: m.id,
            type: 'master',
            fullName: m.display_name || p?.full_name || 'Мастер',
            subtitle: m.specialization || m.city || null,
            avatarUrl: m.avatar_url || p?.avatar_url || null,
            phone: p?.phone ?? null,
            email: p?.email ?? null,
            isLinked: false,
            payload: { profileId: m.profile_id, masterId: m.id, inviteCode: m.invite_code },
          });
        }
      }
    }

    // --- SEARCH SALONS ---
    if (scope === 'salon' || scope === 'all') {
      const orFilters = [`name.ilike.%${q}%`, `city.ilike.%${q}%`];
      if (phoneDigits.length >= 4) orFilters.push(`phone.ilike.%${phoneDigits}%`);
      if (isEmail) orFilters.push(`email.ilike.%${q}%`);

      const { data: salonRows } = await supabase
        .from('salons')
        .select('id, owner_id, name, city, logo_url, phone, email')
        .or(orFilters.join(','))
        .limit(limit);

      for (const s of (salonRows ?? []) as Array<{ id: string; owner_id: string; name: string; city: string | null; logo_url: string | null; phone: string | null; email: string | null }>) {
        const key = `salon:${s.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        cards.push({
          id: s.id,
          type: 'salon',
          fullName: s.name,
          subtitle: s.city || null,
          avatarUrl: s.logo_url,
          phone: s.phone,
          email: s.email,
          isLinked: false,
          payload: { salonId: s.id, profileId: s.owner_id },
        });
      }
    }

    // --- SEARCH CLIENT PROFILES (для master/salon добавляющего клиента) ---
    if (scope === 'client' || scope === 'all') {
      const queries = [
        supabase
          .from('profiles')
          .select('id, full_name, avatar_url, phone, email, role')
          .eq('role', 'client')
          .ilike('full_name', `%${q}%`)
          .limit(limit),
      ];
      if (phoneDigits.length >= 4) {
        queries.push(
          supabase
            .from('profiles')
            .select('id, full_name, avatar_url, phone, email, role')
            .eq('role', 'client')
            .ilike('phone', `%${phoneDigits}%`)
            .limit(limit),
        );
      }
      if (isEmail) {
        queries.push(
          supabase
            .from('profiles')
            .select('id, full_name, avatar_url, phone, email, role')
            .eq('role', 'client')
            .ilike('email', `%${q}%`)
            .limit(limit),
        );
      }

      const responses = await Promise.all(queries);
      for (const resp of responses) {
        for (const p of (resp.data ?? []) as Array<{ id: string; full_name: string | null; avatar_url: string | null; phone: string | null; email: string | null }>) {
          const key = `client:${p.id}`;
          if (seen.has(key)) continue;
          seen.add(key);
          if (p.id === user.id) continue;
          cards.push({
            id: p.id,
            type: 'client',
            fullName: p.full_name || 'Клиент',
            subtitle: p.phone || p.email || null,
            avatarUrl: p.avatar_url,
            phone: p.phone,
            email: p.email,
            isLinked: false,
            payload: { profileId: p.id },
          });
        }
      }
    }

    // --- isLinked ---
    // Для каждого master (текущего юзера) — ищем какие клиенты уже в его CRM,
    // помечаем чтобы UI показал «Уже в контактах» вместо «Добавить».
    if (cards.length > 0) {
      // Find current user's master id (если он мастер).
      const { data: myMaster } = await supabase
        .from('masters')
        .select('id')
        .eq('profile_id', user.id)
        .maybeSingle();

      if (myMaster?.id) {
        const profileIds = cards.filter((c) => c.payload.profileId).map((c) => c.payload.profileId!) as string[];
        if (profileIds.length > 0) {
          const { data: linked } = await supabase
            .from('clients')
            .select('profile_id')
            .eq('master_id', myMaster.id)
            .in('profile_id', profileIds);
          const linkedSet = new Set((linked ?? []).map((l) => l.profile_id as string));
          for (const c of cards) {
            if (c.payload.profileId && linkedSet.has(c.payload.profileId)) {
              c.isLinked = true;
            }
          }
        }
      }
    }

    // Sort: exact-name match → invite_code match → others
    const queryLower = ql;
    cards.sort((a, b) => {
      const aExact = a.fullName.toLowerCase() === queryLower ? 0 : 1;
      const bExact = b.fullName.toLowerCase() === queryLower ? 0 : 1;
      if (aExact !== bExact) return aExact - bExact;
      const aStarts = a.fullName.toLowerCase().startsWith(queryLower) ? 0 : 1;
      const bStarts = b.fullName.toLowerCase().startsWith(queryLower) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
      return 0;
    });

    return NextResponse.json({ results: cards.slice(0, limit) });
  } catch (err) {
    console.error('Contacts search error:', err);
    return NextResponse.json({ error: 'search_failed', detail: String(err) }, { status: 500 });
  }
}
