/** --- YAML
 * name: MasterMiniAppPartnersList
 * description: Master Mini App partners list — active partnerships, pending state, and a tap-through
 *              to detail card. Cross-promo on/off shown as a small badge. Same UX feel as clients list.
 * created: 2026-04-25
 * --- */

'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Loader2, Megaphone, Users, User as UserIcon, Handshake } from 'lucide-react';
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

interface PartnershipItem {
  id: string;
  status: string;
  cross_promotion: boolean;
  youInitiated: boolean;
  partner: {
    id: string | null;
    specialization: string | null;
    is_team: boolean;
    full_name: string | null;
    avatar_url: string | null;
    slug: string | null;
  };
}

export default function MasterMiniAppPartnersList() {
  const { userId } = useAuthStore();
  const { haptic } = useTelegram();
  const [items, setItems] = useState<PartnershipItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const initData = getInitData();
    if (!initData) { setLoading(false); return; }
    const res = await fetch('/api/telegram/m/partners/list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData }),
    });
    if (!res.ok) { setLoading(false); return; }
    const json = await res.json();
    setItems((json.partnerships ?? []) as PartnershipItem[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!userId) return;
    load(); // eslint-disable-line react-hooks/set-state-in-effect
  }, [userId, load]);

  const active = items.filter((i) => i.status === 'active');
  const pending = items.filter((i) => i.status === 'pending');

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-4 px-4 pt-4 pb-24"
    >
      {/* Tabs */}
      <div className="flex gap-1.5 rounded-2xl border border-neutral-200 bg-white border-neutral-200 p-1">
        <Link
          href="/telegram/m/clients"
          onClick={() => haptic('light')}
          className="flex-1 rounded-xl py-1.5 text-center text-[12px] font-semibold text-neutral-500"
        >
          Клиенты
        </Link>
        <button
          onClick={() => haptic('light')}
          className="flex-1 rounded-xl bg-white/10 py-1.5 text-[12px] font-semibold"
        >
          Партнёры
        </button>
      </div>

      <header className="flex items-center gap-2">
        <Handshake className="size-5 text-violet-600" />
        <h1 className="text-base font-bold tracking-tight">Партнёрство</h1>
      </header>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-neutral-200 bg-white/5 p-6 text-center">
          <p className="text-[13px] text-neutral-700">У тебя пока нет партнёрств.</p>
          <p className="mt-1.5 text-[11px] text-neutral-500 leading-relaxed">
            Партнёр — другой мастер или команда (салон, клиника) для бесплатной взаимной рекламы.
            Найди коллег в веб-кабинете и отправь приглашение.
          </p>
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <Section title={`Активные (${active.length})`}>
              {active.map((p) => <Card key={p.id} item={p} haptic={haptic} />)}
            </Section>
          )}
          {pending.length > 0 && (
            <Section title={`Ожидают ответа (${pending.length})`}>
              {pending.map((p) => <Card key={p.id} item={p} haptic={haptic} dim />)}
            </Section>
          )}
        </>
      )}
    </motion.div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Card({ item, haptic, dim }: { item: PartnershipItem; haptic: (k: 'light') => void; dim?: boolean }) {
  const name = item.partner.full_name || 'Партнёр';
  const initials = name.split(' ').slice(0, 2).map((s) => s[0]?.toUpperCase() ?? '').join('') || '—';

  return (
    <Link
      href={`/telegram/m/partners/${item.id}`}
      onClick={() => haptic('light')}
      className={`flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white/5 p-3 ${dim ? 'opacity-70' : ''}`}
    >
      <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 text-[13px] font-bold">
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-[13px] font-semibold">{name}</p>
          <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] font-medium text-neutral-700">
            {item.partner.is_team ? <Users className="size-2.5" /> : <UserIcon className="size-2.5" />}
            {item.partner.is_team ? 'Команда' : 'Соло'}
          </span>
        </div>
        <p className="mt-0.5 truncate text-[11px] text-neutral-500">
          {item.partner.specialization || (item.status === 'pending' ? 'Ждём подтверждения' : 'Мастер')}
        </p>
      </div>
      {item.status === 'active' && item.cross_promotion && (
        <Megaphone className="size-3.5 shrink-0 text-emerald-600" />
      )}
    </Link>
  );
}
