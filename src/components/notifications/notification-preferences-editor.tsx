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

interface DraftInput {
  days: string;
  hours: string;
  minutes: string;
}

function minutesToOffset(m: number): Offset {
  const days = Math.floor(m / (24 * 60));
  const rem = m - days * 24 * 60;
  const hours = Math.floor(rem / 60);
  const minutes = rem - hours * 60;
  return { days, hours, minutes };
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
      return parsed.initData ?? null;
    }
  } catch { /* ignore */ }
  return null;
}

function authHeaders(): Record<string, string> {
  const initData = getInitData();
  return initData ? { 'x-tg-init-data': initData } : {};
}

function clampNumber(s: string, min: number, max: number): number {
  if (s === '') return 0;
  const n = parseInt(s, 10);
  if (!Number.isFinite(n)) return 0;
  return Math.max(min, Math.min(max, n));
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

export function NotificationPreferencesEditor({ theme = 'light' }: { theme?: 'light' | 'dark' | 'miniapp' }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [offsets, setOffsets] = useState<Offset[]>([]);
  const [quietStart, setQuietStart] = useState<string>('');
  const [quietEnd, setQuietEnd] = useState<string>('');
  const [draft, setDraft] = useState<DraftInput>({ days: '', hours: '2', minutes: '' });

  const isDark = theme === 'dark';
  const isMini = theme === 'miniapp';

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/me/notification-preferences', { headers: authHeaders() });
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
    const o: Offset = {
      days: clampNumber(draft.days, 0, 30),
      hours: clampNumber(draft.hours, 0, 23),
      minutes: clampNumber(draft.minutes, 0, 59),
    };
    const mins = offsetToMinutes(o);
    if (mins <= 0) {
      toast.error('Укажите хотя бы 1 минуту');
      return;
    }
    if (offsets.length >= 10) {
      toast.error('Максимум 10 напоминаний');
      return;
    }
    if (offsets.some((existing) => offsetToMinutes(existing) === mins)) {
      toast.error('Такое напоминание уже есть');
      return;
    }
    setOffsets((prev) =>
      [...prev, o].sort((a, b) => offsetToMinutes(b) - offsetToMinutes(a)),
    );
    setDraft({ days: '', hours: '', minutes: '' });
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

    // Auto-include unsaved draft if it represents a real offset.
    // User often types "5" in minutes and forgets to press "+ Добавить",
    // expecting Save alone to capture the new value.
    const draftOffset: Offset = {
      days: clampNumber(draft.days, 0, 30),
      hours: clampNumber(draft.hours, 0, 23),
      minutes: clampNumber(draft.minutes, 0, 59),
    };
    const draftMins = offsetToMinutes(draftOffset);
    const userTouchedDraft = draft.days !== '' || draft.minutes !== '' || (draft.hours !== '' && draft.hours !== '2');
    const finalOffsets = [...offsets];
    if (userTouchedDraft && draftMins > 0 && !finalOffsets.some((o) => offsetToMinutes(o) === draftMins) && finalOffsets.length < 10) {
      finalOffsets.push(draftOffset);
      finalOffsets.sort((a, b) => offsetToMinutes(b) - offsetToMinutes(a));
      setOffsets(finalOffsets);
      setDraft({ days: '', hours: '', minutes: '' });
    }

    try {
      const res = await fetch('/api/me/notification-preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          offsets_minutes: finalOffsets.map(offsetToMinutes),
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
    } catch (e) {
      toast.error((e as Error)?.message ?? 'Сетевая ошибка');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-10">
        <Loader2 className={`size-6 animate-spin ${isDark ? 'text-white/60' : isMini ? 'text-neutral-400' : 'text-muted-foreground'}`} />
      </div>
    );
  }

  // For Mini App use CSS variables from design.ts that switch automatically
  // via data-theme=dark on the parent provider div — single component handles
  // both light & dark Telegram themes without inline conditionals.
  const cardCls = isDark
    ? 'rounded-2xl border border-white/10 bg-white/[0.03] p-4'
    : isMini
      ? 'rounded-2xl border border-[var(--m-border-subtle)] bg-[var(--m-surface)] p-4 shadow-sm'
      : 'rounded-2xl border border-border bg-card p-4';
  const inputCls = isDark
    ? 'h-10 w-full rounded-xl border border-white/15 bg-white/[0.05] px-3 text-sm text-white outline-none focus:border-[var(--color-accent)]'
    : isMini
      ? 'h-10 w-full rounded-xl border border-[var(--m-border-subtle)] bg-[var(--m-bg)] px-3 text-sm text-[var(--m-text)] outline-none focus:border-[var(--m-accent)]'
      : 'h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary';
  const textMuted = isDark ? 'text-white/55' : isMini ? 'text-[var(--m-text-tertiary)]' : 'text-muted-foreground';
  const offsetRowBg = isDark ? 'bg-white/[0.04]' : isMini ? 'bg-[var(--m-bg-subtle)]' : 'bg-muted/40';
  const dashedBorder = isDark ? 'border-white/15' : isMini ? 'border-[var(--m-border)]' : 'border-border';
  const trashCls = isDark
    ? 'text-white/50 hover:bg-white/10 hover:text-white'
    : isMini
      ? 'text-[var(--m-text-tertiary)] hover:bg-[var(--m-danger-soft)] hover:text-[var(--m-danger)]'
      : 'text-muted-foreground hover:bg-destructive/10 hover:text-destructive';

  return (
    <div className="space-y-4">
      {/* Global on/off */}
      <div className={cardCls}>
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="mt-0.5 size-4 accent-[var(--color-accent)]"
          />
          <div>
            <p className="text-sm font-semibold">Получать напоминания о записях</p>
            <p className={`text-[12px] ${textMuted}`}>
              Если выключить — вы не будешь получать уведомления в Telegram / email.
            </p>
          </div>
        </label>
      </div>

      {/* Active offsets list */}
      <div className={cardCls}>
        <div className="mb-3 flex items-center gap-2">
          <Bell className="size-4 text-[var(--color-accent)]" />
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
                className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 ${offsetRowBg}`}
              >
                <span className="flex items-center gap-2 text-sm">
                  <Bell className="size-3.5 text-[var(--color-accent)]" />
                  <span>за <strong>{formatLabel(offsetToMinutes(o))}</strong> до визита</span>
                </span>
                <button
                  onClick={() => removeOffset(i)}
                  className={`grid size-7 place-items-center rounded-md ${trashCls}`}
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
          <div className={`rounded-xl border border-dashed p-3 ${dashedBorder}`}>
            <p className={`mb-2 text-[11px] uppercase tracking-wider ${textMuted}`}>Добавить напоминание — за</p>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={30}
                  placeholder="0"
                  value={draft.days}
                  onChange={(e) => setDraft({ ...draft, days: e.target.value.replace(/[^0-9]/g, '').slice(0, 2) })}
                  className={inputCls}
                />
                <p className={`mt-1 text-center text-[10px] ${textMuted}`}>дней</p>
              </div>
              <div>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={23}
                  placeholder="0"
                  value={draft.hours}
                  onChange={(e) => setDraft({ ...draft, hours: e.target.value.replace(/[^0-9]/g, '').slice(0, 2) })}
                  className={inputCls}
                />
                <p className={`mt-1 text-center text-[10px] ${textMuted}`}>часов</p>
              </div>
              <div>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={59}
                  placeholder="0"
                  value={draft.minutes}
                  onChange={(e) => setDraft({ ...draft, minutes: e.target.value.replace(/[^0-9]/g, '').slice(0, 2) })}
                  className={inputCls}
                />
                <p className={`mt-1 text-center text-[10px] ${textMuted}`}>минут</p>
              </div>
            </div>
            <button
              onClick={addOffset}
              className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-full bg-[var(--color-accent-soft)] px-3 text-xs font-semibold text-[var(--color-accent)] hover:bg-[var(--color-accent-soft)]"
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
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--color-accent)] px-5 py-3 text-sm font-semibold text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-60"
      >
        {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
        Сохранить
      </button>
    </div>
  );
}
