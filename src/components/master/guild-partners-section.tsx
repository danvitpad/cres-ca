/** --- YAML
 * name: GuildPartnersSection
 * description: Блок «Рекомендую коллег» на публичной странице мастера —
 *              показывает active партнёров из всех групп, в которых
 *              состоит этот мастер. Клиент видит карточки с фото,
 *              специализацией и ссылкой на их публичку.
 * created: 2026-05-02
 * --- */

import Link from 'next/link';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { Users, ChevronRight } from 'lucide-react';

interface PartnerCard {
  id: string;
  slug: string | null;
  name: string;
  specialization: string | null;
  avatar_url: string | null;
  city: string | null;
}

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function getMasterPartners(masterId: string): Promise<PartnerCard[]> {
  const db = admin();
  // 1. Найти все группы где этот мастер active
  const { data: myGroups } = await db
    .from('guild_members')
    .select('guild_id')
    .eq('master_id', masterId)
    .eq('status', 'active');
  const guildIds = (myGroups ?? []).map((r) => (r as { guild_id: string }).guild_id);
  if (guildIds.length === 0) return [];

  // 2. Все active члены этих групп (кроме самого мастера)
  const { data: members } = await db
    .from('guild_members')
    .select('master_id')
    .in('guild_id', guildIds)
    .eq('status', 'active')
    .neq('master_id', masterId);
  const partnerIds = Array.from(new Set((members ?? []).map((r) => (r as { master_id: string }).master_id)));
  if (partnerIds.length === 0) return [];

  // 3. Подгружаем данные мастеров
  const { data: masters } = await db
    .from('masters')
    .select('id, slug, display_name, specialization, avatar_url, city, is_active, is_public, profile:profiles!masters_profile_id_fkey(full_name)')
    .in('id', partnerIds)
    .eq('is_active', true)
    .eq('is_public', true);

  return (masters ?? []).map((raw) => {
    const r = raw as Record<string, unknown>;
    const profile = Array.isArray(r.profile) ? (r.profile[0] as Record<string, unknown>) : (r.profile as Record<string, unknown> | null);
    return {
      id: r.id as string,
      slug: (r.slug as string | null) ?? null,
      name: (r.display_name as string | null) || ((profile?.full_name as string | null) ?? 'Мастер'),
      specialization: (r.specialization as string | null) ?? null,
      avatar_url: (r.avatar_url as string | null) ?? null,
      city: (r.city as string | null) ?? null,
    };
  });
}

export async function GuildPartnersSection({ masterId }: { masterId: string }) {
  const partners = await getMasterPartners(masterId);
  if (partners.length === 0) return null;

  return (
    <section id="partners" className="scroll-mt-24">
      <div className="mb-4 flex items-center gap-2">
        <Users className="size-5 text-neutral-700" />
        <h2 className="text-[22px] font-bold text-neutral-900">Рекомендую коллег</h2>
      </div>
      <p className="mb-5 text-[14px] text-neutral-600">
        Мастера из моей партнёрской группы — кому я доверяю и могу порекомендовать.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {partners.map((p) => (
          <Link
            key={p.id}
            href={p.slug ? `/m/${p.slug}` : '#'}
            className="group flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-3 transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            {p.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={p.avatar_url}
                alt={p.name}
                className="size-14 shrink-0 rounded-full object-cover ring-1 ring-black/5"
              />
            ) : (
              <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-lg font-bold text-neutral-500">
                {p.name[0]?.toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-[15px] font-semibold text-neutral-900 group-hover:text-[var(--page-accent,#0d9488)]">
                {p.name}
              </div>
              {p.specialization && (
                <div className="truncate text-[13px] text-neutral-500">{p.specialization}</div>
              )}
              {p.city && (
                <div className="truncate text-[12px] text-neutral-400">{p.city}</div>
              )}
            </div>
            <ChevronRight className="size-4 shrink-0 text-neutral-400 transition-transform group-hover:translate-x-0.5" />
          </Link>
        ))}
      </div>
    </section>
  );
}
