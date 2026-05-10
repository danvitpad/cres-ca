/** --- YAML
 * name: AIChatSheet
 * description: Bottom-sheet чат с AI-консьержем. Premium UX: streaming-плейсхолдер,
 *              action-cards inline (master / appointment / time slots), quick-reply
 *              чипы, voice-кнопка. История в sessionStorage. Открывается из любой
 *              страницы клиента (search header, home AI-chip).
 * created: 2026-04-26
 * --- */

'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Bot, X, Star, Calendar, Mic } from 'lucide-react';
import { useTelegram } from './telegram-provider';
import { AvatarCircle } from './shells';
import { T, R, TYPE, SHADOW, PAGE_PADDING_X, FONT_BASE } from './design';
import { useAuthStore } from '@/stores/auth-store';
import { formatMoney } from '@/lib/format/money';
import { useMiniAppLocale, type MiniAppLang } from '@/lib/miniapp/use-locale';

// ─────────── i18n словарь UI чата ───────────
const I18N: Record<MiniAppLang, {
  title: string;
  thinking: string; ready: string;
  clear: string; close: string;
  placeholder: string;
  send: string; record: string; recording: string;
  welcomeTitle: string; welcomeBody: string;
  prompts: string[];
  upcoming: string; cancelled: string;
  todayAt: string; tomorrowAt: string;
  cancelLabel: string; cancellingLabel: string; confirmCancel: string;
  cancelFailed: string; networkError: string; replyFailed: string; connectionLost: string;
  micFailed: string;
  monthsShort: string;
}> = {
  uk: {
    title: 'AI-консьєрж',
    thinking: 'Думаю…', ready: 'Готовий допомогти',
    clear: 'Очистити', close: 'Закрити',
    placeholder: 'Запитати про запис, майстра, послугу…',
    send: 'Надіслати', record: 'Натисни і говори', recording: 'Йде запис',
    welcomeTitle: 'Чим можу допомогти?',
    welcomeBody: 'Запис, перенесення, скасування, витрати, бонуси, твої майстри — пиши або говори голосом, я зрозумію.',
    prompts: ['Які в мене записи?', 'Скільки я витратила цього місяця?', 'Скільки в мене бонусів?', 'Хто мої майстри?', 'Скасуй мій запис', 'Що ти вмієш?'],
    upcoming: 'Найближчий запис', cancelled: 'Скасовано',
    todayAt: 'Сьогодні о', tomorrowAt: 'Завтра о',
    cancelLabel: 'Скасувати запис', cancellingLabel: 'Скасовуємо…', confirmCancel: 'Скасувати цей запис?',
    cancelFailed: 'Не вдалось скасувати', networkError: 'Помилка мережі',
    replyFailed: 'Не вдалось відповісти', connectionLost: 'Зʼєднання обірвалось. Спробуй ще раз.',
    micFailed: 'Не вдалось отримати доступ до мікрофона',
    monthsShort: 'uk-UA',
  },
  ru: {
    title: 'AI-консьерж',
    thinking: 'Думаю…', ready: 'Готов помочь',
    clear: 'Очистить', close: 'Закрыть',
    placeholder: 'Спросить о записи, мастере, услуге…',
    send: 'Отправить', record: 'Зажми и говори', recording: 'Идёт запись',
    welcomeTitle: 'Чем могу помочь?',
    welcomeBody: 'Запись, перенос, отмена, расходы, бонусы, твои мастера — пиши или говори голосом, я пойму.',
    prompts: ['Какие у меня записи?', 'Сколько я потратила в этом месяце?', 'Сколько у меня бонусов?', 'Кто мои мастера?', 'Отмени мою запись', 'Что ты умеешь?'],
    upcoming: 'Ближайшая запись', cancelled: 'Отменено',
    todayAt: 'Сегодня в', tomorrowAt: 'Завтра в',
    cancelLabel: 'Отменить запись', cancellingLabel: 'Отменяем…', confirmCancel: 'Отменить эту запись?',
    cancelFailed: 'Не удалось отменить', networkError: 'Сетевая ошибка',
    replyFailed: 'Не удалось ответить', connectionLost: 'Соединение прервалось. Попробуй ещё раз.',
    micFailed: 'Не удалось получить доступ к микрофону',
    monthsShort: 'ru-RU',
  },
  en: {
    title: 'AI Concierge',
    thinking: 'Thinking…', ready: 'Ready to help',
    clear: 'Clear', close: 'Close',
    placeholder: 'Ask about a booking, master, or service…',
    send: 'Send', record: 'Hold to talk', recording: 'Recording',
    welcomeTitle: 'How can I help?',
    welcomeBody: 'Bookings, reschedule, cancel, spending, bonuses, your masters — type or speak, I will understand.',
    prompts: ['What are my appointments?', 'How much did I spend this month?', 'My bonuses balance?', 'Who are my masters?', 'Cancel my appointment', 'What can you do?'],
    upcoming: 'Upcoming', cancelled: 'Cancelled',
    todayAt: 'Today at', tomorrowAt: 'Tomorrow at',
    cancelLabel: 'Cancel booking', cancellingLabel: 'Cancelling…', confirmCancel: 'Cancel this booking?',
    cancelFailed: 'Could not cancel', networkError: 'Network error',
    replyFailed: 'Failed to respond', connectionLost: 'Connection lost. Try again.',
    micFailed: 'Could not access microphone',
    monthsShort: 'en-GB',
  },
};

interface ActionCard {
  type: 'master' | 'appointment' | 'time-slot' | 'slot-list';
  data: Record<string, unknown>;
}

interface ChatMsg {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  actions?: ActionCard[];
  suggestions?: string[];
  ts: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** Initial prompt автозаполняется при открытии (из chip-кнопки). */
  initialPrompt?: string | null;
}

const STORAGE_KEY = 'cres-ai-chat-history';

export function AIChatSheet({ open, onClose, initialPrompt }: Props) {
  const { haptic } = useTelegram();
  const { userId } = useAuthStore();
  const lang = useMiniAppLocale();
  const t = I18N[lang];
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Restore history from sessionStorage on first open
  useEffect(() => {
    if (!open) return;
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const arr = JSON.parse(raw) as ChatMsg[];
        if (Array.isArray(arr)) setMessages(arr);
      }
    } catch {
      /* ignore */
    }
    // Auto-fill initial prompt and submit it
    if (initialPrompt && messages.length === 0) {
      setInput(initialPrompt);
      // small delay so user sees the prompt
      setTimeout(() => sendNow(initialPrompt), 200);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Save history on change
  useEffect(() => {
    if (messages.length === 0) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-20)));
    } catch {
      /* ignore */
    }
  }, [messages]);

  // Scroll to bottom on new message
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, [messages, sending]);

  async function startRecording() {
    if (recording || transcribing) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const rec = new MediaRecorder(stream, { mimeType: pickMimeType() });
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (audioChunksRef.current.length === 0) {
          setRecording(false);
          return;
        }
        const blob = new Blob(audioChunksRef.current, { type: rec.mimeType });
        await transcribe(blob);
        setRecording(false);
      };
      mediaRecorderRef.current = rec;
      rec.start();
      setRecording(true);
      haptic('medium');
    } catch {
      alert(t.micFailed);
    }
  }

  function stopRecording() {
    const rec = mediaRecorderRef.current;
    if (!rec) return;
    if (rec.state === 'recording') rec.stop();
    haptic('light');
  }

  async function transcribe(blob: Blob) {
    setTranscribing(true);
    try {
      const fd = new FormData();
      const ext = blob.type.includes('webm') ? 'webm' : blob.type.includes('mp4') ? 'm4a' : 'audio';
      fd.append('audio', new File([blob], `voice.${ext}`, { type: blob.type }));
      const res = await fetch('/api/ai/client-voice', { method: 'POST', body: fd });
      const j = await res.json();
      if (j.text) {
        setInput(j.text);
        haptic('success');
      } else {
        haptic('error');
      }
    } catch {
      haptic('error');
    } finally {
      setTranscribing(false);
    }
  }

  async function sendNow(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    haptic('light');
    const userMsg: ChatMsg = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: trimmed,
      ts: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');

    // Build history for AI: last 8 exchanges
    const history = messages
      .slice(-8)
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    try {
      const res = await fetch('/api/ai/client-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          history,
          userId,
          locale: lang,
        }),
      });
      const data = await res.json();
      const reply: ChatMsg = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: data.reply ?? data.message ?? t.replyFailed,
        actions: data.actions ?? [],
        suggestions: data.suggestions ?? [],
        ts: Date.now(),
      };
      setMessages((prev) => [...prev, reply]);
      haptic('success');
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: t.connectionLost,
          ts: Date.now(),
        },
      ]);
      haptic('error');
    } finally {
      setSending(false);
    }
  }

  function clearHistory() {
    setMessages([]);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    haptic('selection');
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 60,
              background: 'rgba(10,10,12,0.5)',
              backdropFilter: 'blur(2px)',
            }}
          />
          {/* Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 32 }}
            style={{
              ...FONT_BASE,
              position: 'fixed',
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 70,
              maxHeight: '88dvh',
              minHeight: '60dvh',
              display: 'flex',
              flexDirection: 'column',
              background: T.bg,
              borderRadius: `${R.lg}px ${R.lg}px 0 0`,
              boxShadow: SHADOW.elevated,
              overflow: 'hidden',
            }}
          >
            {/* Drag handle */}
            <div
              style={{
                margin: '10px auto 0',
                width: 40,
                height: 4,
                borderRadius: 999,
                background: T.border,
              }}
            />

            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: `12px ${PAGE_PADDING_X}px`,
                borderBottom: `1px solid ${T.borderSubtle}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: T.accentSoft,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Bot size={18} color={T.accent} strokeWidth={2.2} />
                </div>
                <div>
                  <h3 style={{ ...TYPE.h3, fontSize: 16, color: T.text, margin: 0 }}>{t.title}</h3>
                  <p style={{ ...TYPE.micro, margin: 0 }}>{sending ? t.thinking : t.ready}</p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {messages.length > 0 && (
                  <button
                    type="button"
                    onClick={clearHistory}
                    style={{
                      padding: '6px 12px',
                      borderRadius: R.pill,
                      border: `1px solid ${T.border}`,
                      background: 'transparent',
                      color: T.textSecondary,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    {t.clear}
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    border: 'none',
                    background: T.bgSubtle,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                  aria-label={t.close}
                >
                  <X size={18} color={T.textSecondary} />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div
              ref={scrollRef}
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: `16px ${PAGE_PADDING_X}px`,
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
              }}
            >
              {messages.length === 0 && (
                <Welcome onPrompt={(p) => sendNow(p)} t={t} />
              )}
              {messages.map((m) => (
                <Bubble key={m.id} msg={m} onSuggestion={(s) => sendNow(s)} t={t} lang={lang} />
              ))}
              {sending && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 14px' }}>
                  <TypingDots />
                </div>
              )}
            </div>

            {/* Input bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendNow(input);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: `12px ${PAGE_PADDING_X}px`,
                paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
                borderTop: `1px solid ${T.borderSubtle}`,
                background: T.surface,
              }}
            >
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t.placeholder}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  borderRadius: R.pill,
                  border: `1px solid ${T.border}`,
                  background: T.surfaceElevated,
                  ...TYPE.body,
                  color: T.text,
                  outline: 'none',
                  fontFamily: 'inherit',
                }}
                autoFocus
              />
              {/* Voice button — visible when input is empty. Long-press semantics:
                  pointerdown → start recording, pointerup → stop + transcribe.
                  Touch + mouse через Pointer Events (унификация). */}
              {!input.trim() && (
                <button
                  type="button"
                  disabled={sending || transcribing}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    void startRecording();
                  }}
                  onPointerUp={(e) => {
                    e.preventDefault();
                    if (recording) stopRecording();
                  }}
                  onPointerCancel={() => {
                    if (recording) stopRecording();
                  }}
                  onPointerLeave={() => {
                    if (recording) stopRecording();
                  }}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    border: 'none',
                    background: recording ? T.danger : T.accent,
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    flexShrink: 0,
                    transition: 'background 150ms ease, transform 150ms ease',
                    transform: recording ? 'scale(1.1)' : 'scale(1)',
                    boxShadow: recording ? `0 0 0 6px ${T.danger}33` : 'none',
                    opacity: transcribing ? 0.5 : 1,
                  }}
                  aria-label={recording ? t.recording : t.record}
                  title={t.record}
                >
                  <Mic size={18} strokeWidth={2.4} />
                </button>
              )}
              {input.trim() && (
              <button
                type="submit"
                disabled={sending}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  border: 'none',
                  background: T.accent,
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: sending ? 'not-allowed' : 'pointer',
                  flexShrink: 0,
                  transition: 'background 200ms ease',
                }}
                aria-label={t.send}
              >
                <Send size={18} />
              </button>
              )}
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function Welcome({ onPrompt, t }: { onPrompt: (p: string) => void; t: typeof I18N[MiniAppLang] }) {
  const prompts = t.prompts;
  return (
    <div style={{ padding: '20px 0', textAlign: 'center' }}>
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          background: `linear-gradient(135deg, ${T.gradientFrom}, ${T.gradientTo})`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px',
        }}
      >
        <Bot size={28} color="#fff" strokeWidth={2} />
      </div>
      <h2 style={{ ...TYPE.h2, color: T.text, margin: 0 }}>{t.welcomeTitle}</h2>
      <p style={{ ...TYPE.body, color: T.textSecondary, marginTop: 6, maxWidth: 280, marginLeft: 'auto', marginRight: 'auto' }}>
        {t.welcomeBody}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 24 }}>
        {prompts.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPrompt(p)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 16px',
              borderRadius: R.pill,
              border: `1px solid ${T.borderSubtle}`,
              background: T.surface,
              color: T.text,
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: 'inherit',
              textAlign: 'left',
            }}
          >
            <Bot size={14} color={T.accent} />
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}

function Bubble({ msg, onSuggestion, t, lang }: { msg: ChatMsg; onSuggestion: (s: string) => void; t: typeof I18N[MiniAppLang]; lang: MiniAppLang }) {
  const isUser = msg.role === 'user';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: isUser ? 'flex-end' : 'flex-start' }}>
      <div
        style={{
          maxWidth: '85%',
          padding: '10px 14px',
          borderRadius: 18,
          borderBottomRightRadius: isUser ? 4 : 18,
          borderBottomLeftRadius: isUser ? 18 : 4,
          background: isUser ? T.accent : T.bgSubtle,
          color: isUser ? '#fff' : T.text,
          ...TYPE.body,
          whiteSpace: 'pre-wrap',
        }}
      >
        {msg.content}
      </div>
      {/* Action cards */}
      {msg.actions && msg.actions.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: '85%' }}>
          {msg.actions.map((a, i) => {
            if (a.type === 'master') return <MasterActionCard key={i} data={a.data as unknown as MasterCardData} />;
            if (a.type === 'appointment') return <AppointmentActionCard key={i} data={a.data as unknown as AppointmentCardData} t={t} />;
            if (a.type === 'slot-list') return <SlotListActionCard key={i} data={a.data as unknown as SlotListData} lang={lang} />;
            return null;
          })}
        </div>
      )}
      {/* Suggestion chips */}
      {msg.suggestions && msg.suggestions.length > 0 && !isUser && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {msg.suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onSuggestion(s)}
              style={{
                padding: '6px 12px',
                borderRadius: R.pill,
                border: `1px solid ${T.border}`,
                background: T.surface,
                color: T.accent,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface MasterCardData {
  id: string;
  slug: string;
  name: string;
  avatar: string | null;
  city: string | null;
  specialization: string | null;
  rating: number | null;
  reviewsCount: number;
}

function MasterActionCard({ data }: { data: MasterCardData }) {
  return (
    <Link
      href={`/m/${data.slug}`}
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
        boxShadow: SHADOW.card,
      }}
    >
      <AvatarCircle url={data.avatar} name={data.name} size={48} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ ...TYPE.bodyStrong, color: T.text, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {data.name}
        </p>
        {data.specialization && (
          <p style={{ ...TYPE.caption, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {data.specialization}
          </p>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
          {(data.rating ?? 0) > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 12, fontWeight: 600 }}>
              <Star size={12} fill="#f59e0b" color="#f59e0b" />
              {data.rating?.toFixed(1)}
              <span style={{ color: T.textTertiary, fontWeight: 500 }}>({data.reviewsCount})</span>
            </span>
          )}
          {data.city && (
            <span style={{ ...TYPE.micro, marginLeft: 'auto' }}>{data.city}</span>
          )}
        </div>
      </div>
    </Link>
  );
}

interface AppointmentCardData {
  id: string;
  starts_at: string;
  service_name: string;
  master_name: string | null;
  price: number | null;
  currency: string | null;
}

function AppointmentActionCard({ data, t }: { data: AppointmentCardData; t: typeof I18N[MiniAppLang] }) {
  const [cancelling, setCancelling] = useState(false);
  const [cancelled, setCancelled] = useState(false);

  const d = new Date(data.starts_at);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today.getTime() + 86400000);
  const time = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  let dateLabel = `${d.toLocaleDateString(t.monthsShort, { day: 'numeric', month: 'short' })} ${time}`;
  if (target.getTime() === today.getTime()) dateLabel = `${t.todayAt} ${time}`;
  else if (target.getTime() === tomorrow.getTime()) dateLabel = `${t.tomorrowAt} ${time}`;

  async function handleCancel(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (cancelling || cancelled) return;
    if (!confirm(t.confirmCancel)) return;
    setCancelling(true);
    try {
      const res = await fetch('/api/ai/client-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel', appointment_id: data.id }),
      });
      const j = await res.json();
      if (j.ok) setCancelled(true);
      else alert(j.message || j.error || t.cancelFailed);
    } catch {
      alert(t.networkError);
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: 14,
        background: T.surface,
        border: `1px solid ${T.borderSubtle}`,
        borderRadius: R.md,
        boxShadow: SHADOW.card,
        opacity: cancelled ? 0.5 : 1,
      }}
    >
      <Link
        href={`/telegram/activity/${data.id}`}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          textDecoration: 'none',
          color: T.text,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: T.accent, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          <Calendar size={12} /> {cancelled ? t.cancelled : t.upcoming}
        </div>
        <p style={{ ...TYPE.bodyStrong, color: T.text, margin: 0 }}>{data.service_name}</p>
        <p style={{ ...TYPE.caption }}>
          {dateLabel}{data.master_name ? ` · ${data.master_name}` : ''}
        </p>
        {data.price && data.price > 0 && (
          <p style={{ ...TYPE.bodyStrong, color: T.text, margin: 0, fontSize: 14 }}>
            {formatMoney(data.price, data.currency)}
          </p>
        )}
      </Link>
      {!cancelled && (
        <button
          type="button"
          onClick={handleCancel}
          disabled={cancelling}
          style={{
            alignSelf: 'flex-start',
            padding: '6px 12px',
            borderRadius: R.pill,
            border: `1px solid ${T.danger}40`,
            background: T.dangerSoft,
            color: T.danger,
            fontSize: 12,
            fontWeight: 600,
            cursor: cancelling ? 'wait' : 'pointer',
            fontFamily: 'inherit',
            opacity: cancelling ? 0.6 : 1,
          }}
        >
          {cancelling ? t.cancellingLabel : t.cancelLabel}
        </button>
      )}
    </div>
  );
}

interface SlotListData {
  masterId: string;
  serviceId: string;
  serviceName: string;
  durationMinutes: number;
  date: string;        // YYYY-MM-DD
  slots: string[];     // ["10:00", "10:30", ...]
}

function SlotListActionCard({ data, lang }: { data: SlotListData; lang: MiniAppLang }) {
  const [bookingTime, setBookingTime] = useState<string | null>(null);
  const [bookedTime, setBookedTime] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dateLabel = new Date(`${data.date}T12:00:00`).toLocaleDateString(
    lang === 'uk' ? 'uk-UA' : lang === 'en' ? 'en-GB' : 'ru-RU',
    { day: 'numeric', month: 'long', weekday: 'short', timeZone: 'Europe/Kiev' },
  );

  async function book(time: string) {
    if (bookingTime || bookedTime) return;
    setBookingTime(time);
    setError(null);
    try {
      // Собираем ISO как Kyiv-локальное время → UTC. Без таймзоны, ставим
      // wall-clock и пускаем браузер привязать к локальной (Kyiv для UA-юзера).
      const [y, m, d] = data.date.split('-').map(Number);
      const [h, mi] = time.split(':').map(Number);
      const starts = new Date(y, m - 1, d, h, mi, 0, 0);
      const res = await fetch('/api/ai/client-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'book',
          master_id: data.masterId,
          service_id: data.serviceId,
          starts_at: starts.toISOString(),
        }),
      });
      const j = await res.json();
      if (j.ok) {
        setBookedTime(time);
      } else {
        setError(j.message || j.error || (lang === 'uk' ? 'Не вдалось записати' : lang === 'en' ? "Couldn't book" : 'Не удалось записать'));
      }
    } catch {
      setError(lang === 'uk' ? 'Помилка мережі' : lang === 'en' ? 'Network error' : 'Сетевая ошибка');
    } finally {
      setBookingTime(null);
    }
  }

  const headLabel = bookedTime
    ? (lang === 'uk' ? '✅ Записано' : lang === 'en' ? '✅ Booked' : '✅ Записано')
    : data.serviceName;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: 12,
        background: T.surface,
        border: `1px solid ${T.borderSubtle}`,
        borderRadius: R.md,
        boxShadow: SHADOW.card,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: T.accent, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        <Calendar size={12} /> {dateLabel} · {data.durationMinutes} {lang === 'uk' ? 'хв' : lang === 'en' ? 'min' : 'мин'}
      </div>
      <p style={{ ...TYPE.bodyStrong, color: T.text, margin: 0 }}>{headLabel}</p>
      {!bookedTime && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {data.slots.map((s) => {
            const isBusy = bookingTime === s;
            return (
              <button
                key={s}
                type="button"
                disabled={!!bookingTime}
                onClick={() => book(s)}
                style={{
                  padding: '8px 14px',
                  borderRadius: R.pill,
                  border: `1px solid ${T.border}`,
                  background: isBusy ? T.accent : T.bgSubtle,
                  color: isBusy ? '#fff' : T.text,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: bookingTime ? 'wait' : 'pointer',
                  fontFamily: 'inherit',
                  opacity: bookingTime && !isBusy ? 0.4 : 1,
                  transition: 'background 150ms ease',
                }}
              >
                {s}
              </button>
            );
          })}
        </div>
      )}
      {bookedTime && (
        <p style={{ ...TYPE.caption, color: T.textSecondary, margin: 0 }}>
          {lang === 'uk' ? `Час: ${bookedTime}` : lang === 'en' ? `Time: ${bookedTime}` : `Время: ${bookedTime}`}
        </p>
      )}
      {error && (
        <p style={{ ...TYPE.caption, color: T.danger, margin: 0 }}>{error}</p>
      )}
    </div>
  );
}

function pickMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return 'audio/webm';
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
  for (const t of candidates) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return 'audio/webm';
}

function TypingDots() {
  return (
    <>
      <style>{`
        @keyframes ai-typing {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>
      <div style={{ display: 'flex', gap: 4, padding: '8px 12px', background: T.bgSubtle, borderRadius: 14 }}>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: T.textSecondary,
              animation: `ai-typing 1.2s ${i * 0.15}s infinite`,
              display: 'inline-block',
            }}
          />
        ))}
      </div>
    </>
  );
}
