/** --- YAML
 * name: MasterMiniAppQuickBooking
 * description: Master Mini App quick booking — 3 steps (client → service → time). Pre-fills from ?client_id. Inserts appointment + bumps client stats. Haptic feedback. Flat cards (Phase 7.9).
 * created: 2026-04-13
 * updated: 2026-04-18
 * --- */

'use client';

import { useCallback, useEffect, useMemo, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Search, Check, ChevronRight, Clock, Loader2, User as UserIcon } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useTelegram } from '@/components/miniapp/telegram-provider';

function getInitData(): string | null {
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
}

interface ClientOpt {
  id: string;
  full_name: string;
  phone: string | null;
}

interface ServiceOpt {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
  currency: string;
}

type Step = 'client' | 'service' | 'time' | 'saving';

function pad2(n: number) {
  return n.toString().padStart(2, '0');
}

function MasterMiniAppQuickBookingInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { haptic } = useTelegram();
  const { userId } = useAuthStore();
  const [masterId, setMasterId] = useState<string | null>(null);
  const [clients, setClients] = useState<ClientOpt[]>([]);
  const [services, setServices] = useState<ServiceOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>('client');
  const [query, setQuery] = useState('');
  const [selectedClient, setSelectedClient] = useState<ClientOpt | null>(null);
  const [selectedService, setSelectedService] = useState<ServiceOpt | null>(null);
  const [day, setDay] = useState<Date>(() => new Date());
  const [time, setTime] = useState('10:00');
  const [error, setError] = useState<string | null>(null);

  const preClientId = params.get('client_id');

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const initData = getInitData();
      if (!initData) { setLoading(false); return; }
      const res = await fetch('/api/telegram/m/slot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData }),
      });
      if (!res.ok) { setLoading(false); return; }
      const json = await res.json();
      setMasterId(json.masterId);
      const cs = (json.clients ?? []) as ClientOpt[];
      setClients(cs);
      setServices((json.services ?? []) as ServiceOpt[]);

      if (preClientId) {
        const pre = cs.find((c) => c.id === preClientId);
        if (pre) {
          setSelectedClient(pre);
          setStep('service');
        }
      }
      setLoading(false);
    })();
  }, [userId, preClientId]);

  const filteredClients = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients.slice(0, 50);
    return clients.filter((c) => c.full_name.toLowerCase().includes(q) || (c.phone ?? '').includes(q)).slice(0, 50);
  }, [clients, query]);

  const save = useCallback(async () => {
    if (!masterId || !selectedClient || !selectedService) return;
    setStep('saving');
    setError(null);
    const initData = getInitData();
    if (!initData) { setError('Нет данных сессии'); setStep('time'); return; }
    const [h, m] = time.split(':').map(Number);
    const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m, 0);
    const end = new Date(start.getTime() + selectedService.duration_minutes * 60000);
    try {
      const res = await fetch('/api/telegram/m/slot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initData,
          mode: 'create',
          client_id: selectedClient.id,
          service_id: selectedService.id,
          starts_at: start.toISOString(),
          ends_at: end.toISOString(),
          price: selectedService.price,
          currency: selectedService.currency,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        haptic('error');
        setError(j.error ?? 'Не удалось сохранить');
        setStep('time');
        return;
      }
      const json = await res.json();
      haptic('success');
      router.replace(`/telegram/m/calendar?id=${json.id}`);
    } catch {
      haptic('error');
      setError('Сбой сети. Попробуйте ещё раз');
      setStep('time');
    }
  }, [masterId, selectedClient, selectedService, day, time, haptic, router]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (!masterId) {
    return <p className="px-5 pt-10 text-center text-sm text-neutral-600">Профиль мастера не найден</p>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-4 px-5 pt-6 pb-10"
    >
      <button
        onClick={() => {
          haptic('light');
          if (step === 'service' && !preClientId) setStep('client');
          else if (step === 'time') setStep('service');
          else router.back();
        }}
        className="flex size-9 items-center justify-center rounded-xl border border-neutral-200 bg-white active:bg-neutral-50 transition-colors"
      >
        <ArrowLeft className="size-4" />
      </button>

      {/* Progress */}
      <div className="flex items-center gap-1.5">
        {(['client', 'service', 'time'] as const).map((s, i) => {
          const idx = (['client', 'service', 'time'] as const).indexOf(step === 'saving' ? 'time' : step);
          const active = i <= idx;
          return (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-colors ${active ? 'bg-white' : 'bg-white/15'}`}
            />
          );
        })}
      </div>

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-400">Новая запись</p>
        <h1 className="mt-1 text-2xl font-bold">
          {step === 'client' && '1. Кто?'}
          {step === 'service' && '2. Что?'}
          {step === 'time' && '3. Когда?'}
          {step === 'saving' && 'Сохраняю…'}
        </h1>
      </div>

      {step === 'client' && (
        <>
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск клиента…"
              className="w-full rounded-2xl border border-neutral-200 bg-white py-3 pl-11 pr-4 text-[13px] outline-none focus:border-neutral-300"
            />
          </div>
          <ul className="space-y-2">
            {filteredClients.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => {
                    haptic('light');
                    setSelectedClient(c);
                    setStep('service');
                  }}
                  className="flex w-full items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-3 text-left active:bg-neutral-50 transition-colors"
                >
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-neutral-50 text-[12px] font-bold text-neutral-900">
                    {c.full_name.split(' ').slice(0, 2).map((s) => s[0]?.toUpperCase() ?? '').join('') || '—'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{c.full_name}</p>
                    {c.phone && <p className="truncate text-[11px] text-neutral-500">{c.phone}</p>}
                  </div>
                  <ChevronRight className="size-4 text-neutral-400" />
                </button>
              </li>
            ))}
            {filteredClients.length === 0 && (
              <p className="py-6 text-center text-[12px] text-neutral-400">Ничего не найдено</p>
            )}
          </ul>
        </>
      )}

      {step === 'service' && (
        <>
          {selectedClient && (
            <div className="flex items-center gap-2 rounded-2xl border border-neutral-200 bg-white p-3">
              <UserIcon className="size-3.5 text-neutral-500" />
              <p className="truncate text-[12px] text-neutral-700">{selectedClient.full_name}</p>
            </div>
          )}
          <ul className="space-y-2">
            {services.map((s) => (
              <li key={s.id}>
                <button
                  onClick={() => {
                    haptic('light');
                    setSelectedService(s);
                    setStep('time');
                  }}
                  className="flex w-full items-center justify-between gap-3 rounded-2xl border border-neutral-200 bg-white p-4 text-left active:bg-neutral-50 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{s.name}</p>
                    <p className="mt-0.5 text-[11px] text-neutral-500">
                      <Clock className="mr-1 inline size-3" />
                      {s.duration_minutes} мин
                    </p>
                  </div>
                  <p className="shrink-0 text-[13px] font-bold">{Number(s.price).toFixed(0)} ₴</p>
                </button>
              </li>
            ))}
            {services.length === 0 && (
              <p className="py-6 text-center text-[12px] text-neutral-400">Нет активных услуг. Добавь в dashboard.</p>
            )}
          </ul>
        </>
      )}

      {step === 'time' && selectedService && selectedClient && (
        <>
          <div className="space-y-2">
            <div className="flex items-center gap-2 rounded-2xl border border-neutral-200 bg-white p-3">
              <UserIcon className="size-3.5 text-neutral-500" />
              <p className="truncate text-[12px] text-neutral-700">{selectedClient.full_name}</p>
              <span className="text-neutral-400">·</span>
              <p className="truncate text-[12px] text-neutral-700">{selectedService.name}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-4">
            <p className="text-[10px] uppercase tracking-wide text-neutral-400">Дата</p>
            <input
              type="date"
              value={`${day.getFullYear()}-${pad2(day.getMonth() + 1)}-${pad2(day.getDate())}`}
              onChange={(e) => {
                const [y, m, d] = e.target.value.split('-').map(Number);
                setDay(new Date(y, m - 1, d));
              }}
              className="mt-2 w-full rounded-xl border border-neutral-200 bg-neutral-900/40 px-3 py-2.5 text-[14px] outline-none focus:border-neutral-300 [color-scheme:dark]"
            />
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-4">
            <p className="text-[10px] uppercase tracking-wide text-neutral-400">Время начала</p>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="mt-2 w-full rounded-xl border border-neutral-200 bg-neutral-900/40 px-3 py-2.5 text-[14px] outline-none focus:border-neutral-300 [color-scheme:dark]"
            />
            <p className="mt-2 text-[11px] text-neutral-500">
              Закончится в {(() => {
                const [h, m] = time.split(':').map(Number);
                const end = new Date(0, 0, 0, h, m + selectedService.duration_minutes);
                return `${pad2(end.getHours())}:${pad2(end.getMinutes())}`;
              })()}
            </p>
          </div>

          {error && (
            <div className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-white p-3 pl-5 text-[12px] text-rose-600">
              <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-rose-500" />
              {error}
            </div>
          )}

          <button
            onClick={save}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-4 text-[15px] font-semibold text-black active:bg-white/80 transition-colors"
          >
            <Check className="size-4" /> Создать запись · {Number(selectedService.price).toFixed(0)} ₴
          </button>
        </>
      )}

      {step === 'saving' && (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="size-6 animate-spin text-neutral-400" />
        </div>
      )}
    </motion.div>
  );
}

export default function MasterMiniAppQuickBooking() {
  return (
    <Suspense fallback={<div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="size-6 animate-spin text-neutral-400" /></div>}>
      <MasterMiniAppQuickBookingInner />
    </Suspense>
  );
}
