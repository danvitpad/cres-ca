/** --- YAML
 * name: My Contacts API
 * description: GET — возвращает мои контакты для Mini App: подписанные мастера, салоны и взаимные друзья.
 *              Использует TG initData auth (Mini App не имеет cookie-сессии Supabase).
 * created: 2026-04-25
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { validateInitData } from '@/lib/telegram/validate-init-data';


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

  // Followed masters via client_master_links
  const { data: cmls } = await supabase
    .from('client_master_links')
    .select('master_id')
    .eq('profile_id', viewer.id);

  const masterIds = ((cmls ?? []) as Array<{ master_id: string }>).map((c) => c.master_id);

  let masters: Array<{
    id: string;
    name: string | null;
    avatar: string | null;
    city: string | null;
    rating: number | null;
    specialization: string | null;
    salonName: string | null;
  }> = [];

  if (masterIds.length > 0) {
    const { data: masterRows } = await supabase
      .from('masters')
      .select(
        'id, specialization, rating, city, display_name, avatar_url, profiles:profiles!masters_profile_id_fkey(full_name, avatar_url), salon:salons(name)',
      )
      .in('id', masterIds);

    type MasterRow = {
      id: string;
      specialization: string | null;
      rating: number | null;
      city: string | null;
      display_name: string | null;
      avatar_url: string | null;
      profiles: { full_name: string | null; avatar_url: string | null } | { full_name: string | null; avatar_url: string | null }[] | null;
      salon: { name: string | null } | { name: string | null }[] | null;
    };

    masters = ((masterRows ?? []) as MasterRow[]).map((m) => {
      const profile = Array.isArray(m.profiles) ? m.profiles[0] ?? null : m.profiles;
      const salon = Array.isArray(m.salon) ? m.salon[0] ?? null : m.salon;
      return {
        id: m.id,
        name: m.display_name ?? profile?.full_name ?? null,
        avatar: m.avatar_url ?? profile?.avatar_url ?? null,
        city: m.city,
        rating: m.rating,
        specialization: m.specialization,
        salonName: salon?.name ?? null,
      };
    });
  }

  // Salons + friends from `follows` (universal profile↔profile follow)
  const { data: follows } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', viewer.id)
    .order('created_at', { ascending: false })
    .limit(500);

  const followedIds = ((follows ?? []) as Array<{ following_id: string }>).map((f) => f.following_id).filter(Boolean);

  let salons: Array<{ id: string; name: string; logo: string | null; city: string | null; rating: number | null }> = [];
  let friends: Array<{ id: string; name: string | null; avatar: string | null; publicId: string | null; slug: string | null }> = [];

  if (followedIds.length > 0) {
    const [salonsRes, profilesRes, mutualsRes, masterProfilesRes] = await Promise.all([
      supabase
        .from('salons')
        .select('id, name, logo_url, city, rating, owner_id')
        .in('owner_id', followedIds),
      supabase
        .from('profiles')
        .select('id, full_name, avatar_url, public_id, slug, role')
        .in('id', followedIds),
      supabase
        .from('follows')
        .select('follower_id')
        .eq('following_id', viewer.id)
        .in('follower_id', followedIds),
      supabase.from('masters').select('profile_id').in('profile_id', followedIds),
    ]);

    type SalonRow = { id: string; name: string; logo_url: string | null; city: string | null; rating: number | null; owner_id: string };
    salons = ((salonsRes.data ?? []) as SalonRow[]).map((s) => ({
      id: s.id,
      name: s.name,
      logo: s.logo_url,
      city: s.city,
      rating: s.rating,
    }));

    const salonOwnerIds = new Set(((salonsRes.data ?? []) as Array<{ owner_id: string }>).map((s) => s.owner_id));
    const masterProfileIds = new Set(((masterProfilesRes.data ?? []) as Array<{ profile_id: string }>).map((m) => m.profile_id));
    const mutualIds = new Set(((mutualsRes.data ?? []) as Array<{ follower_id: string }>).map((r) => r.follower_id));

    type ProfRow = { id: string; full_name: string | null; avatar_url: string | null; public_id: string | null; slug: string | null; role: string | null };
    friends = ((profilesRes.data ?? []) as ProfRow[])
      .filter((p) => mutualIds.has(p.id) && !salonOwnerIds.has(p.id) && !masterProfileIds.has(p.id))
      .map((p) => ({
        id: p.id,
        name: p.full_name,
        avatar: p.avatar_url,
        publicId: p.public_id,
        slug: p.slug,
      }));
  }

  return NextResponse.json({ masters, salons, friends });
}
