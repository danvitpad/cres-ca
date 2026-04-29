/** --- YAML
 * name: MiniAppSalonDetail
 * description: Mini App salon profile — logo, description, address, phone, team members list. Flat cards (Phase 7.16).
 * created: 2026-04-13
 * updated: 2026-04-18
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, MapPin, Phone, Loader2, Users, Heart, HeartOff } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useTelegram } from '@/components/miniapp/telegram-provider';

interface SalonRow {
  id: string;
  name: string;
  description: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  logo_url: string | null;
  owner_id: string;
}

interface TeamMember {
  id: string;
  display_name: string | null;
  specialization: string | null;
  avatar_url: string | null;
  full_name: string | null;
}

export default function MiniAppSalonDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { haptic } = useTelegram();
  const [salon, setSalon] = useState<SalonRow | null>(null);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [following, setFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);

  useEffect(() => {
    if (!params?.id) return;
    const supabase = createClient();
    (async () => {
      const { data } = await supabase
        .from('salons')
        .select('id, owner_id, name, description, address, city, phone, logo_url')
        .eq('id', params.id)
        .maybeSingle();
      if (!data) {
        setLoading(false);
        return;
      }
      setSalon(data as SalonRow);

      // Team = masters whose profile.owner_id === salon.owner_id (best effort)
      const { data: teamRows } = await supabase
        .from('masters')
        .select('id, display_name, specialization, avatar_url, profile:profiles!masters_profile_id_fkey(full_name)')
        .eq('is_active', true)
        .limit(20);
      const members: TeamMember[] = (teamRows ?? []).map((row: unknown) => {
        const r = row as {
          id: string;
          display_name: string | null;
          specialization: string | null;
          avatar_url: string | null;
          profile: { full_name: string } | { full_name: string }[] | null;
        };
        const p = Array.isArray(r.profile) ? r.profile[0] : r.profile;
        return {
          id: r.id,
          display_name: r.display_name,
          specialization: r.specialization,
          avatar_url: r.avatar_url,
          full_name: p?.full_name ?? null,
        };
      });
      setTeam(members);

      const { data: { user } } = await supabase.auth.getUser();
      setViewerId(user?.id ?? null);
      if (user) {
        const { data: f } = await supabase
          .from('salon_follows')
          .select('id')
          .eq('profile_id', user.id)
          .eq('salon_id', params.id)
          .maybeSingle();
        setFollowing(Boolean(f));
      }

      setLoading(false);
    })();
  }, [params?.id]);

  async function toggleFollow() {
    if (!viewerId || !params?.id || followBusy) return;
    haptic('selection');
    setFollowBusy(true);
    try {
      const res = await fetch(`/api/salon/${params.id}/follow`, {
        method: following ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const j = (await res.json()) as { following: boolean };
        setFollowing(j.following);
      }
    } finally {
      setFollowBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (!salon) {
    return <div className="px-5 pt-10 text-center"><p className="text-sm text-neutral-600">Салон не найден</p></div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6 px-5 pt-6 pb-10"
    >
      <button
        onClick={() => { haptic('light'); router.back(); }}
        className="flex size-9 items-center justify-center rounded-xl border border-neutral-200 bg-white border-neutral-200 active:bg-neutral-50 transition-colors"
      >
        <ArrowLeft className="size-4" />
      </button>

      <div className="flex items-start gap-4">
        <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50 text-2xl font-bold text-neutral-900">
          {salon.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={salon.logo_url} alt={salon.name} className="size-full object-cover" />
          ) : (
            salon.name[0] ?? 'S'
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold">{salon.name}</h1>
          <p className="mt-0.5 text-[11px] uppercase tracking-wide text-neutral-500">Салон · команда</p>
          {salon.city && (
            <div className="mt-2 flex items-center gap-1 text-[12px] text-neutral-700">
              <MapPin className="size-3" />
              <span className="truncate">{salon.city}</span>
            </div>
          )}
        </div>
      </div>

      {salon.owner_id !== viewerId && (
        <button
          onClick={toggleFollow}
          disabled={followBusy}
          className={`flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-[14px] font-semibold transition-colors disabled:opacity-60 ${
            following
              ? 'bg-neutral-100 text-neutral-900 active:bg-neutral-200'
              : 'bg-neutral-900 text-white active:bg-neutral-800'
          }`}
        >
          {followBusy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : following ? (
            <HeartOff className="size-4" />
          ) : (
            <Heart className="size-4" />
          )}
          {following ? 'В контактах' : 'В контакты'}
        </button>
      )}

      {salon.description && (
        <p className="rounded-2xl border border-neutral-200 bg-white border-neutral-200 p-4 text-[13px] leading-relaxed text-neutral-700">
          {salon.description}
        </p>
      )}

      {salon.address && (
        <div className="rounded-2xl border border-neutral-200 bg-white border-neutral-200 p-4">
          <p className="text-[10px] uppercase tracking-wide text-neutral-400">Адрес</p>
          <p className="mt-1 text-sm">{salon.address}</p>
        </div>
      )}

      {salon.phone && (
        <a
          href={`tel:${salon.phone}`}
          onClick={() => haptic('selection')}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-neutral-200 bg-white border-neutral-200 py-4 text-sm font-semibold active:bg-neutral-50 transition-colors"
        >
          <Phone className="size-4" /> {salon.phone}
        </a>
      )}

      {team.length > 0 && (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <Users className="size-4 text-neutral-600" />
            <h2 className="text-sm font-semibold">Команда</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {team.map((m) => {
              const mname = m.display_name ?? m.full_name ?? '—';
              return (
                <button
                  key={m.id}
                  onClick={() => { haptic('light'); router.push(`/telegram/search/${m.id}`); }}
                  className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white border-neutral-200 p-3 text-left active:bg-neutral-50 transition-colors"
                >
                  <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-neutral-200 bg-neutral-50 text-sm font-bold text-neutral-900">
                    {m.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.avatar_url} alt={mname} className="size-full object-cover" />
                    ) : (
                      mname[0] ?? 'M'
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[12px] font-semibold">{mname}</p>
                    {m.specialization && (
                      <p className="truncate text-[10px] text-neutral-500">{m.specialization}</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </motion.div>
  );
}
