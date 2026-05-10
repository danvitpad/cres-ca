/** --- YAML
 * name: MasterMiniAppWaitlist
 * description: Лист ожидания мастера — клиенты кто ждёт окошко. Видны:
 *              кто, на какую услугу, в какие дни/время удобно, статус
 *              (ждёт / зарезервирован / уже забронировал слот).
 *              Когда у мастера освободится окошко — система сама пошлёт
 *              первому подходящему клиенту TG с кнопкой «Записатися»,
 *              на 30 минут резерв. Если не запишется за это время —
 *              предложит следующему.
 * created: 2026-05-10
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Clock, Sun, Moon, Sunset, Users } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useTelegram } from '@/components/miniapp/telegram-provider';
import { getInitData } from '@/lib/telegram/webapp';
import { MobilePage, PageHeader } from '@/components/miniapp/shells';
import { T, R, TYPE, SHADOW, PAGE_PADDING_X, FONT_BASE } from '@/components/miniapp/design';

interface WaitlistEntry {
  id: string;
  client_name: string;
  service_name: string;
  preferred_days: number[] | null;
  preferred_time_window: string;
  status: 'waiting' | 'reserved' | 'booked' | 'expired';
  reserved_until: string | null;
  created_at: string;
}

const DAY_SHORT: Record<number, string> = { 0: 'Нд', 1: 'Пн', 2: 'Вт', 3: 'Ср', 4: 'Чт', 5: 'Пт', 6: 'Сб' };
const TIME_LABEL: Record<string, string> = {
  morning: 'Ранок 9–12',
  afternoon: 'День 12–17',
  evening: 'Вечір 17–21',
  any: 'Будь-який час',
};

export default function MasterMiniAppWaitlist() {
  const { userId } = useAuthStore();
  const { haptic } = useTelegram();
  const router = useRouter();
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const initData = getInitData();
      if (!initData) { setLoading(false); return; }
      const res = await fetch('/api/telegram/m/waitlist-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData }),
      });
      if (cancelled) return;
      if (res.ok) {
        const json = await res.json() as { entries: WaitlistEntry[] };
        setEntries(json.entries ?? []);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const waiting = entries.filter((e) => e.status === 'waiting');
  const reserved = entries.filter((e) => e.status === 'reserved');
  const booked = entries.filter((e) => e.status === 'booked');

  return (
    <MobilePage>
      <div style={{ padding: `12px ${PAGE_PADDING_X}px 0`, ...FONT_BASE }}>
        <button
          type="button"
          onClick={() => { haptic('light'); router.back(); }}
          aria-label="Назад"
          style={{
            width: 40, height: 40, borderRadius: 20,
            border: `1px solid ${T.border}`, background: T.surface, color: T.text,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', boxShadow: SHADOW.card,
          }}
        >
          <ArrowLeft size={18} strokeWidth={2.4} />
        </button>
      </div>
      <PageHeader title="Лист очікування" subtitle="Клієнти що чекають твоє вікно" />

      <div style={{ padding: `8px ${PAGE_PADDING_X}px 0`, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {loading && (
          [0, 1, 2].map((i) => (
            <div key={i} style={{ height: 90, borderRadius: R.md, background: T.bgSubtle }} />
          ))
        )}

        {!loading && entries.length === 0 && (
          <div style={{
            padding: '32px 16px', textAlign: 'center',
            background: T.surface, borderRadius: R.md, border: `1px solid ${T.borderSubtle}`,
          }}>
            <Users size={32} color={T.textTertiary} style={{ margin: '0 auto 12px' }} />
            <p style={{ ...TYPE.bodyStrong, color: T.text, margin: 0 }}>Поки нікого</p>
            <p style={{ ...TYPE.caption, color: T.textTertiary, margin: '6px 0 0', lineHeight: 1.5 }}>
              Коли в клієнта не буде вільних слотів на твоєму календарі — він зможе встати в чергу.
              Тут побачиш хто чекає. Звільниться вікно — система сама запропонує першому підходящому.
            </p>
          </div>
        )}

        {!loading && reserved.length > 0 && (
          <Section title="Зарезервовано — чекаємо запис" entries={reserved} accent="#10b981" />
        )}
        {!loading && waiting.length > 0 && (
          <Section title="В черзі" entries={waiting} accent={T.accent} />
        )}
        {!loading && booked.length > 0 && (
          <Section title="Записалися із черги" entries={booked} accent={T.textTertiary} />
        )}
      </div>
    </MobilePage>
  );
}

function Section({ title, entries, accent }: { title: string; entries: WaitlistEntry[]; accent: string }) {
  return (
    <div>
      <p style={{
        ...TYPE.micro, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.06em', color: T.textTertiary,
        margin: '0 0 8px', padding: '0 4px',
      }}>{title}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {entries.map((e) => (
          <EntryCard key={e.id} entry={e} accent={accent} />
        ))}
      </div>
    </div>
  );
}

function EntryCard({ entry, accent }: { entry: WaitlistEntry; accent: string }) {
  const days = entry.preferred_days?.length
    ? entry.preferred_days.sort().map((d) => DAY_SHORT[d]).join(' · ')
    : 'Будь-який день';
  const timeLabel = TIME_LABEL[entry.preferred_time_window] ?? 'Будь-який час';
  const TimeIcon = entry.preferred_time_window === 'morning' ? Sun
    : entry.preferred_time_window === 'evening' ? Moon
    : entry.preferred_time_window === 'afternoon' ? Sunset : Clock;

  return (
    <div style={{
      padding: '14px 16px', borderRadius: R.md,
      background: T.surface, border: `1px solid ${T.borderSubtle}`,
      boxShadow: SHADOW.card,
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <p style={{ ...TYPE.bodyStrong, color: T.text, margin: 0 }}>{entry.client_name}</p>
        {entry.status === 'reserved' && entry.reserved_until && (
          <ReservedBadge until={entry.reserved_until} />
        )}
        {entry.status === 'booked' && (
          <span style={{
            ...TYPE.micro, fontWeight: 700, padding: '2px 8px', borderRadius: R.pill,
            background: '#10b98115', color: accent,
          }}>записався</span>
        )}
      </div>
      <p style={{ ...TYPE.caption, color: T.textSecondary, margin: 0 }}>
        {entry.service_name}
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
        <Chip text={days} />
        <Chip text={timeLabel} icon={<TimeIcon size={11} />} />
      </div>
    </div>
  );
}

function Chip({ text, icon }: { text: string; icon?: React.ReactNode }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 8px', borderRadius: R.pill,
      background: T.bgSubtle, color: T.textSecondary,
      fontSize: 11, fontWeight: 500,
    }}>
      {icon}{text}
    </span>
  );
}

function ReservedBadge({ until }: { until: string }) {
  const [minutesLeft, setMinutesLeft] = useState(() => {
    const ms = new Date(until).getTime() - Date.now();
    return Math.max(0, Math.floor(ms / 60000));
  });

  useEffect(() => {
    const tick = setInterval(() => {
      const ms = new Date(until).getTime() - Date.now();
      setMinutesLeft(Math.max(0, Math.floor(ms / 60000)));
    }, 30000);
    return () => clearInterval(tick);
  }, [until]);

  return (
    <span style={{
      ...TYPE.micro, fontWeight: 700, padding: '2px 8px', borderRadius: R.pill,
      background: '#10b98115', color: '#059669',
    }}>
      резерв · ще {minutesLeft} хв
    </span>
  );
}
