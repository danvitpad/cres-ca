/** --- YAML
 * name: ClientQueueCheckIn
 * description: >
 *   Client walk-in self check-in page. Reached by scanning master's QR code
 *   or tapping shared link. Shows queue position, allows joining, auto-refreshes
 *   every 15s to update position. Auth via Telegram WebApp initData.
 * created: 2026-05-09
 * --- */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Users, Clock, CheckCircle2 } from 'lucide-react';
import { T, R, TYPE, PAGE_PADDING_X } from '@/components/miniapp/design';

interface QueueState {
  open: boolean;
  masterName: string;
  myEntry: { id: string; position: number; status: string } | null;
  totalWaiting: number;
}

const STR = {
  uk: {
    loading: 'Завантаження...',
    queueClosed: 'Черга наразі закрита',
    queueClosedHint: 'Майстер не приймає без запису прямо зараз',
    yourPosition: 'Ваша позиція',
    inService: 'Вас зараз приймають!',
    waiting: (n: number) => `${n} людин${n === 1 ? 'а' : n < 5 ? 'и' : ''} попереду`,
    join: 'Стати в чергу',
    joined: 'Ви в черзі!',
    joinHint: 'Надішлемо повідомлення коли прийде ваша черга',
    joining: 'Реєструємо...',
    noMaster: 'Майстер не вказаний',
  },
  ru: {
    loading: 'Загрузка...',
    queueClosed: 'Очередь сейчас закрыта',
    queueClosedHint: 'Мастер не принимает без записи прямо сейчас',
    yourPosition: 'Ваша позиция',
    inService: 'Вас сейчас принимают!',
    waiting: (n: number) => `${n} ${n === 1 ? 'человек' : 'человека'} впереди`,
    join: 'Встать в очередь',
    joined: 'Вы в очереди!',
    joinHint: 'Пришлём сообщение когда подойдёт ваша очередь',
    joining: 'Регистрируем...',
    noMaster: 'Мастер не указан',
  },
  en: {
    loading: 'Loading...',
    queueClosed: 'Queue is currently closed',
    queueClosedHint: 'The master is not accepting walk-ins right now',
    yourPosition: 'Your position',
    inService: "You're being served now!",
    waiting: (n: number) => `${n} ${n === 1 ? 'person' : 'people'} ahead`,
    join: 'Join queue',
    joined: "You're in the queue!",
    joinHint: "We'll send a message when it's your turn",
    joining: 'Registering...',
    noMaster: 'Master not specified',
  },
};

type Lang = 'uk' | 'ru' | 'en';

function getLang(): Lang {
  if (typeof window === 'undefined') return 'uk';
  const w = window as { Telegram?: { WebApp?: { initDataUnsafe?: { user?: { language_code?: string } } } } };
  const code = w.Telegram?.WebApp?.initDataUnsafe?.user?.language_code ?? navigator.language ?? '';
  if (code.startsWith('uk')) return 'uk';
  if (code.startsWith('ru')) return 'ru';
  return 'en';
}

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

export default function ClientQueuePage() {
  const searchParams = useSearchParams();
  const masterId = searchParams.get('master_id');

  const [lang, setLang] = useState<Lang>('uk');
  const [state, setState] = useState<QueueState | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  const t = STR[lang];

  const loadState = useCallback(async () => {
    if (!masterId) { setLoading(false); return; }
    const initData = getInitData();
    const headers: Record<string, string> = {};
    if (initData) headers['X-TG-Init-Data'] = initData;
    const res = await fetch(`/api/telegram/c/queue?master_id=${masterId}`, { headers }).catch(() => null);
    if (!res?.ok) { setLoading(false); return; }
    const json = await res.json() as QueueState;
    setState(json);
    setLoading(false);
  }, [masterId]);

  useEffect(() => {
    setLang(getLang());
  }, []);

  useEffect(() => {
    loadState();
    const interval = setInterval(loadState, 15000);
    return () => clearInterval(interval);
  }, [loadState]);

  async function joinQueue() {
    if (!masterId || joining) return;
    setJoining(true);
    const initData = getInitData();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (initData) headers['X-TG-Init-Data'] = initData;
    await fetch('/api/telegram/c/queue', {
      method: 'POST',
      headers,
      body: JSON.stringify({ master_id: masterId }),
    }).catch(() => null);
    await loadState();
    setJoining(false);
  }

  if (!masterId) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.bg }}>
        <p style={{ ...TYPE.body, color: T.textSecondary }}>{t.noMaster}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.bg }}>
        <p style={{ ...TYPE.body, color: T.textTertiary }}>{t.loading}</p>
      </div>
    );
  }

  const masterName = state?.masterName ?? '';
  const myEntry = state?.myEntry ?? null;
  const totalAhead = myEntry ? Math.max(0, myEntry.position - 1) : 0;

  return (
    <div style={{
      minHeight: '100dvh',
      background: T.bg,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: `24px ${PAGE_PADDING_X}px`,
    }}>
      <div style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Master name */}
        {masterName && (
          <p style={{ ...TYPE.caption, color: T.textSecondary, textAlign: 'center' }}>
            {masterName}
          </p>
        )}

        {/* Queue closed */}
        {!state?.open && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              background: T.surface,
              border: `1px solid ${T.borderSubtle}`,
              borderRadius: R.lg,
              padding: 24,
              textAlign: 'center',
            }}
          >
            <Users size={32} color={T.textTertiary} style={{ margin: '0 auto 12px' }} />
            <p style={{ ...TYPE.h2, color: T.text }}>{t.queueClosed}</p>
            <p style={{ ...TYPE.caption, color: T.textSecondary, marginTop: 8 }}>{t.queueClosedHint}</p>
          </motion.div>
        )}

        {/* Queue open — my entry */}
        {state?.open && myEntry && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              background: myEntry.status === 'in_service' ? T.accentSoft : T.surface,
              border: `1px solid ${myEntry.status === 'in_service' ? T.accent + '40' : T.borderSubtle}`,
              borderRadius: R.lg,
              padding: 24,
              textAlign: 'center',
            }}
          >
            {myEntry.status === 'in_service' ? (
              <>
                <CheckCircle2 size={36} color={T.accent} style={{ margin: '0 auto 12px' }} />
                <p style={{ ...TYPE.h2, color: T.text }}>{t.inService}</p>
              </>
            ) : (
              <>
                <div style={{
                  width: 64, height: 64, borderRadius: '50%',
                  background: T.accent, color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 24, fontWeight: 800,
                  margin: '0 auto 12px',
                }}>
                  #{myEntry.position}
                </div>
                <p style={{ ...TYPE.h2, color: T.text }}>{t.yourPosition}</p>
                {totalAhead > 0 && (
                  <p style={{ ...TYPE.body, color: T.textSecondary, marginTop: 6 }}>
                    {t.waiting(totalAhead)}
                  </p>
                )}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12 }}>
                  <Clock size={14} color={T.textSecondary} />
                  <p style={{ ...TYPE.caption, color: T.textSecondary }}>{t.joinHint}</p>
                </div>
              </>
            )}
          </motion.div>
        )}

        {/* Queue open — not yet joined */}
        {state?.open && !myEntry && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
          >
            <div style={{
              background: T.surface,
              border: `1px solid ${T.borderSubtle}`,
              borderRadius: R.lg,
              padding: 20,
              textAlign: 'center',
            }}>
              <Users size={32} color={T.accent} style={{ margin: '0 auto 12px' }} />
              {(state.totalWaiting ?? 0) > 0 && (
                <p style={{ ...TYPE.body, color: T.textSecondary }}>
                  {t.waiting(state.totalWaiting)}
                </p>
              )}
            </div>

            <button
              onClick={joinQueue}
              disabled={joining}
              style={{
                width: '100%', padding: '16px 24px',
                borderRadius: R.md, background: T.accent,
                color: '#fff', border: 'none',
                fontSize: 16, fontWeight: 700,
                opacity: joining ? 0.7 : 1,
              }}
            >
              {joining ? t.joining : t.join}
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
