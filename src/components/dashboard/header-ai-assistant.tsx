/** --- YAML
 * name: HeaderAiAssistant
 * description: AI-помощник в шапке dashboard. Кнопка в шапке открывает плавающее
 *              окно с чатом — non-modal (без блокирующего фона), draggable за
 *              header, кнопки «свернуть» и «закрыть». Свёрнутое окно — пилюля
 *              справа внизу. Положение окна + история чата сохраняются в
 *              localStorage: переживает перезагрузки, переключение вкладок,
 *              перезаход в браузер.
 * created: 2026-05-11
 * --- */

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Send, Loader2, X, Trash2, HelpCircle, Minus, Move } from 'lucide-react';
import type { FTheme } from '@/lib/dashboard-theme';

interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
  ts: number;
}

interface Props {
  theme: FTheme;
  isDark: boolean;
}

// Палитра для попапа — независимо от FTheme (header-only).
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
    dragHandleBg: 'rgba(0,0,0,0.02)',
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
    dragHandleBg: 'rgba(255,255,255,0.03)',
  },
};

const WINDOW_W = 420;
const WINDOW_H = 580;
const MINIMIZED_W = 220;
const STORAGE_KEY = 'cres:ai-assistant:v1';

type WindowState = 'closed' | 'open' | 'minimized';

interface PersistedState {
  state: WindowState;
  position: { x: number; y: number };
  chat: ChatMsg[];
}

function loadPersisted(): PersistedState {
  if (typeof window === 'undefined') return { state: 'closed', position: { x: 0, y: 0 }, chat: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { state: 'closed', position: { x: 0, y: 0 }, chat: [] };
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    return {
      state: (parsed.state === 'minimized' || parsed.state === 'open') ? parsed.state : 'closed',
      position: parsed.position ?? { x: 0, y: 0 },
      chat: Array.isArray(parsed.chat) ? parsed.chat : [],
    };
  } catch {
    return { state: 'closed', position: { x: 0, y: 0 }, chat: [] };
  }
}

function savePersisted(s: PersistedState) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch { /* quota / private mode */ }
}

function clampPosition(pos: { x: number; y: number }, w: number, h: number): { x: number; y: number } {
  if (typeof window === 'undefined') return pos;
  const maxX = window.innerWidth - w;
  const maxY = window.innerHeight - h;
  return {
    x: Math.max(0, Math.min(maxX, pos.x)),
    y: Math.max(0, Math.min(maxY, pos.y)),
  };
}

function defaultPosition(): { x: number; y: number } {
  if (typeof window === 'undefined') return { x: 0, y: 0 };
  return {
    x: Math.max(0, window.innerWidth - WINDOW_W - 32),
    y: 90,
  };
}

export function HeaderAiAssistant({ theme: _F, isDark }: Props) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _unused = _F;
  const C = isDark ? P.dark : P.light;

  // Mount guard — localStorage доступен только на клиенте
  const [mounted, setMounted] = useState(false);
  const [winState, setWinState] = useState<WindowState>('closed');
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; winX: number; winY: number } | null>(null);

  // Initial mount — load persisted state
  useEffect(() => {
    const persisted = loadPersisted();
    setWinState(persisted.state);
    setChat(persisted.chat);
    // Clamp position to current viewport (window could've resized since save)
    const pos = persisted.position.x === 0 && persisted.position.y === 0
      ? defaultPosition()
      : clampPosition(persisted.position, WINDOW_W, WINDOW_H);
    setPosition(pos);
    setMounted(true);
  }, []);

  // Persist on any state change
  useEffect(() => {
    if (!mounted) return;
    savePersisted({ state: winState, position, chat });
  }, [mounted, winState, position, chat]);

  // Re-clamp position on window resize
  useEffect(() => {
    const onResize = () => {
      setPosition((p) => clampPosition(p, WINDOW_W, WINDOW_H));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Focus textarea when opened
  useEffect(() => {
    if (winState === 'open') {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [winState]);

  // Scroll to bottom on new message
  useEffect(() => {
    if (winState !== 'open') return;
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [chat.length, sending, winState]);

  // Drag handlers
  const startDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      winX: position.x,
      winY: position.y,
    };
    setIsDragging(true);
  }, [position.x, position.y]);

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => {
      if (!dragStartRef.current) return;
      const dx = e.clientX - dragStartRef.current.mouseX;
      const dy = e.clientY - dragStartRef.current.mouseY;
      setPosition(clampPosition({
        x: dragStartRef.current.winX + dx,
        y: dragStartRef.current.winY + dy,
      }, WINDOW_W, WINDOW_H));
    };
    const onUp = () => {
      setIsDragging(false);
      dragStartRef.current = null;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isDragging]);

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

  const openWindow = useCallback(() => {
    setWinState('open');
    // Если позиция «свёрнутая» (внизу справа) — восстановим default
    if (typeof window !== 'undefined') {
      setPosition((p) => clampPosition(p.x === 0 && p.y === 0 ? defaultPosition() : p, WINDOW_W, WINDOW_H));
    }
  }, []);

  const minimizeWindow = useCallback(() => setWinState('minimized'), []);
  const closeWindow = useCallback(() => setWinState('closed'), []);

  // Если ещё не смонтировано — рендерим только заглушку-кнопку (SSR-safe)
  if (!mounted) {
    return (
      <button
        type="button"
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
          opacity: 0.9,
        }}
      >
        <Bot style={{ width: 16, height: 16 }} />
        <span>AI-помощник</span>
      </button>
    );
  }

  return (
    <>
      {/* Кнопка в header */}
      <button
        type="button"
        onClick={openWindow}
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
        {chat.length > 0 && winState === 'closed' && (
          <span style={{
            background: C.accent,
            color: '#fff',
            fontSize: 10,
            fontWeight: 700,
            borderRadius: 999,
            padding: '2px 7px',
            minWidth: 18,
            textAlign: 'center',
            lineHeight: 1.2,
            marginLeft: 2,
          }}>
            {chat.filter((m) => m.role === 'assistant').length}
          </span>
        )}
      </button>

      {/* Свёрнутая пилюля в правом нижнем углу */}
      <AnimatePresence>
        {winState === 'minimized' && (
          <motion.button
            type="button"
            onClick={openWindow}
            aria-label="Развернуть AI-помощник"
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: 'fixed',
              right: 20,
              bottom: 20,
              zIndex: 9998,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 16px 10px 12px',
              borderRadius: 999,
              background: C.cardBg,
              border: `1px solid ${C.accent}`,
              color: C.text,
              fontFamily: 'inherit',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: C.shadow,
              minWidth: MINIMIZED_W,
              maxWidth: 280,
            }}
          >
            <div style={{
              width: 28,
              height: 28,
              borderRadius: 999,
              background: C.iconBg,
              color: C.accent,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Bot style={{ width: 15, height: 15 }} />
            </div>
            <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              AI-помощник
            </span>
            {sending && (
              <Loader2 style={{ width: 14, height: 14, color: C.accent }} className="animate-spin" />
            )}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); closeWindow(); }}
              aria-label="Закрыть"
              style={{
                width: 24,
                height: 24,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 999,
                border: 'none',
                background: 'transparent',
                color: C.textMuted,
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <X style={{ width: 14, height: 14 }} />
            </button>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Плавающее окно (non-modal, draggable) */}
      <AnimatePresence>
        {winState === 'open' && (
          <motion.div
            role="dialog"
            aria-label="AI-помощник"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: 'fixed',
              top: position.y,
              left: position.x,
              width: WINDOW_W,
              maxWidth: 'calc(100vw - 24px)',
              height: WINDOW_H,
              maxHeight: 'calc(100vh - 24px)',
              background: C.cardBg,
              borderRadius: 16,
              boxShadow: C.shadow,
              border: `1px solid ${C.border}`,
              display: 'flex',
              flexDirection: 'column',
              zIndex: 9998,
              fontFamily: 'inherit',
              color: C.text,
              userSelect: isDragging ? 'none' : 'auto',
            }}
          >
            {/* Header — drag handle */}
            <div
              onMouseDown={startDrag}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                borderBottom: `1px solid ${C.border}`,
                background: C.dragHandleBg,
                cursor: isDragging ? 'grabbing' : 'grab',
                userSelect: 'none',
                borderRadius: '16px 16px 0 0',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, pointerEvents: 'none' }}>
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 9,
                    background: C.iconBg,
                    color: C.accent,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Bot style={{ width: 16, height: 16 }} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-0.01em' }}>
                    AI-помощник
                  </div>
                  <div style={{ fontSize: 11, color: C.textMuted, marginTop: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Move style={{ width: 10, height: 10 }} />
                    потяни чтобы переместить
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 2 }} onMouseDown={(e) => e.stopPropagation()}>
                <button
                  onClick={() => setShowHelp((v) => !v)}
                  aria-label="Команды"
                  title="Команды"
                  style={{
                    width: 30,
                    height: 30,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 8,
                    border: 'none',
                    background: showHelp ? C.hoverBg : 'transparent',
                    color: C.textMuted,
                    cursor: 'pointer',
                  }}
                >
                  <HelpCircle style={{ width: 14, height: 14 }} />
                </button>
                {chat.length > 0 && (
                  <button
                    onClick={() => setChat([])}
                    aria-label="Очистить"
                    title="Очистить чат"
                    style={{
                      width: 30,
                      height: 30,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 8,
                      border: 'none',
                      background: 'transparent',
                      color: C.textMuted,
                      cursor: 'pointer',
                    }}
                  >
                    <Trash2 style={{ width: 14, height: 14 }} />
                  </button>
                )}
                <button
                  onClick={minimizeWindow}
                  aria-label="Свернуть"
                  title="Свернуть"
                  style={{
                    width: 30,
                    height: 30,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 8,
                    border: 'none',
                    background: 'transparent',
                    color: C.textMuted,
                    cursor: 'pointer',
                  }}
                >
                  <Minus style={{ width: 16, height: 16 }} />
                </button>
                <button
                  onClick={closeWindow}
                  aria-label="Закрыть"
                  title="Закрыть"
                  style={{
                    width: 30,
                    height: 30,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 8,
                    border: 'none',
                    background: 'transparent',
                    color: C.textMuted,
                    cursor: 'pointer',
                  }}
                >
                  <X style={{ width: 16, height: 16 }} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div
              style={{
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                padding: '16px 18px',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
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
                    gap: 10,
                    textAlign: 'center',
                    color: C.textMuted,
                    padding: '12px 8px',
                  }}
                >
                  <div
                    style={{
                      width: 44,
                      height: 44,
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
                    <p style={{ fontSize: 13.5, fontWeight: 600, color: C.text, margin: 0 }}>
                      Начни разговор
                    </p>
                    <p style={{ fontSize: 12.5, marginTop: 6, lineHeight: 1.5 }}>
                      «Кто из клиентов не был 2 месяца?» или «Напомни завтра позвонить Анне в 10:00».
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
                        maxWidth: '85%',
                        background: m.role === 'user' ? C.accent : C.bubbleBg,
                        color: m.role === 'user' ? '#ffffff' : C.text,
                        padding: '8px 12px',
                        borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                        fontSize: 13.5,
                        lineHeight: 1.45,
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
                        gap: 6,
                        padding: '8px 12px',
                        background: C.bubbleBg,
                        borderRadius: '14px 14px 14px 4px',
                        fontSize: 12.5,
                        color: C.textMuted,
                      }}
                    >
                      <Loader2 style={{ width: 12, height: 12 }} className="animate-spin" />
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
                padding: '12px 14px 14px',
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
                  borderRadius: 10,
                  border: `1px solid ${C.inputBorder}`,
                  background: C.inputBg,
                  color: C.text,
                  padding: '10px 12px',
                  fontFamily: 'inherit',
                  fontSize: 13.5,
                  lineHeight: 1.45,
                  outline: 'none',
                  minHeight: 42,
                  maxHeight: 100,
                }}
              />
              <button
                onClick={sendChat}
                disabled={sending || !input.trim()}
                aria-label="Отправить"
                style={{
                  width: 42,
                  height: 42,
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 10,
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
                  <Loader2 style={{ width: 15, height: 15 }} className="animate-spin" />
                ) : (
                  <Send style={{ width: 15, height: 15 }} />
                )}
              </button>
            </div>
          </motion.div>
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
    <div style={{ fontSize: 12.5, color: C.text }}>
      <p style={{ fontSize: 12.5, color: C.textMuted, marginBottom: 14, lineHeight: 1.45 }}>
        AI распознаёт свободную речь. Эти примеры — форматы, которые точно поймёт.
      </p>
      {groups.map((g) => (
        <div key={g.title} style={{ marginBottom: 14 }}>
          <p
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: C.textMuted,
              marginBottom: 6,
            }}
          >
            {g.title}
          </p>
          <ul style={{ display: 'flex', flexDirection: 'column', gap: 3, listStyle: 'none', padding: 0, margin: 0 }}>
            {g.items.map((it, i) => (
              <li
                key={i}
                style={{
                  padding: '6px 10px',
                  background: C.bubbleBg,
                  borderRadius: 8,
                  fontSize: 12.5,
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
