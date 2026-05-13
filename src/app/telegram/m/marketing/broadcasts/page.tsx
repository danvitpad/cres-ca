/** --- YAML
 * name: MasterMiniAppMarketing/Broadcasts
 * description: Рассылки мастера — список + bottom-sheet «Новая рассылка».
 *              POST на /api/marketing/broadcast c {subject, body, audience}.
 *              Audience: subscribers (подписчики) / favorites (избранные) /
 *              all_clients (вся база). MVP без отложенной отправки.
 * created: 2026-05-09
 * updated: 2026-05-13
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Loader2, Plus, X, Check, Users, Heart, Star } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useTelegram } from '@/components/miniapp/telegram-provider';
import { createClient } from '@/lib/supabase/client';
import { MobilePage, PageHeader } from '@/components/miniapp/shells';
import { T, R, TYPE, PAGE_PADDING_X, SPRING, SHADOW } from '@/components/miniapp/design';
import { useMiniAppLocale, type MiniAppLang } from '@/lib/miniapp/use-locale';

interface Broadcast {
  id: string;
  subject: string | null;
  body: string | null;
  audience: string | null;
  status: string | null;
  scheduled_for: string | null;
  sent_count: number | null;
  created_at: string;
}

type Audience = 'subscribers' | 'favorites' | 'all_clients';

const I18N: Record<MiniAppLang, {
  title: string; subtitle: string;
  empty: string; emptyHint: string;
  status: Record<string, string>;
  add: string; sheetTitle: string;
  fieldSubject: string; subjectPh: string;
  fieldBody: string; bodyPh: string;
  fieldAudience: string;
  audSubs: string; audSubsHint: string;
  audFav: string; audFavHint: string;
  audAll: string; audAllHint: string;
  send: string; sending: string;
  errEmptyBody: string; errSend: string; errLocked: string;
  sentTo: (n: number) => string;
}> = {
  uk: {
    title: 'Розсилки', subtitle: 'Повідомлення вашим клієнтам',
    empty: 'Поки що жодної розсилки', emptyHint: 'Тапніть «+ Створити» щоб надіслати першу',
    status: { sent: 'Надіслано', scheduled: 'Заплановано', draft: 'Чернетка', failed: 'Помилка', processing: 'Надсилається' },
    add: 'Створити',
    sheetTitle: 'Нова розсилка',
    fieldSubject: 'Тема (опційно)', subjectPh: 'Напр. «Знижка на наращивання»',
    fieldBody: 'Повідомлення', bodyPh: 'Текст який отримають клієнти',
    fieldAudience: 'Кому надіслати',
    audSubs: 'Підписники', audSubsHint: 'Хто додав вас в обране',
    audFav: 'Постійні клієнти', audFavHint: 'Хто був у вас 3+ рази',
    audAll: 'Вся база', audAllHint: 'Всі клієнти що були хоч раз',
    send: 'Надіслати', sending: 'Надсилаємо…',
    errEmptyBody: 'Введіть текст повідомлення',
    errSend: 'Не вдалось надіслати',
    errLocked: 'Розсилки доступні з тарифу Pro',
    sentTo: (n) => `${n} одержувачів`,
  },
  ru: {
    title: 'Рассылки', subtitle: 'Сообщения вашим клиентам',
    empty: 'Пока ни одной рассылки', emptyHint: 'Тапни «+ Создать» чтобы отправить первую',
    status: { sent: 'Отправлено', scheduled: 'Запланировано', draft: 'Черновик', failed: 'Ошибка', processing: 'Отправляется' },
    add: 'Создать',
    sheetTitle: 'Новая рассылка',
    fieldSubject: 'Тема (опционально)', subjectPh: 'Напр. «Скидка на наращивание»',
    fieldBody: 'Сообщение', bodyPh: 'Текст который получат клиенты',
    fieldAudience: 'Кому отправить',
    audSubs: 'Подписчики', audSubsHint: 'Кто добавил вас в избранное',
    audFav: 'Постоянные клиенты', audFavHint: 'Кто был у вас 3+ раза',
    audAll: 'Вся база', audAllHint: 'Все клиенты что были хоть раз',
    send: 'Отправить', sending: 'Отправляем…',
    errEmptyBody: 'Введите текст сообщения',
    errSend: 'Не удалось отправить',
    errLocked: 'Рассылки доступны на тарифе Pro',
    sentTo: (n) => `${n} получателей`,
  },
  en: {
    title: 'Broadcasts', subtitle: 'Messages to your clients',
    empty: 'No broadcasts yet', emptyHint: 'Tap «+ Create» to send your first',
    status: { sent: 'Sent', scheduled: 'Scheduled', draft: 'Draft', failed: 'Failed', processing: 'Sending' },
    add: 'Create',
    sheetTitle: 'New broadcast',
    fieldSubject: 'Subject (optional)', subjectPh: 'E.g. «Lash extension sale»',
    fieldBody: 'Message', bodyPh: 'Text your clients will receive',
    fieldAudience: 'Who to send to',
    audSubs: 'Subscribers', audSubsHint: 'Those who favorited you',
    audFav: 'Regulars', audFavHint: 'Visited you 3+ times',
    audAll: 'All clients', audAllHint: 'Everyone who visited at least once',
    send: 'Send', sending: 'Sending…',
    errEmptyBody: 'Enter message text',
    errSend: 'Failed to send',
    errLocked: 'Broadcasts require Pro plan',
    sentTo: (n) => `${n} recipients`,
  },
};

export default function BroadcastsPage() {
  const userId = useAuthStore((s) => s.userId);
  const { haptic } = useTelegram();
  const lang = useMiniAppLocale();
  const t = I18N[lang];
  const [items, setItems] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data: master } = await supabase.from('masters').select('id').eq('profile_id', userId).maybeSingle();
      if (cancelled || !master) { setLoading(false); return; }
      const { data } = await supabase
        .from('master_broadcasts')
        .select('id, subject, body, audience, status, scheduled_for, sent_count, created_at')
        .eq('master_id', master.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (cancelled) return;
      setItems((data as Broadcast[] | null) ?? []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [userId, refreshKey]);

  return (
    <MobilePage>
      <PageHeader title={t.title} subtitle={t.subtitle} />
      <div style={{ padding: `8px ${PAGE_PADDING_X}px 96px`, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {loading ? (
          <Loader2 className="mx-auto my-8 size-5 animate-spin" color={T.textTertiary} />
        ) : items.length === 0 ? (
          <div style={{ padding: 28, borderRadius: R.md, border: `1px dashed ${T.border}`, textAlign: 'center', background: T.surface }}>
            <Send size={22} color={T.textTertiary} style={{ margin: '0 auto 10px' }} />
            <p style={{ fontSize: 14, fontWeight: 600, color: T.text, margin: 0 }}>{t.empty}</p>
            <p style={{ fontSize: 12, color: T.textTertiary, margin: '4px 0 0' }}>{t.emptyHint}</p>
          </div>
        ) : (
          items.map((b) => (
            <div key={b.id} style={{ padding: 14, borderRadius: R.md, border: `1px solid ${T.borderSubtle}`, background: T.surface }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: T.text, margin: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {b.subject || (b.body ? b.body.slice(0, 40) : '—')}
                </p>
                <span style={{ fontSize: 10, color: T.accent, padding: '2px 8px', borderRadius: 999, background: T.accentSoft, flexShrink: 0 }}>
                  {b.status ? (t.status[b.status] ?? b.status) : '—'}
                </span>
              </div>
              <p style={{ fontSize: 11, color: T.textTertiary, margin: '4px 0 0' }}>
                {b.audience ?? '—'}{b.sent_count != null && b.sent_count > 0 ? ` · ${t.sentTo(b.sent_count)}` : ''}
                {' · '}{new Date(b.created_at).toLocaleDateString(lang === 'uk' ? 'uk-UA' : lang === 'en' ? 'en-GB' : 'ru-RU')}
              </p>
            </div>
          ))
        )}
      </div>

      {/* FAB */}
      <button
        type="button"
        onClick={() => { haptic('selection'); setSheetOpen(true); }}
        aria-label={t.add}
        style={{
          position: 'fixed',
          right: 20,
          bottom: 'calc(88px + env(safe-area-inset-bottom, 0px))',
          width: 52, height: 52, borderRadius: '50%',
          background: T.accent, color: '#fff',
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(37, 99, 235, 0.4)',
          zIndex: 20,
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        <Plus size={22} strokeWidth={2.4} />
      </button>

      <AnimatePresence>
        {sheetOpen && (
          <BroadcastCreateSheet
            t={t}
            onClose={() => setSheetOpen(false)}
            onSaved={() => { setSheetOpen(false); setRefreshKey((k) => k + 1); }}
          />
        )}
      </AnimatePresence>
    </MobilePage>
  );
}

function BroadcastCreateSheet({ t, onClose, onSaved }: {
  t: typeof I18N['ru'];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { haptic } = useTelegram();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<Audience>('subscribers');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function send() {
    if (busy) return;
    setErr(null);
    if (!body.trim()) { setErr(t.errEmptyBody); return; }
    setBusy(true);
    try {
      const res = await fetch('/api/marketing/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: subject.trim() || undefined,
          body: body.trim(),
          audience,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (j.error === 'feature_locked') {
          setErr(t.errLocked);
        } else {
          setErr(j.error || t.errSend);
        }
        haptic('error');
        return;
      }
      haptic('success');
      onSaved();
    } catch (e) {
      haptic('error');
      setErr(e instanceof Error ? e.message : t.errSend);
    } finally {
      setBusy(false);
    }
  }

  const audOptions: Array<{ key: Audience; label: string; hint: string; Icon: typeof Users }> = [
    { key: 'subscribers', label: t.audSubs, hint: t.audSubsHint, Icon: Heart },
    { key: 'favorites', label: t.audFav, hint: t.audFavHint, Icon: Star },
    { key: 'all_clients', label: t.audAll, hint: t.audAllHint, Icon: Users },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={() => !busy && onClose()}
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
      }}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={SPRING.default}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 480,
          borderRadius: `${R.lg}px ${R.lg}px 0 0`,
          background: T.surface,
          padding: `20px ${PAGE_PADDING_X}px`,
          paddingBottom: 'calc(24px + env(safe-area-inset-bottom, 0px))',
          boxShadow: SHADOW.elevated,
          maxHeight: 'calc(100dvh - max(var(--tg-content-top, 0px), 12px))',
          overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ ...TYPE.h3, color: T.text, margin: 0 }}>{t.sheetTitle}</h3>
          <button
            type="button" onClick={() => !busy && onClose()}
            aria-label="Закрыть"
            style={{
              width: 36, height: 36, borderRadius: '50%',
              border: `1px solid ${T.border}`, background: T.surface,
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            }}
          >
            <X size={16} color={T.text} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={fieldBoxStyle}>
            <Label>{t.fieldSubject}</Label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value.slice(0, 80))}
              placeholder={t.subjectPh}
              style={inputStyle}
            />
          </div>

          <div style={fieldBoxStyle}>
            <Label>{t.fieldBody}</Label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value.slice(0, 2000))}
              placeholder={t.bodyPh}
              rows={6}
              style={{ ...inputStyle, resize: 'none', minHeight: 120 }}
              autoFocus
            />
            <p style={{ ...TYPE.micro, color: T.textTertiary, margin: '6px 0 0', textAlign: 'right' }}>
              {body.length} / 2000
            </p>
          </div>

          <div style={fieldBoxStyle}>
            <Label>{t.fieldAudience}</Label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {audOptions.map((opt) => {
                const on = audience === opt.key;
                const Icon = opt.Icon;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => { haptic('selection'); setAudience(opt.key); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 12px',
                      borderRadius: R.sm,
                      border: `1.5px solid ${on ? T.accent : T.border}`,
                      background: on ? T.accentSoft : T.surface,
                      cursor: 'pointer', fontFamily: 'inherit',
                      textAlign: 'left',
                    }}
                  >
                    <Icon size={16} color={on ? T.accent : T.textSecondary} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: on ? T.accent : T.text, margin: 0 }}>{opt.label}</p>
                      <p style={{ fontSize: 11, color: T.textTertiary, margin: '1px 0 0' }}>{opt.hint}</p>
                    </div>
                    {on && <Check size={14} color={T.accent} />}
                  </button>
                );
              })}
            </div>
          </div>

          {err && <p style={{ ...TYPE.caption, color: T.danger, margin: 0 }}>{err}</p>}

          <button
            type="button"
            onClick={send}
            disabled={busy}
            style={{
              marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              width: '100%', padding: '14px 16px', borderRadius: R.md, border: 'none',
              background: T.text, color: T.bg,
              fontSize: 15, fontWeight: 700, cursor: busy ? 'wait' : 'pointer',
              fontFamily: 'inherit', opacity: busy ? 0.6 : 1,
            }}
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {busy ? t.sending : t.send}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: '0.1em', color: T.textTertiary, margin: 0, marginBottom: 8,
    }}>
      {children}
    </p>
  );
}

const fieldBoxStyle: React.CSSProperties = {
  borderRadius: R.md,
  border: `1px solid ${T.borderSubtle}`,
  background: T.bg,
  padding: '12px 14px 14px',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'transparent', border: 'none', outline: 'none',
  fontSize: 16,
  fontWeight: 400,
  lineHeight: 1.4,
  color: T.text,
  caretColor: T.accent,
  fontFamily: 'inherit',
  padding: 0,
};
