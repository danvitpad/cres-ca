/** --- YAML
 * name: AI Assistant (Chat)
 * description: In-app AI chat for master — bubbles, quick replies, real /api/ai/assistant backend.
 *              Mobile: full-screen chat. Desktop: split layout with insights panel.
 * created: 2026-04-18
 * updated: 2026-05-16
 * --- */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot,
  Send,
  Mic,
  TrendingUp,
  Lightbulb,
  Users,
  Calendar,
  ArrowUp,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'crescacom_bot';

const QUICK_REPLIES = [
  'Скільки клієнтів цього місяця?',
  'Мої ТОП-5 послуг',
  'Коли наступне вікно?',
  'Хто давно не приходив?',
];

type ChatMsg = {
  id: string;
  role: 'user' | 'ai';
  content: string;
  time: string;
};

type ActionLog = {
  id: string;
  source: 'voice' | 'automation' | 'rules';
  action_type: string;
  input_text: string | null;
  result: Record<string, unknown> | null;
  status: 'success' | 'needs_confirmation' | 'failed';
  error_message: string | null;
  created_at: string;
};

function fmtTime(date: Date) {
  return date.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
}

function mkId() {
  return Math.random().toString(36).slice(2);
}

export default function VoiceAssistantPage() {
  const t = useTranslations('voice_assistant');
  const { master, loading: masterLoading } = useMaster();

  // Chat state
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Action log (for desktop insights panel)
  const [logs, setLogs] = useState<ActionLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [undoing, setUndoing] = useState<string | null>(null);

  // Responsive
  const [isMobileView, setIsMobileView] = useState(false);

  useEffect(() => {
    const check = () => setIsMobileView(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Seed welcome message
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([{
        id: mkId(),
        role: 'ai',
        content: 'Привіт! Я CRES AI — твій помічник. Запитуй про клієнтів, записи, фінанси або попроси записати витрату.',
        time: fmtTime(new Date()),
      }]);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const loadLogs = useCallback(async () => {
    if (!master?.id) return;
    const supabase = createClient();
    const { data } = await supabase
      .from('ai_actions_log')
      .select('id, source, action_type, input_text, result, status, error_message, created_at')
      .eq('master_id', master.id)
      .order('created_at', { ascending: false })
      .limit(20);
    setLogs((data ?? []) as ActionLog[]);
    setLogsLoading(false);
  }, [master?.id]);

  useEffect(() => {
    if (!masterLoading) loadLogs();
  }, [masterLoading, loadLogs]);

  async function sendMessage(text?: string) {
    const msg = (text ?? inputText).trim();
    if (!msg || isTyping) return;
    setInputText('');

    const userMsg: ChatMsg = { id: mkId(), role: 'user', content: msg, time: fmtTime(new Date()) };
    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);

    try {
      const res = await fetch('/api/ai/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg }),
      });
      const data = await res.json();
      const reply = data.reply || data.answer || data.text || 'Не вдалось отримати відповідь.';
      setMessages(prev => [...prev, { id: mkId(), role: 'ai', content: reply, time: fmtTime(new Date()) }]);
      // Refresh logs to pick up any new action entries
      loadLogs();
    } catch {
      setMessages(prev => [...prev, { id: mkId(), role: 'ai', content: 'Сталась помилка. Спробуй ще раз.', time: fmtTime(new Date()) }]);
    } finally {
      setIsTyping(false);
    }
  }

  async function handleUndo(logId: string) {
    setUndoing(logId);
    try {
      const res = await fetch(`/api/ai-actions/${logId}/undo`, { method: 'POST' });
      if (res.ok) {
        toast.success(t('undone'));
        await loadLogs();
      } else {
        toast.error(t('undoFailed'));
      }
    } catch {
      toast.error(t('undoFailed'));
    } finally {
      setUndoing(null);
    }
  }

  const isUndoable = (log: ActionLog) =>
    log.source === 'voice' && log.status === 'success' &&
    (log.action_type === 'client_created' || log.action_type === 'appointment_reschedule');

  // ── MOBILE CHAT ──────────────────────────────────────────────────────────
  if (isMobileView) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: '#f8fafc' }}>
        {/* Header */}
        <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{ width: 36, height: 36, borderRadius: 18, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Bot style={{ width: 18, height: 18, color: '#2563eb' }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>CRES AI</div>
            <div style={{ fontSize: 12, color: '#22c55e' }}>онлайн</div>
          </div>
          <a href={`https://t.me/${BOT_USERNAME}`} target="_blank" rel="noreferrer" style={{ color: '#64748b', display: 'flex' }}>
            <ExternalLink style={{ width: 18, height: 18 }} />
          </a>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {messages.map(msg => (
            <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '78%',
                padding: '10px 14px',
                borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                background: msg.role === 'user' ? '#2563eb' : '#fff',
                color: msg.role === 'user' ? '#fff' : '#0f172a',
                fontSize: 14,
                lineHeight: 1.5,
                boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                border: msg.role === 'ai' ? '1px solid #e2e8f0' : 'none',
              }}>
                {msg.content}
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4, paddingLeft: 4, paddingRight: 4 }}>{msg.time}</div>
            </div>
          ))}

          {isTyping && (
            <div style={{ display: 'flex', alignItems: 'flex-start' }}>
              <div style={{ padding: '10px 16px', borderRadius: '18px 18px 18px 4px', background: '#fff', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{ width: 6, height: 6, borderRadius: 3, background: '#94a3b8', animation: 'bounce 1.2s ease-in-out infinite', animationDelay: `${i * 0.2}s` }} />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick replies */}
        <div style={{ display: 'flex', gap: 8, padding: '8px 16px', overflowX: 'auto', scrollbarWidth: 'none', flexShrink: 0 }}>
          {QUICK_REPLIES.map(qr => (
            <button
              key={qr}
              onClick={() => sendMessage(qr)}
              style={{ whiteSpace: 'nowrap', padding: '6px 12px', borderRadius: 16, background: '#fff', border: '1px solid #e2e8f0', fontSize: 13, color: '#2563eb', cursor: 'pointer', fontWeight: 500 }}
            >
              {qr}
            </button>
          ))}
        </div>

        {/* Input bar */}
        <div style={{ background: '#fff', borderTop: '1px solid #e2e8f0', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <button style={{ width: 36, height: 36, borderRadius: 18, background: '#f1f5f9', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <Mic style={{ width: 16, height: 16, color: '#64748b' }} />
          </button>
          <input
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder="Запитай або скажи..."
            style={{ flex: 1, padding: '9px 14px', borderRadius: 20, border: '1px solid #e2e8f0', fontSize: 14, outline: 'none', background: '#f8fafc' }}
          />
          <button
            onClick={() => sendMessage()}
            style={{ width: 36, height: 36, borderRadius: 18, background: '#2563eb', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
          >
            <ArrowUp style={{ width: 16, height: 16, color: '#fff' }} />
          </button>
        </div>

        <style>{`@keyframes bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-6px)} }`}</style>
      </div>
    );
  }

  // ── DESKTOP SPLIT LAYOUT ─────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 64px)', overflow: 'hidden' }}>
      {/* Chat column */}
      <div style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid #e2e8f0' }}>
        {/* Chat header */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <div style={{ width: 40, height: 40, borderRadius: 20, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Bot style={{ width: 20, height: 20, color: '#2563eb' }} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>CRES AI</div>
            <div style={{ fontSize: 12, color: '#22c55e', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 6, height: 6, background: '#22c55e', borderRadius: 3, display: 'inline-block' }} />
              Завжди онлайн
            </div>
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <a href={`https://t.me/${BOT_USERNAME}`} target="_blank" rel="noreferrer">
              <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
                <ExternalLink className="w-3.5 h-3.5" />
                Telegram
              </Button>
            </a>
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ textAlign: 'center', fontSize: 11, color: '#94a3b8', paddingBottom: 8 }}>
            {new Date().toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' })}
          </div>

          {messages.map(msg => (
            <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '72%',
                padding: '10px 16px',
                borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                background: msg.role === 'user' ? '#2563eb' : '#f8fafc',
                color: msg.role === 'user' ? '#fff' : '#0f172a',
                fontSize: 14,
                lineHeight: 1.5,
                border: msg.role === 'ai' ? '1px solid #e2e8f0' : 'none',
              }}>
                {msg.content}
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4, padding: '0 4px' }}>{msg.time}</div>
            </div>
          ))}

          {isTyping && (
            <div>
              <div style={{ display: 'inline-flex', padding: '10px 16px', borderRadius: '18px 18px 18px 4px', background: '#f8fafc', border: '1px solid #e2e8f0', gap: 4 }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{ width: 6, height: 6, borderRadius: 3, background: '#94a3b8', animation: 'bounce 1.2s ease-in-out infinite', animationDelay: `${i * 0.2}s` }} />
                ))}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick replies row */}
        <div style={{ display: 'flex', gap: 8, padding: '12px 24px', borderTop: '1px solid #e2e8f0', overflowX: 'auto', scrollbarWidth: 'none', flexShrink: 0 }}>
          {QUICK_REPLIES.map(qr => (
            <button
              key={qr}
              onClick={() => sendMessage(qr)}
              style={{ whiteSpace: 'nowrap', padding: '5px 12px', borderRadius: 14, background: '#f1f5f9', border: '1px solid #e2e8f0', fontSize: 12, color: '#2563eb', cursor: 'pointer', fontWeight: 500 }}
            >
              {qr}
            </button>
          ))}
        </div>

        {/* Input */}
        <div style={{ padding: '12px 24px 16px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: 8, alignItems: 'flex-end', flexShrink: 0 }}>
          <textarea
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder="Запитай AI або скажи голосом…"
            rows={1}
            style={{ flex: 1, resize: 'none', padding: '10px 14px', borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 14, outline: 'none', fontFamily: 'inherit', lineHeight: 1.5, background: '#f8fafc' }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button style={{ width: 36, height: 36, borderRadius: 10, background: '#f1f5f9', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <Mic style={{ width: 14, height: 14, color: '#64748b' }} />
            </button>
            <button
              onClick={() => sendMessage()}
              style={{ width: 36, height: 36, borderRadius: 10, background: '#2563eb', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            >
              <ArrowUp style={{ width: 14, height: 14, color: '#fff' }} />
            </button>
          </div>
        </div>
      </div>

      {/* Insights / log column */}
      <div style={{ width: 300, flexShrink: 0, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 12, background: '#fafafa' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>Аналітика та поради</div>

        {/* Weekly earnings card */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 8 }}>
            <TrendingUp style={{ width: 14, height: 14, color: '#22c55e' }} />
            Цього тижня
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#0f172a' }}>Запитай AI</div>
          <div style={{ fontSize: 12, color: '#22c55e', marginTop: 2 }}>Отримай аналітику за тиждень</div>
        </div>

        {/* AI tips */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 10 }}>
            <Lightbulb style={{ width: 14, height: 14, color: '#f59e0b' }} />
            Поради AI
          </div>
          {[
            { icon: Users, bg: '#fffbeb', clr: '#d97706', title: 'Запитай про спящих клієнтів', sub: '«Хто давно не приходив?»' },
            { icon: Calendar, bg: '#f0fdf4', clr: '#16a34a', title: 'Вільні вікна', sub: '«Коли наступне вікно?»' },
            { icon: TrendingUp, bg: '#eff6ff', clr: '#2563eb', title: 'Трендові послуги', sub: '«Мої ТОП-5 послуг»' },
          ].map(tip => (
            <div key={tip.title} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: tip.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <tip.icon style={{ width: 14, height: 14, color: tip.clr }} />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a' }}>{tip.title}</div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>{tip.sub}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Recent action log */}
        {logsLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : logs.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '14px' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 8 }}>Останні дії</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {logs.slice(0, 5).map(log => (
                <div key={log.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  {log.status === 'success'
                    ? <CheckCircle2 style={{ width: 14, height: 14, color: '#22c55e', flexShrink: 0, marginTop: 1 }} />
                    : <AlertCircle style={{ width: 14, height: 14, color: log.status === 'failed' ? '#ef4444' : '#f59e0b', flexShrink: 0, marginTop: 1 }} />
                  }
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.action_type}</div>
                    {log.input_text && (
                      <div style={{ fontSize: 11, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>&ldquo;{log.input_text}&rdquo;</div>
                    )}
                  </div>
                  {isUndoable(log) && (
                    <button
                      onClick={() => handleUndo(log.id)}
                      disabled={undoing === log.id}
                      style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: '#64748b', background: 'none', border: '1px solid #e2e8f0', borderRadius: 6, padding: '2px 6px', cursor: 'pointer' }}
                    >
                      <RotateCcw style={{ width: 10, height: 10 }} />
                      {t('undo')}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Voice command examples */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 8 }}>
            <Mic style={{ width: 14, height: 14, color: '#2563eb' }} />
            Голосові команди
          </div>
          {[
            '«Запиши витрату 500 грн...»',
            '«Скільки я заробив сьогодні?»',
            '«Скасуй запис Олени о 15:00»',
            '«Хто мій ТОП-клієнт?»',
          ].map(cmd => (
            <div key={cmd} style={{ background: '#f8fafc', borderRadius: 8, padding: '7px 10px', fontSize: 12, color: '#64748b', marginBottom: 6 }}>{cmd}</div>
          ))}
        </div>
      </div>

      <style>{`@keyframes bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-6px)} }`}</style>
    </div>
  );
}
