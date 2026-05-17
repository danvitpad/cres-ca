/** --- YAML
 * name: MiniAppContactsPage
 * description: Mini App "Мої майстри" — followed masters list. Matches mini-app masters.js prototype with master-card OD classes.
 * created: 2026-04-24
 * updated: 2026-05-14
 * --- */

'use client';

import '@/styles/od-client-mini-app.css';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Star, Loader2, Clock, X, UserPlus } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useTelegram } from '@/components/miniapp/telegram-provider';
import { MobilePage } from '@/components/miniapp/shells';

function getInitData(): string | null {
  if (typeof window === 'undefined') return null;
  const w = window as { Telegram?: { WebApp?: { initData?: string } } };
  const live = w.Telegram?.WebApp?.initData;
  if (live) return live;
  try {
    const stash = sessionStorage.getItem('cres:tg');
    if (stash) {
      const parsed = JSON.parse(stash) as { initData?: string };
      return parsed.initData ?? null;
    }
  } catch { /* ignore */ }
  return null;
}

function authHeaders(): Record<string, string> {
  const initData = getInitData();
  return initData ? { 'x-tg-init-data': initData } : {};
}

type Lang = 'uk' | 'ru' | 'en';

function getContactsLocale(): Lang {
  if (typeof window === 'undefined') return 'uk';
  try {
    const stored = localStorage.getItem('cres:locale');
    if (stored === 'ru' || stored === 'en' || stored === 'uk') return stored;
  } catch {}
  return 'uk';
}

const STR = {
  uk: {
    title: 'Мої майстри',
    book: 'Записатись',
    emptyTitle: 'Ви ще не підписані на майстрів',
    emptyDesc: 'Знайди майстра і підпишись, щоб бачити їх оновлення та швидко записуватися.',
    findMaster: 'Знайти майстра',
    masterFallback: 'Майстер',
    nearestSlots: 'Найближчі вікна',
    pendingTitle: 'Нові підписники',
    pendingDesc: 'Підписалися на вас',
    followBack: 'Підписатися у відповідь',
    confirmRemove: (name: string) => `Видалити ${name} з контактів?`,
  },
  ru: {
    title: 'Мои мастера',
    book: 'Записаться',
    emptyTitle: 'Вы пока не подписан на мастеров',
    emptyDesc: 'Найди мастера и подпишись, чтобы видеть их обновления и быстро записываться.',
    findMaster: 'Найти мастера',
    masterFallback: 'Мастер',
    nearestSlots: 'Ближайшие окна',
    pendingTitle: 'Новые подписчики',
    pendingDesc: 'Подписались на вас',
    followBack: 'Подписаться в ответ',
    confirmRemove: (name: string) => `Удалить ${name} из контактов?`,
  },
  en: {
    title: 'My masters',
    book: 'Book',
    emptyTitle: "You haven't followed any masters yet",
    emptyDesc: 'Find a master and follow to see updates and book quickly.',
    findMaster: 'Find a master',
    masterFallback: 'Master',
    nearestSlots: 'Nearest openings',
    pendingTitle: 'New subscribers',
    pendingDesc: 'Followed you',
    followBack: 'Follow back',
    confirmRemove: (name: string) => `Remove ${name} from contacts?`,
  },
} as const;

interface MasterItem {
  id: string;
  name: string | null;
  avatar: string | null;
  city: string | null;
  rating: number | null;
  specialization: string | null;
  salonName: string | null;
}

interface NextSlot {
  masterId: string;
  name: string | null;
  avatar: string | null;
  date: string;
  time: string;
  iso: string;
}

function getInitials(name: string | null): string {
  if (!name) return '?';
  return name.split(' ').filter(Boolean).map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

function formatSlotDate(dateStr: string, time: string): string {
  const lang = getContactsLocale();
  const TODAY: Record<string, string> = { uk: 'Сьогодні', ru: 'Сегодня', en: 'Today' };
  const TOMORROW: Record<string, string> = { uk: 'Завтра', ru: 'Завтра', en: 'Tomorrow' };
  const LOC: Record<string, string> = { uk: 'uk-UA', ru: 'ru-RU', en: 'en-US' };
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today.getTime() + 86400000);
  if (d.getTime() === today.getTime()) return `${TODAY[lang]} ${time}`;
  if (d.getTime() === tomorrow.getTime()) return `${TOMORROW[lang]} ${time}`;
  return `${d.toLocaleDateString(LOC[lang], { day: 'numeric', month: 'short' })} ${time}`;
}

export default function MiniAppContactsPage() {
  const router = useRouter();
  const { haptic } = useTelegram();
  const { userId } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const lang = getContactsLocale();
  const t = STR[lang];

  const [masters, setMasters] = useState<MasterItem[]>([]);
  const [pendingMasters, setPendingMasters] = useState<MasterItem[]>([]);
  const [busyPending, setBusyPending] = useState<string | null>(null);
  const [nextSlots, setNextSlots] = useState<NextSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);

  function tgConfirm(message: string): Promise<boolean> {
    const tg = (typeof window !== 'undefined' ? window : null) as
      | (Window & { Telegram?: { WebApp?: { showConfirm?: (m: string, cb: (ok: boolean) => void) => void } } })
      | null;
    if (tg?.Telegram?.WebApp?.showConfirm) {
      return new Promise((resolve) => tg.Telegram!.WebApp!.showConfirm!(message, (ok) => resolve(ok)));
    }
    return Promise.resolve(window.confirm(message));
  }

  async function unfollowMaster(id: string, name: string | null) {
    if (removing) return;
    const ok = await tgConfirm(t.confirmRemove(name ?? t.masterFallback.toLowerCase()));
    if (!ok) return;
    setRemoving(id);
    haptic('warning');
    try {
      const res = await fetch('/api/follow/crm/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ masterId: id }),
      });
      if (res.ok) setMasters((prev) => prev.filter((m) => m.id !== id));
    } finally {
      setRemoving(null);
    }
  }

  async function followBackMaster(masterId: string) {
    if (busyPending) return;
    setBusyPending(masterId);
    haptic('selection');
    try {
      const res = await fetch('/api/follow/crm/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ masterId }),
      });
      if (res.ok) {
        const moved = pendingMasters.find((m) => m.id === masterId);
        setPendingMasters((prev) => prev.filter((m) => m.id !== masterId));
        if (moved) setMasters((prev) => [moved, ...prev]);
      }
    } finally {
      setBusyPending(null);
    }
  }

  async function dismissPendingMaster(masterId: string) {
    if (busyPending) return;
    setBusyPending(masterId);
    haptic('light');
    try {
      const res = await fetch('/api/follow/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ side: 'client', masterId }),
      });
      if (res.ok) setPendingMasters((prev) => prev.filter((m) => m.id !== masterId));
    } finally {
      setBusyPending(null);
    }
  }

  useEffect(() => {
    if (!userId) return;
    (async () => {
      setLoading(true);
      try {
        const [contactsRes, pendingRes] = await Promise.all([
          fetch('/api/me/contacts', { headers: authHeaders() }),
          fetch('/api/me/pending-masters', { headers: authHeaders() }),
        ]);
        if (contactsRes.ok) {
          const data = await contactsRes.json() as { masters: MasterItem[] };
          setMasters(data.masters ?? []);
        }
        if (pendingRes.ok) {
          const data = await pendingRes.json() as { masters: MasterItem[] };
          setPendingMasters(data.masters ?? []);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      setSlotsLoading(true);
      try {
        const res = await fetch(`/api/me/followed-slots?profileId=${userId}`, { headers: authHeaders() });
        if (res.ok) {
          const data = await res.json();
          setNextSlots((data.items ?? []).slice(0, 5));
        }
      } finally {
        setSlotsLoading(false);
      }
    })();
  }, [userId]);

  return (
    <MobilePage className="od-client-mini-app">
      <div style={{ padding: '14px 16px 4px' }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--fg)' }}>{t.title}</div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
          <Loader2 className="animate-spin" style={{ width: 24, height: 24, color: 'var(--fg-3)' }} />
        </div>
      ) : (
        <>
          {/* Pending masters */}
          {pendingMasters.length > 0 && (
            <div style={{ margin: '8px 16px', background: 'var(--accent-2)', borderRadius: 'var(--radius-lg)', border: '1.5px solid var(--accent)', overflow: 'hidden' }}>
              <div style={{ padding: '10px 16px 4px', fontSize: 12, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '.5px' }}>
                {t.pendingTitle} · {pendingMasters.length}
              </div>
              {pendingMasters.map((m) => {
                const busy = busyPending === m.id;
                return (
                  <div
                    key={m.id}
                    className="master-card"
                    style={{ background: 'transparent' }}
                    onClick={() => { haptic('light'); router.push(`/telegram/search/${m.id}`); }}
                  >
                    <div className="avatar av-md" style={{ background: 'var(--accent-2)', color: 'var(--accent)', border: '1.5px solid var(--accent)' }}>
                      {getInitials(m.name)}
                    </div>
                    <div className="mc-info">
                      <div className="mc-name">{m.name ?? t.masterFallback}</div>
                      <div className="mc-meta">{t.pendingDesc}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => followBackMaster(m.id)}
                        disabled={busy}
                        style={{ fontSize: 11, padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 3 }}
                      >
                        {busy
                          ? <Loader2 size={12} className="animate-spin" />
                          : <><UserPlus size={11} />{t.followBack}</>}
                      </button>
                      <button
                        onClick={() => dismissPendingMaster(m.id)}
                        disabled={busy}
                        style={{ width: 28, height: 28, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--fg-3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Nearest free slots */}
          {!slotsLoading && nextSlots.length > 0 && (
            <div style={{ margin: '8px 16px', padding: '10px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Clock size={12} /> {t.nearestSlots}
              </div>
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none' }}>
                {nextSlots.map((s) => (
                  <div
                    key={s.masterId + s.iso}
                    onClick={() => { haptic('light'); router.push(`/telegram/book?master_id=${s.masterId}&date=${s.date}&time=${encodeURIComponent(s.time)}`); }}
                    style={{ minWidth: 130, flexShrink: 0, background: 'var(--surface2)', borderRadius: 'var(--radius-md)', padding: '8px 12px', cursor: 'pointer' }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg)' }}>{s.name ?? t.masterFallback}</div>
                    <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Clock size={10} /> {formatSlotDate(s.date, s.time)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Masters list */}
          {masters.length === 0 && pendingMasters.length === 0 ? (
            <div className="empty-state">
              <div style={{ fontSize: 36, marginBottom: 8 }}>💙</div>
              <p>{t.emptyTitle}</p>
              <span>{t.emptyDesc}</span>
              <div style={{ marginTop: 16 }}>
                <button
                  className="btn btn-primary"
                  style={{ width: 'auto', padding: '0 24px' }}
                  onClick={() => router.push('/telegram/search')}
                >
                  {t.findMaster}
                </button>
              </div>
            </div>
          ) : masters.length > 0 ? (
            <div style={{ marginTop: 8 }}>
              {masters.map((m) => (
                <div
                  key={m.id}
                  className="master-card"
                  onClick={() => { haptic('light'); router.push(`/telegram/search/${m.id}`); }}
                >
                  <div className="avatar av-md" style={{ background: 'var(--accent-2)', color: 'var(--accent)' }}>
                    {getInitials(m.name)}
                  </div>
                  <div className="mc-info">
                    <div className="mc-name">{m.name ?? t.masterFallback}</div>
                    <div className="mc-meta">
                      {m.rating != null && (
                        <><Star size={10} style={{ fill: 'currentColor' }} />&nbsp;{m.rating.toFixed(1)}{(m.specialization || m.city) ? ' · ' : ''}</>
                      )}
                      {m.specialization ?? m.city ?? ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => { haptic('light'); router.push(`/telegram/book?master_id=${m.id}`); }}
                    >
                      {t.book}
                    </button>
                    <button
                      onClick={() => unfollowMaster(m.id, m.name)}
                      disabled={removing === m.id}
                      style={{ width: 28, height: 28, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--fg-3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      {removing === m.id ? <Loader2 size={12} className="animate-spin" /> : <X size={14} />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </>
      )}
    </MobilePage>
  );
}
