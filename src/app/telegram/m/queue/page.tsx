/** --- YAML
 * name: MasterQueuePage
 * description: >
 *   Master Mini App walk-in queue management. Toggle queue mode on/off,
 *   shows QR-link to share with clients, lists active entries, master can
 *   start/complete/skip each entry. "Start" sends TG push to client.
 * created: 2026-05-09
 * --- */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Check, SkipForward, Users, QrCode, RefreshCw, Power } from 'lucide-react';
import { MobilePage, PageHeader } from '@/components/miniapp/shells';
import { useTelegram } from '@/components/miniapp/telegram-provider';
import { T, R, TYPE, SHADOW, PAGE_PADDING_X } from '@/components/miniapp/design';
import { useMiniAppLocale, type MiniAppLang } from '@/lib/miniapp/use-locale';

interface QueueEntry {
  id: string;
  client_name: string | null;
  position: number;
  status: 'waiting' | 'in_service';
  joined_at: string;
  service: { name: string } | null;
}

const I18N: Record<MiniAppLang, {
  title: string;
  queueOff: string;
  queueOn: string;
  enable: string;
  disable: string;
  shareLink: string;
  linkCopied: string;
  empty: string;
  emptyHint: string;
  waiting: string;
  inService: string;
  start: string;
  complete: string;
  skip: string;
  position: (n: number) => string;
}> = {
  uk: {
    title: 'Жива черга',
    queueOff: 'Черга закрита',
    queueOn: 'Черга відкрита',
    enable: 'Відкрити чергу',
    disable: 'Закрити чергу',
    shareLink: 'Посилання для клієнтів',
    linkCopied: 'Скопійовано!',
    empty: 'Черга порожня',
    emptyHint: 'Клієнти побачать кнопку «Стати в чергу»',
    waiting: 'Очікує',
    inService: 'Приймається',
    start: 'Прийняти',
    complete: 'Готово',
    skip: 'Пропустити',
    position: (n) => `#${n}`,
  },
  ru: {
    title: 'Живая очередь',
    queueOff: 'Очередь закрыта',
    queueOn: 'Очередь открыта',
    enable: 'Открыть очередь',
    disable: 'Закрыть очередь',
    shareLink: 'Ссылка для клиентов',
    linkCopied: 'Скопировано!',
    empty: 'Очередь пуста',
    emptyHint: 'Клиенты увидят кнопку «Встать в очередь»',
    waiting: 'Ожидает',
    inService: 'Принимается',
    start: 'Принять',
    complete: 'Готово',
    skip: 'Пропустить',
    position: (n) => `#${n}`,
  },
  en: {
    title: 'Live queue',
    queueOff: 'Queue closed',
    queueOn: 'Queue open',
    enable: 'Open queue',
    disable: 'Close queue',
    shareLink: 'Client check-in link',
    linkCopied: 'Copied!',
    empty: 'Queue is empty',
    emptyHint: 'Clients will see a "Join queue" button',
    waiting: 'Waiting',
    inService: 'In service',
    start: 'Start',
    complete: 'Done',
    skip: 'Skip',
    position: (n) => `#${n}`,
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
  } catch {}
  return null;
}

export default function MasterQueuePage() {
  const { haptic } = useTelegram();
  const lang = useMiniAppLocale();
  const t = I18N[lang];

  const [queueMode, setQueueMode] = useState(false);
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [masterId, setMasterId] = useState<string | null>(null);

  const loadQueue = useCallback(async () => {
    const initData = getInitData();
    const headers: Record<string, string> = {};
    if (initData) headers['X-TG-Init-Data'] = initData;
    const res = await fetch('/api/telegram/m/queue', { headers }).catch(() => null);
    if (!res?.ok) { setLoading(false); return; }
    const json = await res.json() as { queue: QueueEntry[]; queueMode: boolean; masterId: string | null };
    setQueue(json.queue ?? []);
    setQueueMode(json.queueMode ?? false);
    if (json.masterId) setMasterId(json.masterId);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadQueue();
    const interval = setInterval(loadQueue, 20000);
    return () => clearInterval(interval);
  }, [loadQueue]);

  async function toggleMode() {
    haptic('medium');
    setActing('toggle');
    const initData = getInitData();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (initData) headers['X-TG-Init-Data'] = initData;
    const res = await fetch('/api/telegram/m/queue', { method: 'POST', headers }).catch(() => null);
    if (res?.ok) {
      const json = await res.json() as { queueMode: boolean };
      setQueueMode(json.queueMode);
      haptic('success');
    }
    setActing(null);
  }

  async function updateEntry(id: string, action: 'start' | 'complete' | 'skip') {
    haptic('light');
    setActing(id);
    const initData = getInitData();
    const headers: Record<string, string> = {};
    if (initData) headers['X-TG-Init-Data'] = initData;
    await fetch(`/api/telegram/m/queue?id=${id}&action=${action}`, { method: 'PATCH', headers }).catch(() => null);
    haptic('success');
    await loadQueue();
    setActing(null);
  }

  function shareLink() {
    haptic('light');
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.cres-ca.com';
    const url = masterId
      ? `${appUrl}/telegram/queue?master_id=${masterId}`
      : `${appUrl}/telegram/queue`;
    try {
      navigator.clipboard.writeText(url).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    } catch {}
  }

  const waitingCount = queue.filter((e) => e.status === 'waiting').length;

  return (
    <MobilePage>
      <PageHeader title={t.title} />

      <div style={{ padding: `20px ${PAGE_PADDING_X}px 120px`, display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Status card */}
        <div style={{
          background: queueMode ? T.accentSoft : T.surface,
          border: `1px solid ${queueMode ? T.accent + '40' : T.borderSubtle}`,
          borderRadius: R.lg,
          padding: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: R.md,
            background: queueMode ? T.accent : T.bgSubtle,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Users size={20} color={queueMode ? '#fff' : T.textSecondary} />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ ...TYPE.bodyStrong, color: T.text, margin: 0 }}>
              {queueMode ? t.queueOn : t.queueOff}
            </p>
            {queueMode && (
              <p style={{ ...TYPE.caption, color: T.textSecondary, marginTop: 2 }}>
                {waitingCount} {lang === 'en' ? 'waiting' : lang === 'ru' ? 'ожидают' : 'очікують'}
              </p>
            )}
          </div>
          <button
            onClick={toggleMode}
            disabled={acting === 'toggle'}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: R.md,
              background: queueMode ? T.danger : T.accent,
              color: '#fff', border: 'none',
              fontSize: 13, fontWeight: 600,
              opacity: acting === 'toggle' ? 0.6 : 1,
            }}
          >
            <Power size={14} />
            {queueMode ? t.disable : t.enable}
          </button>
        </div>

        {/* Share link */}
        {queueMode && (
          <motion.button
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={shareLink}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: 14, borderRadius: R.md,
              background: T.surface, border: `1px solid ${T.borderSubtle}`,
              textAlign: 'left', width: '100%',
              boxShadow: SHADOW.card,
            }}
          >
            <QrCode size={20} color={T.accent} />
            <div style={{ flex: 1 }}>
              <p style={{ ...TYPE.bodyStrong, color: T.text, margin: 0 }}>
                {copied ? t.linkCopied : t.shareLink}
              </p>
              <p style={{ ...TYPE.caption, color: T.textSecondary, marginTop: 2 }}>
                {process.env.NEXT_PUBLIC_APP_URL ?? 'cres-ca.com'}/telegram/queue
              </p>
            </div>
          </motion.button>
        )}

        {/* Queue list */}
        {queueMode && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ ...TYPE.micro, fontWeight: 700, textTransform: 'uppercase', color: T.textTertiary, margin: 0 }}>
                {lang === 'uk' ? 'ЧЕРГА' : lang === 'ru' ? 'ОЧЕРЕДЬ' : 'QUEUE'}
              </p>
              <button onClick={() => { haptic('light'); loadQueue(); }} style={{ background: 'none', border: 'none', padding: 4, color: T.textSecondary }}>
                <RefreshCw size={14} />
              </button>
            </div>

            <AnimatePresence>
              {queue.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 16px' }}>
                  <p style={{ ...TYPE.body, color: T.textSecondary }}>{t.empty}</p>
                  <p style={{ ...TYPE.caption, color: T.textTertiary, marginTop: 4 }}>{t.emptyHint}</p>
                </div>
              ) : (
                queue.map((entry) => (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: 40 }}
                    style={{
                      background: entry.status === 'in_service' ? T.accentSoft : T.surface,
                      border: `1px solid ${entry.status === 'in_service' ? T.accent + '30' : T.borderSubtle}`,
                      borderRadius: R.md,
                      padding: 14,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: R.sm,
                        background: entry.status === 'in_service' ? T.accent : T.bgSubtle,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 13, fontWeight: 700,
                        color: entry.status === 'in_service' ? '#fff' : T.textSecondary,
                        flexShrink: 0,
                      }}>
                        {t.position(entry.position)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ ...TYPE.bodyStrong, color: T.text, margin: 0 }}>
                          {entry.client_name ?? '—'}
                        </p>
                        <p style={{ ...TYPE.caption, color: T.textSecondary, marginTop: 2 }}>
                          {entry.status === 'in_service' ? t.inService : t.waiting}
                          {entry.service ? ` · ${entry.service.name}` : ''}
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        {entry.status === 'waiting' && (
                          <button
                            onClick={() => updateEntry(entry.id, 'start')}
                            disabled={acting === entry.id}
                            style={{
                              width: 34, height: 34, borderRadius: R.sm,
                              background: T.accent, color: '#fff', border: 'none',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              opacity: acting === entry.id ? 0.6 : 1,
                            }}
                          >
                            <Play size={14} />
                          </button>
                        )}
                        {entry.status === 'in_service' && (
                          <button
                            onClick={() => updateEntry(entry.id, 'complete')}
                            disabled={acting === entry.id}
                            style={{
                              width: 34, height: 34, borderRadius: R.sm,
                              background: T.success, color: '#fff', border: 'none',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              opacity: acting === entry.id ? 0.6 : 1,
                            }}
                          >
                            <Check size={14} />
                          </button>
                        )}
                        <button
                          onClick={() => updateEntry(entry.id, 'skip')}
                          disabled={acting === entry.id}
                          style={{
                            width: 34, height: 34, borderRadius: R.sm,
                            background: T.bgSubtle, color: T.textSecondary, border: `1px solid ${T.borderSubtle}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            opacity: acting === entry.id ? 0.6 : 1,
                          }}
                        >
                          <SkipForward size={14} />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        )}

        {loading && (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <p style={{ ...TYPE.body, color: T.textTertiary }}>
              {lang === 'uk' ? 'Завантаження...' : lang === 'ru' ? 'Загрузка...' : 'Loading...'}
            </p>
          </div>
        )}
      </div>
    </MobilePage>
  );
}
