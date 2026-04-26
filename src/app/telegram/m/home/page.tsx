/** --- YAML
 * name: MasterMiniAppHome
 * description: Master Mini App home — greeting + date, AI brief card, AI chat input (phase 4, 2026-04-19),
 *              compact weekly finance link. KPI grid and next-appointment hero removed per miniapp redesign.
 * created: 2026-04-13
 * updated: 2026-04-19
 * --- */

'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { TrendUp, CaretRight, Robot, PaperPlaneTilt, Broom } from '@phosphor-icons/react';
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

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export default function MasterMiniAppHome() {
  const { user, ready, haptic } = useTelegram();
  const { userId } = useAuthStore();
  const router = useRouter();
  const [masterId, setMasterId] = useState<string | null>(null);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [weekRevenue, setWeekRevenue] = useState(0);
  const [weekCompleted, setWeekCompleted] = useState(0);
  const [loading, setLoading] = useState(true);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!ready) return;
    try {
      const seen = localStorage.getItem('cres:voice-intro-seen');
      if (!seen) router.replace('/telegram/m/voice-intro');
    } catch { /* ignore */ }
  }, [ready, router]);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const initData = getInitData();
      if (!initData) { setLoading(false); return; }

      const ctxRes = await fetch('/api/telegram/m/home', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData }),
      });
      if (!ctxRes.ok) { setLoading(false); return; }
      const ctx = await ctxRes.json();
      if (!ctx.master) { setLoading(false); return; }
      setMasterId(ctx.master.id);
      setProfileName(ctx.profile?.full_name?.split(' ')[0] || null);
      setLoading(false);

      fetch('/api/telegram/m/stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData, period: 'week' }),
      })
        .then((r) => r.json())
        .then((j) => {
          type StatRow = { status: string; price: number | null };
          const rows = (j.appointments ?? []) as StatRow[];
          const done = rows.filter((r) => r.status === 'completed');
          setWeekRevenue(done.reduce((acc, r) => acc + Number(r.price ?? 0), 0));
          setWeekCompleted(done.length);
        })
        .catch(() => { /* ignore */ });

      // /brief endpoint больше не вызываем — секция «Бриф от AI» удалена.
    })();
  }, [userId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [chat, sending]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || sending) return;
    const initData = getInitData();
    if (!initData) return;

    haptic('light');
    setInput('');
    const nextChat: ChatMessage[] = [...chat, { role: 'user', content: text }];
    setChat(nextChat);
    setSending(true);

    try {
      const res = await fetch('/api/telegram/m/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initData,
          message: text,
          history: chat.slice(-6),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.answer) {
        setChat([...nextChat, { role: 'assistant', content: 'Не получилось ответить сейчас, попробуй ещё раз через минуту.' }]);
      } else {
        setChat([...nextChat, { role: 'assistant', content: json.answer }]);
        haptic('success');
      }
    } catch {
      setChat([...nextChat, { role: 'assistant', content: 'Ошибка сети. Проверь интернет и повтори.' }]);
    } finally {
      setSending(false);
    }
  }

  if (!ready || loading) {
    return (
      <div className="space-y-4 px-5 pt-6">
        <div className="h-8 w-40 animate-pulse rounded-lg bg-white/5" />
        <div className="h-24 w-full animate-pulse rounded-2xl bg-white/5" />
        <div className="h-16 w-full animate-pulse rounded-2xl bg-white/5" />
      </div>
    );
  }

  if (!masterId) {
    return (
      <div className="px-5 pt-10 text-center">
        <p className="text-sm text-white/60">Профиль мастера не найден</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6 px-5 pt-6"
    >
      <div>
        <h1 className="text-2xl font-bold">Привет, {profileName ?? user?.first_name ?? 'мастер'}</h1>
        <p className="mt-0.5 text-[12px] text-white/50">
          {new Date().toLocaleDateString('ru', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* «Бриф от AI» удалён — оказался бесполезной декорацией. Полезные
          подсказки теперь живут только в /finance AI-помощнике. */}

      {/* Finance first — quick status glance */}
      <Link
        href="/telegram/m/stats"
        className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-4 active:bg-white/[0.06] transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <TrendUp size={18} weight="bold" className="text-emerald-300" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300">Финансы · неделя</p>
            <p className="mt-1 text-base font-bold tabular-nums">
              {weekRevenue.toFixed(0)} ₴
              <span className="ml-2 text-[11px] font-normal text-white/50">{weekCompleted} записей</span>
            </p>
          </div>
        </div>
        <CaretRight size={16} className="text-white/40" />
      </Link>

      {/* AI chat — expanded, with Clear button */}
      <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
        <div className="flex items-center justify-between gap-2 px-1 pt-1">
          <div className="flex items-center gap-2">
            <Robot size={14} weight="fill" className="text-violet-300" />
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-300">AI-чат</p>
          </div>
          {chat.length > 0 && (
            <button
              onClick={() => { haptic('light'); setChat([]); }}
              className="flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/40 active:text-white/80 active:bg-white/[0.06] transition-colors"
              aria-label="Очистить"
            >
              <Broom size={12} weight="regular" />
              Очистить
            </button>
          )}
        </div>

        {chat.length === 0 && !sending ? (
          <div className="px-1 pb-1 text-[12px] leading-snug text-white/50">
            Спроси — ассистент запишет расход, создаст напоминание, ответит про выручку или клиентов.
            Голосом — продиктуй в основном чате с Telegram-ботом.
          </div>
        ) : (
          <div className="max-h-[55vh] min-h-[240px] space-y-2 overflow-y-auto px-1 pb-1">
            {chat.map((m, i) => (
              <div
                key={i}
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-[13px] leading-snug whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'ml-auto bg-violet-500/20 text-white'
                    : 'bg-white/[0.06] text-white/90'
                }`}
              >
                {m.content}
              </div>
            ))}
            {sending && (
              <div className="bg-white/[0.06] text-white/60 max-w-[60%] rounded-2xl px-3 py-2 text-[13px]">
                думаю…
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        )}

        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            disabled={sending}
            placeholder="Спросить ассистента…"
            className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-[13px] placeholder:text-white/30 focus:border-violet-500/40 focus:outline-none disabled:opacity-50"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || sending}
            className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-violet-500/30 bg-violet-500/20 text-violet-200 active:bg-violet-500/30 transition disabled:opacity-40"
          >
            <PaperPlaneTilt size={16} weight="fill" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
