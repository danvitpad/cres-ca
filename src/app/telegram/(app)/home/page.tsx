/** --- YAML
 * name: MiniAppHomePage
 * description: Главный экран клиента — ближайшая запись + свободные окна у мастеров из контактов.
 *              Не Instagram-feed, а утилитарная лента слотов. (Phase 8 — remove social).
 * created: 2026-04-13
 * updated: 2026-04-25
 * --- */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Calendar, Search, Clock, Sparkles, ChevronRight, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useTelegram } from '@/components/miniapp/telegram-provider';

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
}

interface SlotItem {
  masterId: string;
  name: string | null;
  avatar: string | null;
  date: string;
  time: string;
  iso: string;
}

export default function MiniAppHomePage() {
  const { haptic } = useTelegram();
  const { userId } = useAuthStore();
  const [next, setNext] = useState<NextAppointment | null>(null);
  const [slots, setSlots] = useState<SlotItem[]>([]);
  const [loading, setLoading] = useState(true);

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

      setLoading(false);
    })();
  }, [userId]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-4 px-5 pt-6 pb-6"
    >
      <h1 className="text-[24px] font-bold leading-tight">Главная</h1>

      {/* Next appointment */}
      {next ? (
        <Link
          href={`/telegram/booking/${next.id}`}
          onClick={() => haptic('light')}
          className="block rounded-3xl border border-violet-500/20 bg-gradient-to-br from-violet-500/15 via-violet-500/5 to-transparent p-5 active:opacity-90 transition-opacity"
        >
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-violet-300/80">
            <Calendar className="size-3.5" />
            Ближайшая запись
          </div>
          <p className="mt-2 text-[15px] font-semibold leading-tight">{next.service_name}</p>
          <p className="mt-1 text-[13px] text-white/70">
            {formatDateTime(next.starts_at)} · {next.master_name}
          </p>
          {next.salon?.name && (
            <p className="mt-1 text-[12px] text-white/50">{next.salon.name}{next.salon.city ? ` · ${next.salon.city}` : ''}</p>
          )}
          <div className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-violet-300">
            Подробнее <ChevronRight className="size-3.5" />
          </div>
        </Link>
      ) : !loading ? (
        <Link
          href="/telegram/find"
          onClick={() => haptic('light')}
          className="block rounded-3xl border border-white/10 bg-white/[0.03] p-5 active:bg-white/[0.06] transition-colors"
        >
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/50">
            <Calendar className="size-3.5" />
            Записей пока нет
          </div>
          <p className="mt-2 text-[15px] font-semibold">Найти мастера и записаться</p>
          <p className="mt-1 text-[12px] text-white/55">
            Найди исполнителя нужной услуги и забронируй удобное время.
          </p>
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-[12px] font-semibold text-black">
            <Search className="size-3.5" />
            Найти
          </div>
        </Link>
      ) : null}

      {/* Free slots from contacts */}
      <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-violet-300/80">
          <Sparkles className="size-3.5" />
          Свободные окна у моих контактов
        </div>

        {loading ? (
          <div className="mt-4 flex items-center justify-center py-8">
            <Loader2 className="size-5 animate-spin text-white/40" />
          </div>
        ) : slots.length === 0 ? (
          <div className="mt-3">
            <p className="text-[13px] text-white/55">
              Добавь любимых мастеров и салоны в контакты — здесь будут их ближайшие свободные окна.
            </p>
            <Link
              href="/telegram/connections"
              onClick={() => haptic('light')}
              className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-4 py-2 text-[12px] font-semibold text-white active:bg-white/[0.1] transition-colors"
            >
              Открыть контакты
              <ChevronRight className="size-3.5" />
            </Link>
          </div>
        ) : (
          <ul className="mt-3 space-y-2">
            {slots.map((s) => (
              <li key={s.masterId + s.iso}>
                <Link
                  href={`/telegram/book?master_id=${s.masterId}&date=${s.date}&time=${encodeURIComponent(s.time)}`}
                  onClick={() => haptic('light')}
                  className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3 active:bg-white/[0.08] transition-colors"
                >
                  <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/[0.06] text-sm font-bold text-white/90">
                    {s.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.avatar} alt="" className="size-full object-cover" />
                    ) : (
                      (s.name?.[0] ?? '?').toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold">{s.name ?? 'Мастер'}</p>
                    <div className="mt-0.5 flex items-center gap-1 text-[11px] text-white/60">
                      <Clock className="size-3" />
                      {formatSlotDate(s.date, s.time)}
                    </div>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-white/30" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/telegram/find"
          onClick={() => haptic('light')}
          className="flex flex-col items-start gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-4 active:bg-white/[0.06] transition-colors"
        >
          <div className="flex size-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
            <Search className="size-4" />
          </div>
          <p className="text-[13px] font-semibold">Найти</p>
          <p className="text-[11px] text-white/50">Поиск мастеров и салонов</p>
        </Link>
        <Link
          href="/telegram/connections"
          onClick={() => haptic('light')}
          className="flex flex-col items-start gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-4 active:bg-white/[0.06] transition-colors"
        >
          <div className="flex size-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
            <Sparkles className="size-4" />
          </div>
          <p className="text-[13px] font-semibold">Контакты</p>
          <p className="text-[11px] text-white/50">Мастера, салоны, друзья</p>
        </Link>
      </div>
    </motion.div>
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
