/** --- YAML
 * name: MiniAppHomePage
 * description: «Для вас» — Fresha-premium домашний экран клиента. Next appointment
 *              hero + свободные окна у контактов + Рекомендуемые мастера + Explore
 *              категории. Светлая тема, premium-карточки, анимация.
 * created: 2026-04-13
 * updated: 2026-04-26
 * --- */

'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Calendar, Sparkles, Clock, Star, ChevronRight } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useTelegram } from '@/components/miniapp/telegram-provider';
import { formatMoney } from '@/lib/format/money';
import {
  MobilePage,
  PageHeader,
  SectionHeader,
  AvatarCircle,
} from '@/components/miniapp/shells';
import { T, R, TYPE, SHADOW, PAGE_PADDING_X, HERO_GRADIENT } from '@/components/miniapp/design';
import { AIChatSheet } from '@/components/miniapp/ai-chat-sheet';

interface SalonRef {
  id: string;
  name: string;
  logo_url: string | null;
  city: string | null;
}
interface NextAppointment {
  id: string;
  starts_at: string;
  master_id: string | null;
  master_name: string;
  master_avatar: string | null;
  master_specialization: string | null;
  salon: SalonRef | null;
  service_name: string;
  price: number;
  currency: string | null;
}
interface SlotItem {
  masterId: string;
  name: string | null;
  avatar: string | null;
  date: string;
  time: string;
  iso: string;
}
interface FeaturedMaster {
  id: string;
  slug: string;
  fullName: string;
  firstName: string;
  avatarUrl: string | null;
  city: string | null;
  specialization: string | null;
  rating: number | null;
  reviewsCount: number;
  topServices: Array<{ name: string; price: number; currency: string }>;
}

const CATEGORY_TILES = [
  { key: 'beauty', label: 'Красота', q: 'красота', bg: '#f4b740', emoji: '💅' },
  { key: 'health', label: 'Здоровье', q: 'здоровье', bg: '#3b82f6', emoji: '🩺' },
  { key: 'nails', label: 'Ногти', q: 'маникюр', bg: '#ec4899', emoji: '💅' },
  { key: 'massage', label: 'Массаж', q: 'массаж', bg: '#14b8a6', emoji: '💆' },
  { key: 'medspa', label: 'Косметология', q: 'косметология', bg: '#f97316', emoji: '✨' },
  { key: 'spa', label: 'Спа и сауна', q: 'спа', bg: '#84cc16', emoji: '🧖' },
] as const;

const TOP_CATEGORIES = [
  { key: 'hair', label: 'Стрижка и укладка', q: 'стрижка' },
  { key: 'manicure', label: 'Ногти', q: 'маникюр' },
  { key: 'brows', label: 'Брови и ресницы', q: 'брови' },
  { key: 'massage', label: 'Массаж', q: 'массаж' },
  { key: 'facial', label: 'Косметология', q: 'лицо' },
] as const;

export default function MiniAppHomePage() {
  const { haptic } = useTelegram();
  const router = useRouter();
  const { userId } = useAuthStore();
  const [next, setNext] = useState<NextAppointment | null>(null);
  const [slots, setSlots] = useState<SlotItem[]>([]);
  const [featured, setFeatured] = useState<FeaturedMaster[]>([]);
  const [, setLoading] = useState(true);
  const [aiOpen, setAiOpen] = useState(false);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const initData = (() => {
        if (typeof window === 'undefined') return null;
        const w = window as { Telegram?: { WebApp?: { initData?: string } } };
        const live = w.Telegram?.WebApp?.initData;
        if (live) return live;
        try {
          const stash = sessionStorage.getItem('cres:tg');
          if (stash) {
            const parsed = JSON.parse(stash) as { initData?: string };
            if (parsed.initData) return parsed.initData;
          }
        } catch { /* ignore */ }
        return null;
      })();

      // Next appointment
      if (initData) {
        try {
          const naRes = await fetch('/api/telegram/c/next-appointment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ initData }),
          });
          if (naRes.ok) {
            const { next: apt } = await naRes.json();
            if (apt) {
              type SalonEmbed = { id: string; name: string; logo_url: string | null; city: string | null };
              const a = apt as {
                id: string;
                starts_at: string;
                price: number | null;
                currency: string | null;
                master: {
                  id: string;
                  specialization: string | null;
                  display_name: string | null;
                  avatar_url: string | null;
                  profile: { full_name: string; avatar_url: string | null } | { full_name: string; avatar_url: string | null }[] | null;
                  salon: SalonEmbed | SalonEmbed[] | null;
                } | null;
                service: { name: string } | { name: string }[] | null;
              };
              const masterProfile = Array.isArray(a.master?.profile) ? a.master?.profile[0] : a.master?.profile;
              const svc = Array.isArray(a.service) ? a.service[0] : a.service;
              const rawSalon = Array.isArray(a.master?.salon) ? a.master?.salon[0] ?? null : a.master?.salon ?? null;
              setNext({
                id: a.id,
                starts_at: a.starts_at,
                master_id: a.master?.id ?? null,
                master_name: a.master?.display_name ?? masterProfile?.full_name ?? '—',
                master_avatar: a.master?.avatar_url ?? masterProfile?.avatar_url ?? null,
                master_specialization: a.master?.specialization ?? null,
                salon: rawSalon,
                service_name: svc?.name ?? '—',
                price: Number(a.price ?? 0),
                currency: a.currency ?? 'UAH',
              });
            }
          }
        } catch { /* ignore */ }
      }

      // Free slots from contacts
      try {
        const slotsRes = await fetch(`/api/me/followed-slots?profileId=${userId}`);
        if (slotsRes.ok) {
          const data = await slotsRes.json();
          setSlots((data.items ?? []) as SlotItem[]);
        }
      } catch { /* ignore */ }

      // Featured masters (discovery)
      try {
        let city: string | undefined;
        try {
          const c = localStorage.getItem('cres-ca-city');
          if (c) city = c;
        } catch { /* ignore */ }
        const qs = new URLSearchParams();
        if (city) qs.set('city', city);
        qs.set('limit', '10');
        const res = await fetch(`/api/marketplace/featured?${qs.toString()}`);
        if (res.ok) {
          const j = await res.json();
          setFeatured(Array.isArray(j.items) ? j.items : []);
        }
      } catch { /* ignore */ }

      setLoading(false);
    })();
  }, [userId]);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 6) return 'Доброй ночи';
    if (h < 12) return 'Доброе утро';
    if (h < 18) return 'Добрый день';
    return 'Добрый вечер';
  }, []);

  return (
    <MobilePage>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        style={{ display: 'flex', flexDirection: 'column', gap: 24 }}
      >
        <PageHeader
          title="Для вас"
          subtitle={greeting}
          right={
            <button
              type="button"
              onClick={() => {
                haptic('light');
                setAiOpen(true);
              }}
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                border: 'none',
                background: T.accentSoft,
                color: T.accent,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
              aria-label="AI-консьерж"
            >
              <Sparkles size={20} strokeWidth={2.2} />
            </button>
          }
        />

        {/* Next appointment hero — gradient when есть, обычный если нет */}
        {next ? (
          <Link
            href={`/telegram/activity/${next.id}`}
            onClick={() => haptic('light')}
            style={{
              ...HERO_GRADIENT,
              margin: `0 ${PAGE_PADDING_X}px`,
              padding: 22,
              borderRadius: R.lg,
              color: '#fff',
              boxShadow: SHADOW.elevated,
              textDecoration: 'none',
              display: 'block',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, opacity: 0.85, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <Calendar size={13} /> Ближайшая запись
            </div>
            <p style={{ fontSize: 22, fontWeight: 800, marginTop: 8, marginBottom: 4, letterSpacing: '-0.01em', lineHeight: 1.2 }}>
              {next.service_name}
            </p>
            <p style={{ fontSize: 14, opacity: 0.95, margin: 0 }}>
              {formatDateTime(next.starts_at)} · {next.master_name}
            </p>
            {next.salon?.name && (
              <p style={{ fontSize: 13, opacity: 0.8, marginTop: 2 }}>
                {next.salon.name}{next.salon.city ? ` · ${next.salon.city}` : ''}
              </p>
            )}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 14, fontSize: 13, fontWeight: 700 }}>
              Подробнее <ChevronRight size={14} />
            </div>
          </Link>
        ) : null}

        {/* Свободные окна у моих контактов */}
        {slots.length > 0 && (
          <div>
            <SectionHeader title="Свободные окна" href="/telegram/connections" rightLabel="Все контакты" />
            <ul
              style={{
                listStyle: 'none',
                padding: `0 ${PAGE_PADDING_X}px`,
                margin: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              {slots.slice(0, 4).map((s) => (
                <li key={s.masterId + s.iso}>
                  <Link
                    href={`/telegram/book?master_id=${s.masterId}&date=${s.date}&time=${encodeURIComponent(s.time)}`}
                    onClick={() => haptic('light')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: 12,
                      background: T.surface,
                      border: `1px solid ${T.borderSubtle}`,
                      borderRadius: R.md,
                      textDecoration: 'none',
                      color: T.text,
                    }}
                  >
                    <AvatarCircle url={s.avatar} name={s.name ?? 'Мастер'} size={44} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ ...TYPE.bodyStrong, color: T.text, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s.name ?? 'Мастер'}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2, ...TYPE.caption }}>
                        <Clock size={13} />
                        {formatSlotDate(s.date, s.time)}
                      </div>
                    </div>
                    <ChevronRight size={18} color={T.textTertiary} />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Рекомендуемые — Fresha "Recommended" */}
        {featured.length > 0 && (
          <div>
            <SectionHeader title="Рекомендуемые" href="/telegram/search" />
            <div
              style={{
                display: 'flex',
                gap: 12,
                overflowX: 'auto',
                padding: `0 ${PAGE_PADDING_X}px 4px`,
                scrollbarWidth: 'none',
              }}
            >
              <style>{`
                .featured-row::-webkit-scrollbar { display: none; }
              `}</style>
              <div className="featured-row" style={{ display: 'flex', gap: 12, flexShrink: 0 }}>
                {featured.map((m) => {
                  const cheapest = m.topServices[0];
                  return (
                    <Link
                      key={m.id}
                      href={`/m/${m.slug}`}
                      onClick={() => haptic('light')}
                      style={{
                        flexShrink: 0,
                        width: 220,
                        background: T.surface,
                        border: `1px solid ${T.borderSubtle}`,
                        borderRadius: R.md,
                        overflow: 'hidden',
                        textDecoration: 'none',
                        color: T.text,
                        boxShadow: SHADOW.card,
                      }}
                    >
                      <div
                        style={{
                          position: 'relative',
                          aspectRatio: '4/3',
                          background: m.avatarUrl
                            ? 'transparent'
                            : `linear-gradient(135deg, ${T.gradientFrom}, ${T.gradientTo})`,
                          overflow: 'hidden',
                        }}
                      >
                        {m.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={m.avatarUrl}
                            alt={m.fullName}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '100%',
                              height: '100%',
                              fontSize: 56,
                              fontWeight: 800,
                              color: 'rgba(255,255,255,0.85)',
                            }}
                          >
                            {m.firstName.charAt(0).toUpperCase()}
                          </div>
                        )}
                        {(m.rating ?? 0) > 0 && (
                          <div
                            style={{
                              position: 'absolute',
                              top: 10,
                              right: 10,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              padding: '4px 9px',
                              borderRadius: R.pill,
                              background: 'rgba(255,255,255,0.95)',
                              backdropFilter: 'blur(8px)',
                              fontSize: 12,
                              fontWeight: 700,
                            }}
                          >
                            <Star size={12} fill="#f59e0b" color="#f59e0b" />
                            {m.rating?.toFixed(1)}
                            <span style={{ color: T.textTertiary, fontWeight: 500 }}>({m.reviewsCount})</span>
                          </div>
                        )}
                      </div>
                      <div style={{ padding: 12 }}>
                        <p
                          style={{
                            ...TYPE.bodyStrong,
                            margin: 0,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {m.fullName}
                        </p>
                        {m.specialization && (
                          <p
                            style={{
                              ...TYPE.caption,
                              marginTop: 2,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {m.specialization}
                          </p>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                          <span style={{ ...TYPE.micro }}>{m.city ?? ''}</span>
                          {cheapest && (
                            <span style={{ ...TYPE.bodyStrong, fontSize: 13 }}>
                              от {formatMoney(cheapest.price, cheapest.currency)}
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Explore — colored category tiles (Fresha "Explore") */}
        <div>
          <SectionHeader title="Explore" href="/telegram/search" />
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 10,
              padding: `0 ${PAGE_PADDING_X}px`,
            }}
          >
            {CATEGORY_TILES.map((c) => (
              <Link
                key={c.key}
                href={`/telegram/search?q=${encodeURIComponent(c.q)}`}
                onClick={() => haptic('light')}
                style={{
                  position: 'relative',
                  aspectRatio: '5/3',
                  background: c.bg,
                  borderRadius: R.md,
                  textDecoration: 'none',
                  color: '#fff',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'flex-end',
                  padding: 14,
                  fontSize: 18,
                  fontWeight: 800,
                  letterSpacing: '-0.01em',
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    top: 12,
                    right: 12,
                    fontSize: 28,
                    opacity: 0.85,
                  }}
                >
                  {c.emoji}
                </span>
                {c.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Top categories — circular avatars */}
        <div>
          <SectionHeader title="Топ категории" href="/telegram/search" />
          <div
            style={{
              display: 'flex',
              gap: 16,
              overflowX: 'auto',
              padding: `0 ${PAGE_PADDING_X}px 4px`,
              scrollbarWidth: 'none',
            }}
          >
            <style>{`.cat-row::-webkit-scrollbar { display: none; }`}</style>
            <div className="cat-row" style={{ display: 'flex', gap: 16, flexShrink: 0 }}>
              {TOP_CATEGORIES.map((c, i) => (
                <Link
                  key={c.key}
                  href={`/telegram/search?q=${encodeURIComponent(c.q)}`}
                  onClick={() => haptic('light')}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 8,
                    width: 88,
                    flexShrink: 0,
                    textDecoration: 'none',
                    color: T.text,
                  }}
                >
                  <div
                    style={{
                      width: 80,
                      height: 80,
                      borderRadius: '50%',
                      background: `hsl(${(i * 53) % 360}, 70%, 88%)`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 32,
                    }}
                  >
                    {['💇', '💅', '👁️', '💆', '✨'][i]}
                  </div>
                  <span
                    style={{
                      ...TYPE.caption,
                      color: T.text,
                      fontWeight: 600,
                      textAlign: 'center',
                      lineHeight: 1.2,
                    }}
                  >
                    {c.label}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div style={{ height: 8 }} />
      </motion.div>

      <AIChatSheet open={aiOpen} onClose={() => setAiOpen(false)} />
    </MobilePage>
  );
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today.getTime() + 86400000);
  const time = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  if (target.getTime() === today.getTime()) return `Сегодня ${time}`;
  if (target.getTime() === tomorrow.getTime()) return `Завтра ${time}`;
  return `${d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} ${time}`;
}

function formatSlotDate(dateStr: string, time: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today.getTime() + 86400000);
  if (d.getTime() === today.getTime()) return `Сегодня ${time}`;
  if (d.getTime() === tomorrow.getTime()) return `Завтра ${time}`;
  return `${d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} ${time}`;
}
