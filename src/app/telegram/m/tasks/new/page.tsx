/** --- YAML
 * name: MasterTaskComposer
 * description: Mini App master task composer — title, description, remind_at
 *              with quick presets («Через 5 мин», «Через 30 мин», «Через 1 час»,
 *              «Завтра в 9:00», «Custom date+time»). Saves via POST /api/tasks
 *              and redirects back to the list.
 * created: 2026-05-01
 * --- */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ChevronLeft, Bell, Loader2 } from 'lucide-react';
import { T, R, TYPE, SPRING, FONT_BASE } from '@/components/miniapp/design';
import { useTelegram } from '@/components/miniapp/telegram-provider';

const PRESETS: { label: string; minutes: number }[] = [
  { label: 'Через 5 мин', minutes: 5 },
  { label: 'Через 15 мин', minutes: 15 },
  { label: 'Через 30 мин', minutes: 30 },
  { label: 'Через 1 ч', minutes: 60 },
  { label: 'Через 2 ч', minutes: 120 },
];

function pad2(n: number) { return n < 10 ? `0${n}` : `${n}`; }

function localISOMin(d: Date): string {
  // YYYY-MM-DDTHH:mm — what <input type="datetime-local"> expects
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export default function NewTaskPage() {
  const router = useRouter();
  const { haptic } = useTelegram();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [remindLocal, setRemindLocal] = useState(() => {
    // Default = +30 min
    const d = new Date(Date.now() + 30 * 60 * 1000);
    return localISOMin(d);
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyPreset = (minutes: number) => {
    haptic('light');
    const d = new Date(Date.now() + minutes * 60 * 1000);
    setRemindLocal(localISOMin(d));
  };

  const tomorrowAt9 = () => {
    haptic('light');
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    setRemindLocal(localISOMin(d));
  };

  const submit = async () => {
    if (busy) return;
    if (!title.trim()) { setError('Введите название задачи'); return; }
    setError(null);
    setBusy(true);
    haptic('medium');

    // Convert local datetime to ISO with current timezone offset
    const remindAt = new Date(remindLocal);
    if (isNaN(remindAt.getTime())) { setError('Неверная дата'); setBusy(false); return; }

    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title.trim(),
        description: description.trim() || undefined,
        remind_at: remindAt.toISOString(),
      }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? 'Ошибка сохранения');
      setBusy(false);
      return;
    }
    router.push('/telegram/m/tasks');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={SPRING.soft}
      style={{ ...FONT_BASE, padding: '12px 16px 120px', minHeight: '100dvh' }}
    >
      <button
        type="button"
        onClick={() => { haptic('light'); router.back(); }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '8px 0',
          marginBottom: 8,
          background: 'transparent',
          border: 'none',
          color: T.textSecondary,
          fontSize: 14,
          cursor: 'pointer',
        }}
      >
        <ChevronLeft size={20} />
        Назад
      </button>

      <h1 style={{ ...TYPE.h1, color: T.text, margin: '0 0 20px' }}>Новая задача</h1>

      {/* Title */}
      <label style={{ display: 'block', marginBottom: 16 }}>
        <p style={{ ...TYPE.micro, color: T.textTertiary, margin: '0 0 6px' }}>Что не забыть</p>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, 200))}
          placeholder="Например: позвонить Марии"
          autoFocus
          style={{
            width: '100%',
            padding: '12px 14px',
            background: T.surface,
            border: `1px solid ${T.border}`,
            borderRadius: R.md,
            fontSize: 16,
            color: T.text,
            outline: 'none',
            fontFamily: 'inherit',
          }}
        />
      </label>

      {/* Description */}
      <label style={{ display: 'block', marginBottom: 24 }}>
        <p style={{ ...TYPE.micro, color: T.textTertiary, margin: '0 0 6px' }}>Описание (необязательно)</p>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, 2000))}
          placeholder="Детали — что обсудить, что взять, что сделать"
          rows={3}
          style={{
            width: '100%',
            padding: '12px 14px',
            background: T.surface,
            border: `1px solid ${T.border}`,
            borderRadius: R.md,
            fontSize: 15,
            color: T.text,
            outline: 'none',
            resize: 'vertical',
            fontFamily: 'inherit',
          }}
        />
      </label>

      {/* Quick presets */}
      <p style={{ ...TYPE.micro, color: T.textTertiary, margin: '0 0 8px' }}>Когда напомнить</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => applyPreset(p.minutes)}
            style={{
              padding: '8px 14px',
              borderRadius: R.pill,
              background: T.surface,
              border: `1px solid ${T.border}`,
              fontSize: 13,
              fontWeight: 500,
              color: T.text,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          onClick={tomorrowAt9}
          style={{
            padding: '8px 14px',
            borderRadius: R.pill,
            background: T.surface,
            border: `1px solid ${T.border}`,
            fontSize: 13,
            fontWeight: 500,
            color: T.text,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Завтра в 9:00
        </button>
      </div>

      {/* Datetime picker */}
      <input
        type="datetime-local"
        value={remindLocal}
        onChange={(e) => setRemindLocal(e.target.value)}
        style={{
          width: '100%',
          padding: '12px 14px',
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: R.md,
          fontSize: 15,
          color: T.text,
          outline: 'none',
          fontFamily: 'inherit',
          marginBottom: 16,
        }}
      />

      <p style={{ ...TYPE.caption, color: T.textSecondary, margin: '0 0 20px' }}>
        <Bell size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
        Напоминание придёт в Telegram точно в указанное время.
      </p>

      {error && (
        <p style={{ ...TYPE.caption, color: T.danger, margin: '0 0 12px' }}>{error}</p>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={busy || !title.trim()}
        style={{
          width: '100%',
          padding: '14px 20px',
          background: busy || !title.trim() ? T.textTertiary : T.accent,
          color: T.accentText,
          borderRadius: R.pill,
          border: 'none',
          fontSize: 15,
          fontWeight: 600,
          cursor: busy || !title.trim() ? 'not-allowed' : 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          fontFamily: 'inherit',
        }}
      >
        {busy && <Loader2 size={16} className="animate-spin" />}
        Сохранить задачу
      </button>
    </motion.div>
  );
}
