/** --- YAML
 * name: Global Search
 * description: GET ?q=<text>&filter=all|client|master|salon&limit=20 → searches all entities with type badges.
 * created: 2026-04-16
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const raw = (searchParams.get('q') ?? '').trim();
  const filter = searchParams.get('filter') ?? 'all';
  const limitParam = parseInt(searchParams.get('limit') ?? '20', 10);
  const limit = Math.min(Math.max(limitParam, 1), 50);

  if (!raw || raw.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const q = raw.replace(/([%,()])/g, '\\$1');
  const phoneQ = raw.replace(/[^\d+]/g, '');

  // Search profiles
  const results: Array<{
    profileId: string;
    fullName: string;
    avatarUrl: string | null;
    entityType: 'client' | 'master' | 'salon';
    entityMeta: Record<string, unknown> | null;
    isFollowing: boolean;
  }> = [];

  const seen = new Set<string>();

  // Search masters (if filter allows)
  if (filter === 'all' || filter === 'master') {
    const queries = [
      supabase
        .from('masters')
        .select('id, profile_id, display_name, specialization, city, avatar_url, rating, profiles!inner(id, full_name, avatar_url, phone, email)')
        .eq('is_active', true)
        .or(`display_name.ilike.%${q}%,specialization.ilike.%${q}%,city.ilike.%${q}%,invite_code.eq.${q}`)
        .limit(limit),
      supabase
        .from('masters')
        .select('id, profile_id, display_name, specialization, city, avatar_url, rating, profiles!inner(id, full_name, avatar_url, phone, email)')
        .eq('is_active', true)
        .ilike('profiles.full_name', `%${q}%`)
        .limit(limit),
    ];

    if (phoneQ.length >= 3) {
      queries.push(
        supabase
          .from('masters')
          .select('id, profile_id, display_name, specialization, city, avatar_url, rating, profiles!inner(id, full_name, avatar_url, phone, email)')
          .eq('is_active', true)
          .ilike('profiles.phone', `%${phoneQ}%`)
          .limit(limit),
      );
    }

    const responses = await Promise.all(queries);
    for (const resp of responses) {
      for (const m of (resp.data ?? []) as unknown as Array<{
        id: string; profile_id: string; display_name: string | null;
        specialization: string | null; city: string | null;
        avatar_url: string | null; rating: number;
        profiles: { id: string; full_name: string; avatar_url: string | null };
      }>) {
        if (seen.has(m.profile_id)) continue;
        seen.add(m.profile_id);
        results.push({
          profileId: m.profile_id,
          fullName: m.display_name || m.profiles.full_name,
          avatarUrl: m.avatar_url || m.profiles.avatar_url,
          entityType: 'master',
          entityMeta: { masterId: m.id, specialization: m.specialization, city: m.city, rating: m.rating },
          isFollowing: false,
        });
      }
    }
  }

  // Search salons (if filter allows)
  if (filter === 'all' || filter === 'salon') {
    const { data: salonRows } = await supabase
      .from('salons')
      .select('id, owner_id, name, city, logo_url, phone, email')
      .or(`name.ilike.%${q}%,city.ilike.%${q}%${phoneQ.length >= 3 ? `,phone.ilike.%${phoneQ}%` : ''}`)
      .limit(limit);

    for (const s of (salonRows ?? [])) {
      if (seen.has(s.owner_id)) continue;
      seen.add(s.owner_id);
      results.push({
        profileId: s.owner_id,
        fullName: s.name,
        avatarUrl: s.logo_url,
        entityType: 'salon',
        entityMeta: { salonId: s.id, city: s.city },
        isFollowing: false,
      });
    }
  }

  // Search client profiles (if filter allows)
  if (filter === 'all' || filter === 'client') {
    const clientQueries = [
      supabase
        .from('profiles')
        .select('id, full_name, avatar_url, role, phone, email')
        .eq('role', 'client')
        .ilike('full_name', `%${q}%`)
        .limit(limit),
    ];

    if (phoneQ.length >= 3) {
      clientQueries.push(
        supabase
          .from('profiles')
          .select('id, full_name, avatar_url, role, phone, email')
          .eq('role', 'client')
          .ilike('phone', `%${phoneQ}%`)
          .limit(limit),
      );
    }

    if (q.includes('@')) {
      clientQueries.push(
        supabase
          .from('profiles')
          .select('id, full_name, avatar_url, role, phone, email')
          .eq('role', 'client')
          .ilike('email', `%${q}%`)
          .limit(limit),
      );
    }

    const responses = await Promise.all(clientQueries);
    for (const resp of responses) {
      for (const p of (resp.data ?? [])) {
        if (seen.has(p.id)) continue;
        seen.add(p.id);
        results.push({
          profileId: p.id,
          fullName: p.full_name || '',
          avatarUrl: p.avatar_url,
          entityType: 'client',
          entityMeta: null,
          isFollowing: false,
        });
      }
    }
  }

  // Check which ones the current user follows
  if (results.length > 0) {
    const profileIds = results.map(r => r.profileId);
    const { data: myFollows } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', user.id)
      .in('following_id', profileIds);

    const followingSet = new Set((myFollows ?? []).map(f => f.following_id));
    for (const r of results) {
      r.isFollowing = followingSet.has(r.profileId);
    }
  }

  // Trim to limit
  return NextResponse.json({ results: results.slice(0, limit) });
}
