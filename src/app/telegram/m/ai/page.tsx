/** --- YAML
 * name: MasterMiniAppAI
 * description: Текстовый AI-помощник мастера. Раньше жил в композере на главной;
 *              после редизайна 2026-05-07 главной нет, и AI вынесен на отдельный
 *              экран в табе «Ещё». Голос идёт через TG-бот, в Mini App — только
 *              текст, как просил Данил.
 * created: 2026-05-07
 * --- */

'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Bot, Send, Trash2 } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useTelegram } from '@/components/miniapp/telegram-provider';
import { MobilePage, PageHeader } from '@/components/miniapp/shells';
import { T, R, PAGE_PADDING_X, SHADOW } from '@/components/miniapp/design';
import { useMiniAppLocale, type MiniAppLang } from '@/lib/miniapp/use-locale';

const I18N: Record<MiniAppLang, {
  title: string; subtitle: string;
  hint: string; clear: string; thinking: string;
  inputPh: string; sendBtn: string;
  errReply: string; errNetwork: string;
}> = {
  uk: {
    title: 'AI-помічник', subtitle: 'Текстом — голос пиши в TG-бот',
    hint: 'Запитай — запишу витрату, створю нагадування, відповім про виручку чи клієнтів.',
    clear: 'Очистити', thinking: 'думаю…',
    inputPh: 'Запитати помічника…', sendBtn: 'Надіслати',
    errReply: 'Не вдалось відповісти зараз, спробуй ще раз через хвилину.',
    errNetwork: 'Помилка мережі. Перевір інтернет та повтори.',
  },
  ru: {
    title: 'AI-помощник', subtitle: 'Текстом — голосом пиши в TG-бот',
    hint: 'Спроси — запишу расход, создам напоминание, отвечу про выручку или клиентов.',
    clear: 'Очистить', thinking: 'думаю…',
    inputPh: 'Спросить помощника…', sendBtn: 'Отправить',
    errReply: 'Не получилось ответить сейчас, попробуй ещё раз через минуту.',
    errNetwork: 'Ошибка сети. Проверь интернет и повтори.',
  },
  en: {
    title: 'AI assistant', subtitle: 'Text only — voice goes to the TG bot',
    hint: 'Ask me — I’ll log an expense, set a reminder, answer about revenue or clients.',
    clear: 'Clear', thinking: 'thinking…',
    inputPh: 'Ask the assistant…', sendBtn: 'Send',
    errReply: 'Couldn’t reply right now, try again in a minute.',
    errNetwork: 'Network error. Check connection and retry.',
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
  const chatEndRef = useRef<HTMLDivElement | null>(null);

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

  void userId; // удерживаем зависимость — иначе ESLint pure-effects ругается

  return (
    <MobilePage>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
      >
        <PageHeader title={t.title} subtitle={t.subtitle} />

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
            minHeight: '60dvh',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 4px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Bot size={14} color={T.accent} />
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.accent, margin: 0 }}>
                {t.title}
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
                {t.clear}
              </button>
            )}
          </div>

          {chat.length === 0 && !sending ? (
            <div style={{ padding: '4px 4px 4px', fontSize: 12.5, lineHeight: 1.45, color: T.textSecondary }}>
              {t.hint}
            </div>
          ) : (
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 4px', display: 'flex', flexDirection: 'column', gap: 8 }}>
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
                  {t.thinking}
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
              placeholder={t.inputPh}
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
              aria-label={t.sendBtn}
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </motion.div>
    </MobilePage>
  );
}
