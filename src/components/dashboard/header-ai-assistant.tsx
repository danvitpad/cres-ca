/** --- YAML
 * name: HeaderAiAssistant
 * description: AI-помощник в шапке dashboard. Кнопка в центре header → открывает
 *              модальное окно с чатом. Использует /api/ai/assistant endpoint.
 *              Заменяет inline-чат на /today и LostRevenueCard на /finance.
 * created: 2026-05-11
 * --- */

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Send, Loader2, X, Trash2, HelpCircle } from 'lucide-react';
import type { FTheme } from '@/lib/dashboard-theme';

// Палитра под header (берётся из дизайн-токенов, не из FTheme — у FTheme
// нет accent / cardBg / textMuted полей).
const P = {
  light: {
    accent: '#2563eb',
    cardBg: '#ffffff',
    border: 'rgba(0,0,0,0.08)',
    text: '#0a0a0a',
    textMuted: '#71717a',
    inputBg: '#fafafa',
    inputBorder: 'rgba(0,0,0,0.10)',
    bubbleBg: '#f4f4f5',
    hoverBg: 'rgba(0,0,0,0.05)',
    buttonGradient: 'linear-gradient(135deg, rgba(37, 99, 235, 0.08) 0%, rgba(168, 85, 247, 0.06) 100%)',
    iconBg: 'rgba(37, 99, 235, 0.10)',
    shadow: '0 24px 60px rgba(16, 24, 40, 0.18), 0 8px 16px rgba(16, 24, 40, 0.08)',
    boxShadowSmall: '0 2px 8px rgba(37, 99, 235, 0.10)',
    boxShadowHover: '0 4px 12px rgba(37, 99, 235, 0.16)',
  },
  dark: {
    accent: '#60a5fa',
    cardBg: '#1a1a1d',
    border: '#27272a',
    text: '#fafafa',
    textMuted: '#a1a1aa',
    inputBg: '#27272a',
    inputBorder: '#27272a',
    bubbleBg: '#27272a',
    hoverBg: 'rgba(255,255,255,0.06)',
    buttonGradient: 'linear-gradient(135deg, rgba(96, 165, 250, 0.12) 0%, rgba(168, 85, 247, 0.10) 100%)',
    iconBg: 'rgba(96, 165, 250, 0.16)',
    shadow: '0 24px 60px rgba(0,0,0,0.6), 0 8px 16px rgba(0,0,0,0.3)',
    boxShadowSmall: '0 2px 8px rgba(96, 165, 250, 0.15)',
    boxShadowHover: '0 4px 12px rgba(96, 165, 250, 0.25)',
  },
};

interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
  ts: number;
}

interface Props {
  theme: FTheme;
  isDark: boolean;
}

export function HeaderAiAssistant({ theme: _F, isDark }: Props) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _unused = _F; // theme не используется напрямую — палитра через P[isDark]
  const C = isDark ? P.dark : P.light;
  const [open, setOpen] = useState(false);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (open) {
      // small delay чтобы dialog успел отрендериться
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [chat.length, sending]);

  // Esc → close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const sendChat = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || sending) return;
    const userMsg: ChatMsg = { role: 'user', content: trimmed, ts: Date.now() };
    setChat((prev) => [...prev, userMsg]);
    setInput('');
    setSending(true);
    try {
      const history = chat.map((m) => ({ role: m.role, content: m.content }));
      const res = await fetch('/api/ai/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, history }),
      });
      const json = await res.json().catch(() => ({}));
      const answer = res.ok && json.answer
        ? json.answer
        : (json.error === 'ai_unavailable'
            ? 'AI временно недоступен. Попробуй позже.'
            : 'Что-то пошло не так.');
      setChat((prev) => [...prev, { role: 'assistant', content: answer, ts: Date.now() }]);
    } catch {
      setChat((prev) => [...prev, { role: 'assistant', content: 'Ошибка сети.', ts: Date.now() }]);
    } finally {
      setSending(false);
    }
  }, [input, sending, chat]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="AI-помощник"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 18px',
          height: 38,
          borderRadius: 999,
          background: C.buttonGradient,
          border: `1px solid ${C.accent}`,
          color: C.accent,
          fontFamily: 'inherit',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
          letterSpacing: '-0.005em',
          transition: 'all 200ms cubic-bezier(0.16, 1, 0.3, 1)',
          boxShadow: C.boxShadowSmall,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-1px)';
          e.currentTarget.style.boxShadow = C.boxShadowHover;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = C.boxShadowSmall;
        }}
      >
        <Bot style={{ width: 16, height: 16 }} />
        <span>AI-помощник</span>
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setOpen(false)}
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(15, 18, 24, 0.55)',
                backdropFilter: 'blur(4px)',
                zIndex: 9998,
              }}
            />

            {/* Modal */}
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="AI-помощник"
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              style={{
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 'min(640px, calc(100vw - 32px))',
                maxHeight: 'min(720px, calc(100vh - 64px))',
                background: C.cardBg,
                borderRadius: 20,
                boxShadow: C.shadow,
                border: `1px solid ${C.border}`,
                display: 'flex',
                flexDirection: 'column',
                zIndex: 9999,
                fontFamily: 'inherit',
                color: C.text,
              }}
            >
              {/* Header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '18px 22px',
                  borderBottom: `1px solid ${C.border}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 12,
                      background: C.iconBg,
                      color: C.accent,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Bot style={{ width: 20, height: 20 }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em' }}>
                      AI-помощник
                    </div>
                    <div style={{ fontSize: 12, color: C.textMuted, marginTop: 1 }}>
                      Спроси по своим данным или поручи действие
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <button
                    onClick={() => setShowHelp((v) => !v)}
                    aria-label="Команды"
                    style={{
                      width: 36,
                      height: 36,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 10,
                      border: 'none',
                      background: showHelp ? C.hoverBg : 'transparent',
                      color: C.textMuted,
                      cursor: 'pointer',
                    }}
                  >
                    <HelpCircle style={{ width: 16, height: 16 }} />
                  </button>
                  {chat.length > 0 && (
                    <button
                      onClick={() => setChat([])}
                      aria-label="Очистить"
                      style={{
                        width: 36,
                        height: 36,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 10,
                        border: 'none',
                        background: 'transparent',
                        color: C.textMuted,
                        cursor: 'pointer',
                      }}
                    >
                      <Trash2 style={{ width: 16, height: 16 }} />
                    </button>
                  )}
                  <button
                    onClick={() => setOpen(false)}
                    aria-label="Закрыть"
                    style={{
                      width: 36,
                      height: 36,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 10,
                      border: 'none',
                      background: 'transparent',
                      color: C.textMuted,
                      cursor: 'pointer',
                    }}
                  >
                    <X style={{ width: 18, height: 18 }} />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div
                style={{
                  flex: 1,
                  minHeight: 240,
                  maxHeight: 480,
                  overflowY: 'auto',
                  padding: '20px 22px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                {showHelp ? (
                  <VoiceCommandsHelp C={C} />
                ) : chat.length === 0 ? (
                  <div
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 12,
                      textAlign: 'center',
                      color: C.textMuted,
                    }}
                  >
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 14,
                        background: C.iconBg,
                        color: C.accent,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Bot style={{ width: 22, height: 22 }} />
                    </div>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 600, color: C.text, margin: 0 }}>
                        Начни разговор
                      </p>
                      <p style={{ fontSize: 13, marginTop: 6, maxWidth: 340 }}>
                        Спроси «Кто из клиентов не был 2 месяца?» или поручи «Напомни завтра позвонить Анне в 10:00».
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    {chat.map((m, i) => (
                      <div
                        key={i}
                        style={{
                          alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                          maxWidth: '80%',
                          background: m.role === 'user' ? C.accent : C.bubbleBg,
                          color: m.role === 'user' ? '#ffffff' : C.text,
                          padding: '10px 14px',
                          borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                          fontSize: 14,
                          lineHeight: 1.5,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                        }}
                      >
                        {m.content}
                      </div>
                    ))}
                    {sending && (
                      <div
                        style={{
                          alignSelf: 'flex-start',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '10px 14px',
                          background: C.bubbleBg,
                          borderRadius: '16px 16px 16px 4px',
                          fontSize: 13,
                          color: C.textMuted,
                        }}
                      >
                        <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" />
                        думаю…
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </>
                )}
              </div>

              {/* Input */}
              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  alignItems: 'flex-end',
                  padding: '14px 22px 20px',
                  borderTop: `1px solid ${C.border}`,
                }}
              >
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendChat();
                    }
                  }}
                  rows={1}
                  placeholder="Напиши команду или вопрос…"
                  disabled={sending}
                  style={{
                    flex: 1,
                    resize: 'none',
                    borderRadius: 12,
                    border: `1px solid ${C.inputBorder}`,
                    background: C.inputBg,
                    color: C.text,
                    padding: '12px 14px',
                    fontFamily: 'inherit',
                    fontSize: 14,
                    lineHeight: 1.45,
                    outline: 'none',
                    minHeight: 46,
                    maxHeight: 140,
                  }}
                />
                <button
                  onClick={sendChat}
                  disabled={sending || !input.trim()}
                  aria-label="Отправить"
                  style={{
                    width: 46,
                    height: 46,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 12,
                    border: 'none',
                    background: C.accent,
                    color: '#ffffff',
                    cursor: sending || !input.trim() ? 'not-allowed' : 'pointer',
                    opacity: sending || !input.trim() ? 0.4 : 1,
                    transition: 'opacity 150ms',
                    boxShadow: '0 2px 8px rgba(37, 99, 235, 0.20)',
                  }}
                >
                  {sending ? (
                    <Loader2 style={{ width: 16, height: 16 }} className="animate-spin" />
                  ) : (
                    <Send style={{ width: 16, height: 16 }} />
                  )}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function VoiceCommandsHelp({ C }: { C: typeof P.light }) {
  const groups = [
    {
      title: 'Напоминания',
      items: [
        '«Напомни завтра в 10 позвонить Анне» — создаст напоминание с датой',
        '«Напомни в пятницу купить краску» — без привязки к клиенту',
      ],
    },
    {
      title: 'Записи',
      items: [
        '«Запиши Машу на стрижку в пятницу 15:00»',
        '«Отмени Колю завтра»',
        '«Перенеси Иру с пятницы на субботу 14:00»',
      ],
    },
    {
      title: 'Клиенты',
      items: [
        '«Новая клиентка Марина, телефон 0671234567»',
        '«Добавь Таисии день рождения 5 марта 1998»',
        '«У Анны теперь телефон 0671234567»',
      ],
    },
    {
      title: 'Финансы',
      items: [
        '«Потратил 500 на краску»',
        '«Аренда 5000 каждое 1-е число»',
        '«Сегодня Аня стрижка 1200, Маша окрашивание 2500»',
      ],
    },
    {
      title: 'Вопросы',
      items: [
        '«Сколько заработал сегодня?»',
        '«Кто спящий клиент?»',
        '«Топ услуга этого месяца»',
      ],
    },
  ];
  return (
    <div style={{ fontSize: 13, color: C.text }}>
      <p style={{ fontSize: 13, color: C.textMuted, marginBottom: 16, lineHeight: 1.5 }}>
        AI распознаёт свободную речь. Эти примеры — форматы, которые точно поймёт.
      </p>
      {groups.map((g) => (
        <div key={g.title} style={{ marginBottom: 18 }}>
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: C.textMuted,
              marginBottom: 8,
            }}
          >
            {g.title}
          </p>
          <ul style={{ display: 'flex', flexDirection: 'column', gap: 4, listStyle: 'none', padding: 0, margin: 0 }}>
            {g.items.map((it, i) => (
              <li
                key={i}
                style={{
                  padding: '8px 12px',
                  background: C.bubbleBg,
                  borderRadius: 8,
                  fontSize: 13,
                  lineHeight: 1.4,
                }}
              >
                {it}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
