/** --- YAML
 * name: MasterMiniAppHome
 * description: Главная мастера в Mini App — Fresha-premium 2026 (light theme).
 *              Greeting + дата + AI-чат-композер + finance-quick-link. Бизнес-логика
 *              сохранена (assistant API, week-stats), визуально переписано на shells.
 * created: 2026-04-13
 * updated: 2026-04-26
 * --- */

'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { TrendingUp, ChevronRight, Sparkles, Send, Trash2, MailOpen } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useTelegram } from '@/components/miniapp/telegram-provider';
import { MobilePage, PageHeader } from '@/components/miniapp/shells';
import { T, R, TYPE, SHADOW, PAGE_PADDING_X } from '@/components/miniapp/design';

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
  const [pendingInvites, setPendingInvites] = useState(0);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    fetch('/api/master-invites')
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { invites?: Array<{ status: string }> } | null) => {
        if (!j?.invites || cancelled) return;
        setPendingInvites(j.invites.filter((i) => i.status === 'pending').length);
      })
      .catch(() => { /* ignore */ });
    return () => { cancelled = true; };
  }, [ready]);

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
      <MobilePage>
        <div style={{ padding: `28px ${PAGE_PADDING_X}px`, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ height: 32, width: 160, borderRadius: 8, background: T.bgSubtle }} />
          <div style={{ height: 96, width: '100%', borderRadius: R.lg, background: T.bgSubtle }} />
          <div style={{ height: 64, width: '100%', borderRadius: R.lg, background: T.bgSubtle }} />
        </div>
      </MobilePage>
    );
  }

  if (!masterId) {
    return (
      <MobilePage>
        <div style={{ padding: '40px 20px', textAlign: 'center' }}>
          <p style={{ ...TYPE.body, color: T.textSecondary }}>Профиль мастера не найден</p>
        </div>
      </MobilePage>
    );
  }

  const greetingName = profileName ?? user?.first_name ?? 'мастер';
  const dateLabel = new Date().toLocaleDateString('ru', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <MobilePage>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        style={{ display: 'flex', flexDirection: 'column', gap: 20 }}
      >
        <PageHeader title={`Привет, ${greetingName}`} subtitle={dateLabel} />

        {pendingInvites > 0 && (
          <Link
            href="/telegram/m/invites"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              margin: `0 ${PAGE_PADDING_X}px`,
              padding: 16,
              background: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)',
              border: `1px solid #ddd6fe`,
              borderRadius: R.md,
              textDecoration: 'none',
              color: T.text,
              boxShadow: SHADOW.card,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  flexShrink: 0,
                  borderRadius: 12,
                  background: '#ede9fe',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <MailOpen size={20} color="#6d28d9" strokeWidth={2.4} />
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6d28d9', margin: 0 }}>
                  Приглашение в команду
                </p>
                <p style={{ ...TYPE.h3, color: T.text, marginTop: 4 }}>
                  {pendingInvites} {pluralize(pendingInvites, ['приглашение', 'приглашения', 'приглашений'])} ждут ответа
                </p>
              </div>
            </div>
            <ChevronRight size={18} color="#6d28d9" />
          </Link>
        )}

        {/* Finance quick link — premium card */}
        <Link
          href="/telegram/m/stats"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            margin: `0 ${PAGE_PADDING_X}px`,
            padding: 16,
            background: T.surface,
            border: `1px solid ${T.borderSubtle}`,
            borderRadius: R.md,
            textDecoration: 'none',
            color: T.text,
            boxShadow: SHADOW.card,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <div
              style={{
                width: 44,
                height: 44,
                flexShrink: 0,
                borderRadius: 12,
                background: T.successSoft,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <TrendingUp size={20} color={T.success} strokeWidth={2.4} />
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.success, margin: 0 }}>
                Финансы · неделя
              </p>
              <p style={{ ...TYPE.h3, color: T.text, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
                {weekRevenue.toFixed(0)} ₴
                <span style={{ marginLeft: 10, fontSize: 12, fontWeight: 500, color: T.textTertiary }}>
                  {weekCompleted} {pluralize(weekCompleted, ['запись', 'записи', 'записей'])}
                </span>
              </p>
            </div>
          </div>
          <ChevronRight size={18} color={T.textTertiary} />
        </Link>

        {/* AI chat */}
        <div
          style={{
            margin: `0 ${PAGE_PADDING_X}px`,
            background: T.surface,
            border: `1px solid ${T.borderSubtle}`,
            borderRadius: R.md,
            padding: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            boxShadow: SHADOW.card,
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 4px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Sparkles size={14} color={T.accent} fill={T.accent} />
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.accent, margin: 0 }}>
                AI-помощник
              </p>
            </div>
            {chat.length > 0 && (
              <button
                type="button"
                onClick={() => { haptic('light'); setChat([]); }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '4px 8px',
                  borderRadius: 6,
                  background: 'transparent',
                  border: 'none',
                  color: T.textTertiary,
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                <Trash2 size={11} />
                Очистить
              </button>
            )}
          </div>

          {chat.length === 0 && !sending ? (
            <div style={{ padding: '4px 4px 4px', fontSize: 12.5, lineHeight: 1.45, color: T.textSecondary }}>
              Спроси — запишу расход, создам напоминание, отвечу про выручку или клиентов. Голосом — продиктуй в TG-боте.
            </div>
          ) : (
            <div style={{ maxHeight: '55vh', minHeight: 240, overflowY: 'auto', padding: '0 4px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {chat.map((m, i) => (
                <div
                  key={i}
                  style={{
                    maxWidth: '85%',
                    alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                    padding: '8px 12px',
                    borderRadius: 16,
                    borderBottomRightRadius: m.role === 'user' ? 4 : 16,
                    borderBottomLeftRadius: m.role === 'user' ? 16 : 4,
                    background: m.role === 'user' ? T.accent : T.bgSubtle,
                    color: m.role === 'user' ? '#fff' : T.text,
                    fontSize: 13,
                    lineHeight: 1.45,
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {m.content}
                </div>
              ))}
              {sending && (
                <div
                  style={{
                    alignSelf: 'flex-start',
                    padding: '8px 12px',
                    borderRadius: 16,
                    background: T.bgSubtle,
                    color: T.textSecondary,
                    fontSize: 13,
                  }}
                >
                  думаю…
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void sendMessage();
                }
              }}
              disabled={sending}
              placeholder="Спросить помощника…"
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: R.pill,
                border: `1px solid ${T.border}`,
                background: T.surfaceElevated,
                fontSize: 13,
                color: T.text,
                outline: 'none',
                fontFamily: 'inherit',
              }}
            />
            <button
              type="button"
              onClick={sendMessage}
              disabled={!input.trim() || sending}
              style={{
                width: 40,
                height: 40,
                flexShrink: 0,
                borderRadius: '50%',
                border: 'none',
                background: input.trim() ? T.accent : T.bgSubtle,
                color: input.trim() ? '#fff' : T.textTertiary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: input.trim() && !sending ? 'pointer' : 'not-allowed',
                transition: 'background 200ms ease',
              }}
              aria-label="Отправить"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </motion.div>
    </MobilePage>
  );
}

function pluralize(n: number, forms: [string, string, string]): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return forms[0];
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return forms[1];
  return forms[2];
}
