/** --- YAML
 * name: MiniAppActivityPage
 * description: Mini App activity — segmented upcoming / past appointments with salon-aware display (Phase 4). Salon primary if master belongs to salon, solo master primary if solo. Tap → detail page.
 * created: 2026-04-13
 * updated: 2026-04-19
 * --- */

'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Calendar, CheckCircle2, XCircle, Clock3, ChevronRight, User, Building2 } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useTelegram } from '@/components/miniapp/telegram-provider';
import { resolveCardDisplay, type SalonRef } from '@/lib/client/display-mode';

const MINIAPP_CARD_LABELS = {
  masterPlaceholder: 'Мастер',
  salonPlaceholder: 'Салон',
  managerAssigned: 'Мастер будет назначен администратором',
};

type SalonEmbed = { id: string; name: string; logo_url: string | null; city: string | null; rating: number | null } | null;

function unwrapSalon(s: SalonEmbed | SalonEmbed[] | null | undefined): SalonRef | null {
  if (!s) return null;
  const obj = Array.isArray(s) ? s[0] ?? null : s;
  if (!obj) return null;
  return { id: obj.id, name: obj.name, logo_url: obj.logo_url, city: obj.city, rating: obj.rating };
}

interface AppointmentRow {
  id: string;
  starts_at: string;
  status: string;
  price: number;
  service_name: string;
  service_color: string | null;
  master_id: string | null;
  master_display_name: string | null;
  master_avatar: string | null;
  master_specialization: string | null;
  master_salon_id: string | null;
  salon: SalonRef | null;
}

type Tab = 'upcoming' | 'past';

export default function MiniAppActivityPage() {
  const { haptic } = useTelegram();
  const { userId } = useAuthStore();
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [tab, setTab] = useState<Tab>('upcoming');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
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
      if (!initData) { setLoading(false); return; }

      const res = await fetch('/api/telegram/c/activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData }),
      });
      if (!res.ok) { setLoading(false); return; }
      const json = await res.json();
      const data = json.appointments ?? [];
      const rows: AppointmentRow[] = data.map((row: unknown) => {
        const a = row as {
          id: string;
          starts_at: string;
          status: string;
          price: number | null;
          master: {
            id: string | null;
            display_name: string | null;
            avatar_url: string | null;
            specialization: string | null;
            salon_id: string | null;
            profile: { full_name: string | null; avatar_url: string | null } | { full_name: string | null; avatar_url: string | null }[] | null;
            salon: SalonEmbed | SalonEmbed[];
          } | { id: string | null; display_name: string | null; avatar_url: string | null; specialization: string | null; salon_id: string | null; profile: unknown; salon: unknown }[] | null;
          service: { name: string | null; color: string | null } | { name: string | null; color: string | null }[] | null;
        };
        const master = Array.isArray(a.master) ? a.master[0] ?? null : a.master;
        const masterProfile = master && master.profile
          ? (Array.isArray(master.profile) ? master.profile[0] ?? null : master.profile) as { full_name: string | null; avatar_url: string | null } | null
          : null;
        const svc = Array.isArray(a.service) ? a.service[0] ?? null : a.service;
        const salonRaw = master?.salon ?? null;
        return {
          id: a.id,
          starts_at: a.starts_at,
          status: a.status,
          price: Number(a.price ?? 0),
          service_name: svc?.name ?? '—',
          service_color: svc?.color ?? null,
          master_id: master?.id ?? null,
          master_display_name: master?.display_name ?? masterProfile?.full_name ?? null,
          master_avatar: master?.avatar_url ?? masterProfile?.avatar_url ?? null,
          master_specialization: master?.specialization ?? null,
          master_salon_id: master?.salon_id ?? null,
          salon: unwrapSalon(salonRaw as SalonEmbed | SalonEmbed[] | null),
        };
      });
      setAppointments(rows);
      setLoading(false);
    })();
  }, [userId]);

  const { upcoming, past } = useMemo(() => {
    const now = Date.now();
    const up: AppointmentRow[] = [];
    const pa: AppointmentRow[] = [];
    for (const a of appointments) {
      const isDone = ['completed', 'cancelled', 'cancelled_by_client', 'cancelled_by_master', 'no_show'].includes(a.status);
      if (!isDone && new Date(a.starts_at).getTime() >= now - 3600 * 1000) up.push(a);
      else pa.push(a);
    }
    up.sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
    return { upcoming: up, past: pa };
  }, [appointments]);

  const visible = tab === 'upcoming' ? upcoming : past;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-5 px-5 pt-6"
    >
      <h1 className="text-2xl font-bold">Записи</h1>

      {/* Segmented control */}
      <div className="flex gap-1 rounded-2xl border border-white/10 bg-white/[0.03] p-1">
        {(['upcoming', 'past'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              haptic('selection');
            }}
            className={`flex-1 rounded-xl py-2 text-xs font-semibold transition-colors ${
              tab === t ? 'bg-white text-black' : 'text-white/60'
            }`}
          >
            {t === 'upcoming' ? `Предстоящие${upcoming.length ? ` · ${upcoming.length}` : ''}` : `История${past.length ? ` · ${past.length}` : ''}`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 w-full animate-pulse rounded-2xl bg-white/[0.03]" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-10 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03]">
            <Calendar className="size-5 text-white/50" />
          </div>
          <p className="mt-4 text-sm font-semibold">
            {tab === 'upcoming' ? 'Нет предстоящих записей' : 'Нет завершённых записей'}
          </p>
          {tab === 'upcoming' && (
            <Link
              href="/telegram/search"
              onClick={() => haptic('light')}
              className="mt-3 inline-block rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-xs font-semibold text-white/90 active:bg-white/[0.1]"
            >
              Найти мастера
            </Link>
          )}
        </div>
      ) : (
        <ul className="space-y-3">
          {visible.map((a, i) => {
            const masterRef = a.master_id
              ? {
                  id: a.master_id,
                  display_name: a.master_display_name,
                  avatar_url: a.master_avatar,
                  specialization: a.master_specialization,
                  salon_id: a.master_salon_id,
                }
              : null;
            const d = resolveCardDisplay(masterRef, a.salon, MINIAPP_CARD_LABELS);
            return (
              <motion.li
                key={a.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }}
              >
                <Link
                  href={`/telegram/activity/${a.id}`}
                  onClick={() => haptic('light')}
                  className="flex items-start justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 active:bg-white/[0.06] transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {d.mode === 'solo' ? (
                        <User className="size-3 shrink-0 text-white/50" />
                      ) : (
                        <Building2 className="size-3 shrink-0 text-white/50" />
                      )}
                      <p className="truncate text-sm font-semibold">{d.primary}</p>
                    </div>
                    {d.secondary && (
                      <p className="mt-0.5 truncate text-[11px] text-white/60">{d.secondary}</p>
                    )}
                    <div className="mt-2 flex items-center gap-2 text-[11px] text-white/70">
                      <span
                        className="inline-block size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: a.service_color ?? '#8b5cf6' }}
                      />
                      <span className="truncate">{a.service_name}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-white/70">
                      <Calendar className="size-3" />
                      {new Date(a.starts_at).toLocaleString('ru', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      {a.price > 0 && (
                        <>
                          <span className="text-white/30">·</span>
                          <span className="font-semibold text-white/90">{a.price.toFixed(0)} ₴</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-start gap-1">
                    <StatusChip status={a.status} />
                    <ChevronRight className="size-4 text-white/30" />
                  </div>
                </Link>
              </motion.li>
            );
          })}
        </ul>
      )}
    </motion.div>
  );
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { label: string; text: string; border: string; icon: React.ElementType }> = {
    booked: { label: 'Записан', text: 'text-sky-300', border: 'border-sky-500/30', icon: Clock3 },
    confirmed: { label: 'Подтверждено', text: 'text-emerald-300', border: 'border-emerald-500/30', icon: CheckCircle2 },
    in_progress: { label: 'Идёт', text: 'text-violet-300', border: 'border-violet-500/30', icon: Clock3 },
    completed: { label: 'Завершено', text: 'text-emerald-300', border: 'border-emerald-500/30', icon: CheckCircle2 },
    cancelled: { label: 'Отменено', text: 'text-rose-300', border: 'border-rose-500/30', icon: XCircle },
    cancelled_by_client: { label: 'Отменено', text: 'text-rose-300', border: 'border-rose-500/30', icon: XCircle },
    cancelled_by_master: { label: 'Отменено', text: 'text-rose-300', border: 'border-rose-500/30', icon: XCircle },
    no_show: { label: 'Не пришёл', text: 'text-amber-300', border: 'border-amber-500/30', icon: XCircle },
  };
  const info = map[status] ?? map.booked;
  const Icon = info.icon;
  return (
    <span className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${info.text} ${info.border}`}>
      <Icon className="size-2.5" /> {info.label}
    </span>
  );
}
