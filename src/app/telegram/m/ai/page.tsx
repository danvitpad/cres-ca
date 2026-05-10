/** --- YAML
 * name: MasterMiniAppAI
 * description: Текстовый AI-помощник мастера — ChatGPT-style. Empty-state
 *              с подсказками-плитками (запиши расход, выручка за неделю,
 *              напомни позвонить и т.д.). При наличии сообщений — обычный
 *              chat-flow. Input fixed снизу. Голос — через TG-бот.
 * created: 2026-05-07
 * updated: 2026-05-08
 * --- */

'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Bot, Send, Trash2, Sparkles, Receipt, Bell, BarChart3, Users, Clock as ClockIcon } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useTelegram } from '@/components/miniapp/telegram-provider';
import { MobilePage, PageHeader } from '@/components/miniapp/shells';
import { T, R, PAGE_PADDING_X, SHADOW, TYPE } from '@/components/miniapp/design';
import { useMiniAppLocale, type MiniAppLang } from '@/lib/miniapp/use-locale';

const I18N: Record<MiniAppLang, {
  title: string; subtitle: string;
  hint: string; clear: string; thinking: string;
  inputPh: string; sendBtn: string;
  errReply: string; errNetwork: string;
  suggestionsTitle: string;
  s1: string; s2: string; s3: string; s4: string; s5: string; s6: string;
}> = {
  uk: {
    title: 'AI-помічник', subtitle: 'Голосом — у TG-бот, текстом — тут',
    hint: 'Запитай — запишу витрату, створю нагадування, відповім про виручку чи клієнтів.',
    clear: 'Очистити', thinking: 'думаю…',
    inputPh: 'Запитати помічника…', sendBtn: 'Надіслати',
    errReply: 'Не вдалось відповісти зараз, спробуй ще раз через хвилину.',
    errNetwork: 'Помилка мережі. Перевір інтернет та повтори.',
    suggestionsTitle: 'Спробуй',
    s1: 'Запиши витрату 500₴ на матеріали',
    s2: 'Скільки я заробив на цьому тижні?',
    s3: 'Нагадай завтра о 14:00 подзвонити Анні',
    s4: 'Топ-послуги за місяць',
    s5: 'Скільки клієнтів цього місяця',
    s6: 'Хто не приходив 2 місяці',
  },
  ru: {
    title: 'AI-помощник', subtitle: 'Голосом — в TG-бот, текстом — тут',
    hint: 'Спроси — запишу расход, создам напоминание, отвечу про выручку или клиентов.',
    clear: 'Очистить', thinking: 'думаю…',
    inputPh: 'Спросить помощника…', sendBtn: 'Отправить',
    errReply: 'Не получилось ответить сейчас, попробуй ещё раз через минуту.',
    errNetwork: 'Ошибка сети. Проверь интернет и повтори.',
    suggestionsTitle: 'Попробуй',
    s1: 'Запиши расход 500₴ на материалы',
    s2: 'Сколько я заработал на этой неделе?',
    s3: 'Напомни завтра в 14:00 позвонить Анне',
    s4: 'Топ-услуги за месяц',
    s5: 'Сколько клиентов в этом месяце',
    s6: 'Кто не приходил 2 месяца',
  },
  en: {
    title: 'AI assistant', subtitle: 'Voice — in TG bot, text — here',
    hint: 'Ask me — I’ll log an expense, set a reminder, answer about revenue or clients.',
    clear: 'Clear', thinking: 'thinking…',
    inputPh: 'Ask the assistant…', sendBtn: 'Send',
    errReply: 'Couldn’t reply right now, try again in a minute.',
    errNetwork: 'Network error. Check connection and retry.',
    suggestionsTitle: 'Try',
    s1: 'Log expense 500₴ for supplies',
    s2: 'How much did I earn this week?',
    s3: 'Remind me to call Anna tomorrow at 2pm',
    s4: 'Top services this month',
    s5: 'How many clients this month',
    s6: 'Who hasn’t been in 2 months',
  },
};

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

export default function MasterMiniAppAI() {
  const { haptic } = useTelegram();
  const { userId } = useAuthStore();
  const lang = useMiniAppLocale();
  const t = I18N[lang];
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [chat, sending]);

  // Отслеживаем высоту клавиатуры через visualViewport — на iOS Telegram WebApp
  // фикс-элементы не поднимаются автоматически, поэтому сами считаем сколько
  // занимает клавиатура и поднимаем поле ввода ровно над ней.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;
    const vp = window.visualViewport;
    const onResize = () => {
      const diff = window.innerHeight - vp.height;
      setKeyboardHeight(diff > 80 ? diff : 0);
    };
    onResize();
    vp.addEventListener('resize', onResize);
    return () => vp.removeEventListener('resize', onResize);
  }, []);

  async function sendMessage(prefilled?: string) {
    const text = (prefilled ?? input).trim();
    if (!text || sending) return;
    const initData = getInitData();
    if (!initData) return;

    haptic('light');
    if (!prefilled) setInput('');
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
        setChat([...nextChat, { role: 'assistant', content: t.errReply }]);
      } else {
        setChat([...nextChat, { role: 'assistant', content: json.answer }]);
        haptic('success');
      }
    } catch {
      setChat([...nextChat, { role: 'assistant', content: t.errNetwork }]);
    } finally {
      setSending(false);
    }
  }

  void userId;

  // Подсказки для empty state — каждая = иконка + текст. Тап → отправить как
  // pre-filled message сразу, без правки в input.
  const SUGGESTIONS = [
    { icon: Receipt, label: t.s1 },
    { icon: BarChart3, label: t.s2 },
    { icon: Bell, label: t.s3 },
    { icon: Sparkles, label: t.s4 },
    { icon: Users, label: t.s5 },
    { icon: ClockIcon, label: t.s6 },
  ];

  const empty = chat.length === 0 && !sending;

  return (
    <MobilePage>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        style={{ display: 'flex', flexDirection: 'column' }}
      >
        <PageHeader
          title={t.title}
          subtitle={t.subtitle}
          right={chat.length > 0 ? (
            <button
              type="button"
              onClick={() => { haptic('light'); setChat([]); }}
              style={{
                width: 36, height: 36, borderRadius: '50%',
                border: `1px solid ${T.borderSubtle}`,
                background: T.surface, color: T.textSecondary,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', padding: 0,
              }}
              aria-label={t.clear}
            >
              <Trash2 size={14} />
            </button>
          ) : undefined}
        />

        {/* Контент: либо empty-state с подсказками, либо чат */}
        <div
          style={{
            flex: 1, minHeight: 0,
            padding: `8px ${PAGE_PADDING_X}px 0`,
            display: 'flex', flexDirection: 'column',
            paddingBottom: 'calc(96px + env(safe-area-inset-bottom, 0px) + 64px)',
          }}
        >
          {empty ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 10, padding: '20px 0 8px' }}>
                <div
                  style={{
                    width: 64, height: 64, borderRadius: 18,
                    background: `linear-gradient(135deg, ${T.gradientFrom}, ${T.gradientTo})`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: SHADOW.card,
                  }}
                >
                  <Bot size={28} color="#fff" strokeWidth={2.2} />
                </div>
                <p style={{ ...TYPE.body, color: T.textSecondary, margin: 0, maxWidth: 320 }}>
                  {t.hint}
                </p>
              </div>

              <p style={{ ...TYPE.micro, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: T.textTertiary, margin: '4px 4px' }}>
                {t.suggestionsTitle}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {SUGGESTIONS.map((s, i) => {
                  const Icon = s.icon;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => sendMessage(s.label)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '14px',
                        borderRadius: R.md,
                        border: `1px solid ${T.borderSubtle}`,
                        background: T.surface,
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        boxShadow: SHADOW.card,
                      }}
                    >
                      <span
                        style={{
                          width: 36, height: 36, borderRadius: 10,
                          background: T.accentSoft, color: T.accent,
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <Icon size={16} strokeWidth={2.2} />
                      </span>
                      <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: T.text }}>
                        {s.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {chat.map((m, i) => (
                <div
                  key={i}
                  style={{
                    maxWidth: '85%',
                    alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                    padding: '10px 14px',
                    borderRadius: 18,
                    borderBottomRightRadius: m.role === 'user' ? 4 : 18,
                    borderBottomLeftRadius: m.role === 'user' ? 18 : 4,
                    background: m.role === 'user' ? T.accent : T.bgSubtle,
                    color: m.role === 'user' ? '#fff' : T.text,
                    fontSize: 14,
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
                    padding: '10px 14px',
                    borderRadius: 18,
                    background: T.bgSubtle,
                    color: T.textSecondary,
                    fontSize: 14,
                  }}
                >
                  {t.thinking}
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          )}
        </div>

        {/* Input — fixed снизу. Если клавиатура открыта — поднимается ровно над ней (visualViewport).
            Если закрыта — над bottom-nav (81px) с safe-area. */}
        <div
          style={{
            position: 'fixed',
            left: 12, right: 12,
            bottom: keyboardHeight > 0
              ? `calc(${keyboardHeight}px + 6px)`
              : 'calc(81px + env(safe-area-inset-bottom, 0px) + 8px)',
            zIndex: 30,
            background: T.surface,
            borderRadius: R.pill,
            boxShadow: SHADOW.elevated,
            border: `1px solid ${T.borderSubtle}`,
            padding: 6,
            display: 'flex', alignItems: 'center', gap: 6,
            transition: 'bottom 200ms ease',
          }}
        >
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
            placeholder={t.inputPh}
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: R.pill,
              border: 'none',
              background: 'transparent',
              fontSize: 16,
              color: T.text,
              outline: 'none',
              fontFamily: 'inherit',
            }}
          />
          <button
            type="button"
            onClick={() => sendMessage()}
            disabled={!input.trim() || sending}
            style={{
              width: 40, height: 40, flexShrink: 0,
              borderRadius: '50%',
              border: 'none',
              background: input.trim() ? T.accent : T.bgSubtle,
              color: input.trim() ? '#fff' : T.textTertiary,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: input.trim() && !sending ? 'pointer' : 'not-allowed',
              transition: 'background 200ms ease',
            }}
            aria-label={t.sendBtn}
          >
            <Send size={16} />
          </button>
        </div>
      </motion.div>
    </MobilePage>
  );
}
