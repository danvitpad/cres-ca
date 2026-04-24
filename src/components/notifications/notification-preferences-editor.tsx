/** --- YAML
 * name: Notification preferences editor
 * description: Reusable form for managing per-profile notification timings. Used on both web dashboard
 *              and client Mini App settings page.
 * created: 2026-04-24
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { Bell, Plus, Trash2, Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';

interface Offset {
  days: number;
  hours: number;
  minutes: number;
}

function minutesToOffset(m: number): Offset {
  const days = Math.floor(m / (24 * 60));
  const rem = m - days * 24 * 60;
  const hours = Math.floor(rem / 60);
  const minutes = rem - hours * 60;
  return { days, hours, minutes };
}

function offsetToMinutes(o: Offset): number {
  return o.days * 24 * 60 + o.hours * 60 + o.minutes;
}

function formatLabel(m: number): string {
  const { days, hours, minutes } = minutesToOffset(m);
  const parts: string[] = [];
  if (days > 0) parts.push(`${days} ${days === 1 ? 'день' : days < 5 ? 'дня' : 'дней'}`);
  if (hours > 0) parts.push(`${hours} ${hours === 1 ? 'час' : hours < 5 ? 'часа' : 'часов'}`);
  if (minutes > 0) parts.push(`${minutes} мин`);
  return parts.join(' ') || '0';
}

export function NotificationPreferencesEditor({ theme = 'light' }: { theme?: 'light' | 'dark' }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [offsets, setOffsets] = useState<Offset[]>([]);
  const [quietStart, setQuietStart] = useState<string>('');
  const [quietEnd, setQuietEnd] = useState<string>('');
  const [draft, setDraft] = useState<Offset>({ days: 0, hours: 2, minutes: 0 });

  const isDark = theme === 'dark';

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/me/notification-preferences');
        if (res.ok) {
          const data = (await res.json()) as {
            offsets_minutes: number[];
            enabled: boolean;
            quiet_hours_start: number | null;
            quiet_hours_end: number | null;
          };
          setEnabled(data.enabled);
          setOffsets(data.offsets_minutes.map(minutesToOffset));
          setQuietStart(data.quiet_hours_start !== null ? String(data.quiet_hours_start) : '');
          setQuietEnd(data.quiet_hours_end !== null ? String(data.quiet_hours_end) : '');
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const addOffset = () => {
    const mins = offsetToMinutes(draft);
    if (mins <= 0) {
      toast.error('Укажи хотя бы 1 минуту');
      return;
    }
    if (offsets.length >= 10) {
      toast.error('Максимум 10 напоминаний');
      return;
    }
    if (offsets.some((o) => offsetToMinutes(o) === mins)) {
      toast.error('Такое напоминание уже есть');
      return;
    }
    setOffsets((prev) =>
      [...prev, draft].sort((a, b) => offsetToMinutes(b) - offsetToMinutes(a)),
    );
    setDraft({ days: 0, hours: 2, minutes: 0 });
  };

  const removeOffset = (idx: number) => {
    if (offsets.length === 1) {
      toast.error('Хотя бы одно напоминание должно быть');
      return;
    }
    setOffsets((prev) => prev.filter((_, i) => i !== idx));
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/me/notification-preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offsets_minutes: offsets.map(offsetToMinutes),
          enabled,
          quiet_hours_start: quietStart === '' ? null : Number(quietStart),
          quiet_hours_end: quietEnd === '' ? null : Number(quietEnd),
        }),
      });
      if (res.ok) {
        toast.success('Сохранено');
      } else {
        const j = await res.json().catch(() => ({}));
        toast.error(j.error ?? 'Ошибка');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-10">
        <Loader2 className={`size-6 animate-spin ${isDark ? 'text-white/60' : 'text-muted-foreground'}`} />
      </div>
    );
  }

  const cardCls = isDark
    ? 'rounded-2xl border border-white/10 bg-white/[0.03] p-4'
    : 'rounded-2xl border border-border bg-card p-4';
  const inputCls = isDark
    ? 'h-10 w-full rounded-xl border border-white/15 bg-white/[0.05] px-3 text-sm text-white outline-none focus:border-violet-400/50'
    : 'h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary';
  const textMuted = isDark ? 'text-white/55' : 'text-muted-foreground';

  return (
    <div className="space-y-4">
      {/* Global on/off */}
      <div className={cardCls}>
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="mt-0.5 size-4 accent-violet-500"
          />
          <div>
            <p className="text-sm font-semibold">Получать напоминания о записях</p>
            <p className={`text-[12px] ${textMuted}`}>
              Если выключить — ты не будешь получать уведомления в Telegram / email.
            </p>
          </div>
        </label>
      </div>

      {/* Active offsets list */}
      <div className={cardCls}>
        <div className="mb-3 flex items-center gap-2">
          <Bell className="size-4 text-violet-500" />
          <h3 className="text-sm font-semibold">Когда напомнить</h3>
        </div>
        <p className={`mb-3 text-[12px] ${textMuted}`}>
          Для каждой записи мы пришлём уведомление столько раз, сколько настроишь. Можно добавить до 10.
        </p>

        {offsets.length > 0 && (
          <ul className="mb-3 space-y-2">
            {offsets.map((o, i) => (
              <li
                key={i}
                className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 ${
                  isDark ? 'bg-white/[0.04]' : 'bg-muted/40'
                }`}
              >
                <span className="flex items-center gap-2 text-sm">
                  <Bell className="size-3.5 text-violet-500" />
                  <span>за <strong>{formatLabel(offsetToMinutes(o))}</strong> до визита</span>
                </span>
                <button
                  onClick={() => removeOffset(i)}
                  className={`grid size-7 place-items-center rounded-md ${isDark ? 'text-white/50 hover:bg-white/10 hover:text-white' : 'text-muted-foreground hover:bg-destructive/10 hover:text-destructive'}`}
                  aria-label="Удалить"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Add form */}
        {offsets.length < 10 && (
          <div className={`rounded-xl border border-dashed p-3 ${isDark ? 'border-white/15' : 'border-border'}`}>
            <p className={`mb-2 text-[11px] uppercase tracking-wider ${textMuted}`}>Добавить напоминание — за</p>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <input
                  type="number"
                  min={0}
                  max={30}
                  value={draft.days}
                  onChange={(e) => setDraft({ ...draft, days: Math.max(0, Math.min(30, Number(e.target.value) || 0)) })}
                  className={inputCls}
                />
                <p className={`mt-1 text-center text-[10px] ${textMuted}`}>дней</p>
              </div>
              <div>
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={draft.hours}
                  onChange={(e) => setDraft({ ...draft, hours: Math.max(0, Math.min(23, Number(e.target.value) || 0)) })}
                  className={inputCls}
                />
                <p className={`mt-1 text-center text-[10px] ${textMuted}`}>часов</p>
              </div>
              <div>
                <input
                  type="number"
                  min={0}
                  max={59}
                  step={5}
                  value={draft.minutes}
                  onChange={(e) => setDraft({ ...draft, minutes: Math.max(0, Math.min(59, Number(e.target.value) || 0)) })}
                  className={inputCls}
                />
                <p className={`mt-1 text-center text-[10px] ${textMuted}`}>минут</p>
              </div>
            </div>
            <button
              onClick={addOffset}
              className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-full bg-violet-500/15 px-3 text-xs font-semibold text-violet-600 hover:bg-violet-500/25 dark:text-violet-200"
            >
              <Plus className="size-3.5" />
              Добавить
            </button>
          </div>
        )}
      </div>

      {/* Quiet hours */}
      <div className={cardCls}>
        <h3 className="mb-1 text-sm font-semibold">Тихие часы (не беспокоить)</h3>
        <p className={`mb-3 text-[12px] ${textMuted}`}>
          В это время уведомления придут отложенно — когда выйдешь из тихих часов. Оставь пусто чтобы уведомлять всегда.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className={`mb-1 text-[11px] ${textMuted}`}>С (час)</p>
            <input
              type="number"
              min={0}
              max={23}
              placeholder="—"
              value={quietStart}
              onChange={(e) => setQuietStart(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <p className={`mb-1 text-[11px] ${textMuted}`}>До (час)</p>
            <input
              type="number"
              min={0}
              max={23}
              placeholder="—"
              value={quietEnd}
              onChange={(e) => setQuietEnd(e.target.value)}
              className={inputCls}
            />
          </div>
        </div>
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-violet-500 px-5 py-3 text-sm font-semibold text-white hover:bg-violet-600 disabled:opacity-60"
      >
        {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
        Сохранить
      </button>
    </div>
  );
}
