/** --- YAML
 * name: BlockTimeSheet
 * description: Bottom-sheet «Заблокировать время» для master Mini App.
 *              Title (optional) + start time + duration + сохранённые шаблоны.
 *              Шаблоны берутся из block_time_templates через /api/telegram/m/block-time GET.
 *              Сохранение через POST на тот же endpoint. Локализация uk/ru/en.
 *              Высота 90dvh — кнопка «Сохранить» остаётся видимой при открытой клавиатуре.
 * created: 2026-05-09
 * --- */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence, type PanInfo } from 'framer-motion';
import { Loader2, X, CalendarOff } from 'lucide-react';
import { useTelegram } from '@/components/miniapp/telegram-provider';
import { T, R, FONT_BASE, PAGE_PADDING_X } from '@/components/miniapp/design';
import { useMiniAppLocale, type MiniAppLang } from '@/lib/miniapp/use-locale';

interface Template {
  id: string;
  title: string;
  duration_minutes: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** ISO date of the day to block on. Time-of-day is ignored — sheet picks own time. */
  date: Date;
  /** Default time to suggest, "HH:MM". */
  defaultTime?: string;
  onSaved: () => void;
}

const I18N: Record<MiniAppLang, {
  title: string;
  templatesLabel: string;
  noTemplatesHint: string;
  titleLabel: string;
  titlePlaceholder: string;
  startLabel: string;
  durationLabel: string;
  minutesUnit: string;
  saveBtn: string;
  savingBtn: string;
  errorMissing: string;
  errorSave: string;
  dateLocale: 'uk-UA' | 'ru-RU' | 'en-GB';
}> = {
  uk: {
    title: 'Заблокувати час',
    templatesLabel: 'Шаблони',
    noTemplatesHint: 'Збережені шаблони (наприклад «Обід — 40 хв») зʼявляться тут.',
    titleLabel: 'Заголовок',
    titlePlaceholder: 'Наприклад, обід',
    startLabel: 'Початок',
    durationLabel: 'Тривалість',
    minutesUnit: 'хв',
    saveBtn: 'Заблокувати',
    savingBtn: 'Збереження…',
    errorMissing: 'Вкажіть тривалість більше 0 хв',
    errorSave: 'Не вдалось зберегти. Спробуйте ще раз.',
    dateLocale: 'uk-UA',
  },
  ru: {
    title: 'Заблокировать время',
    templatesLabel: 'Шаблоны',
    noTemplatesHint: 'Сохранённые шаблоны (например «Обед — 40 мин») появятся здесь.',
    titleLabel: 'Заголовок',
    titlePlaceholder: 'Например, обед',
    startLabel: 'Начало',
    durationLabel: 'Длительность',
    minutesUnit: 'мин',
    saveBtn: 'Заблокировать',
    savingBtn: 'Сохранение…',
    errorMissing: 'Длительность должна быть больше 0 мин',
    errorSave: 'Не удалось сохранить. Попробуйте ещё раз.',
    dateLocale: 'ru-RU',
  },
  en: {
    title: 'Block time',
    templatesLabel: 'Templates',
    noTemplatesHint: 'Saved templates (e.g. "Lunch — 40 min") will appear here.',
    titleLabel: 'Title',
    titlePlaceholder: 'e.g. Lunch',
    startLabel: 'Starts',
    durationLabel: 'Duration',
    minutesUnit: 'min',
    saveBtn: 'Block',
    savingBtn: 'Saving…',
    errorMissing: 'Duration must be greater than 0 min',
    errorSave: 'Failed to save. Please try again.',
    dateLocale: 'en-GB',
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

function fmtDateLabel(d: Date, locale: 'uk-UA' | 'ru-RU' | 'en-GB'): string {
  return d.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'long' });
}

export function BlockTimeSheet({ open, onClose, date, defaultTime, onSaved }: Props) {
  const { haptic } = useTelegram();
  const lang = useMiniAppLocale();
  const t = I18N[lang];

  const [templates, setTemplates] = useState<Template[]>([]);
  const [loadingTpl, setLoadingTpl] = useState(false);
  const [title, setTitle] = useState('');
  const [startTime, setStartTime] = useState(defaultTime ?? '12:00');
  const [durationStr, setDurationStr] = useState('30');
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  // Reset when sheet opens
  useEffect(() => {
    if (!open) return;
    setTitle('');
    setStartTime(defaultTime ?? '12:00');
    setDurationStr('30');
    setErrorText(null);
  }, [open, defaultTime]);

  // Load templates once when opens
  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoadingTpl(true);
    const initData = getInitData();
    fetch('/api/telegram/m/block-time', {
      method: 'GET',
      headers: initData ? { 'X-TG-Init-Data': initData } : undefined,
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j: { templates?: Template[] }) => {
        if (!alive) return;
        setTemplates(j.templates ?? []);
      })
      .catch(() => { if (alive) setTemplates([]); })
      .finally(() => { if (alive) setLoadingTpl(false); });
    return () => { alive = false; };
  }, [open]);

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const applyTemplate = useCallback((tpl: Template) => {
    haptic('selection');
    setTitle(tpl.title);
    setDurationStr(String(tpl.duration_minutes));
  }, [haptic]);

  const handleSave = useCallback(async () => {
    const duration = parseInt(durationStr, 10) || 0;
    if (duration <= 0) {
      setErrorText(t.errorMissing);
      haptic('error');
      return;
    }
    setSaving(true);
    setErrorText(null);
    const [sh, sm] = startTime.split(':').map(Number);
    const start = new Date(date);
    start.setHours(sh, sm, 0, 0);
    const end = new Date(start.getTime() + duration * 60 * 1000);

    const initData = getInitData();
    const res = await fetch('/api/telegram/m/block-time', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(initData ? { 'X-TG-Init-Data': initData } : {}),
      },
      body: JSON.stringify({
        initData,
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
        reason: title.trim() || null,
      }),
    });
    if (!res.ok) {
      setSaving(false);
      setErrorText(t.errorSave);
      haptic('error');
      return;
    }
    haptic('success');
    setSaving(false);
    onSaved();
    onClose();
  }, [date, durationStr, startTime, title, haptic, t.errorMissing, t.errorSave, onClose, onSaved]);

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > 120 || info.velocity.y > 400) onClose();
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: 48,
    padding: '0 14px',
    borderRadius: R.sm,
    border: `1px solid ${T.border}`,
    background: T.surface,
    color: T.text,
    fontSize: 15,
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    color: T.textSecondary,
    marginBottom: 6,
    display: 'block',
    letterSpacing: '0.02em',
    textTransform: 'uppercase',
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 80,
              background: 'rgba(10,10,12,0.55)',
              backdropFilter: 'blur(2px)',
            }}
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={handleDragEnd}
            style={{
              ...FONT_BASE,
              position: 'fixed',
              inset: 'auto 0 0 0',
              zIndex: 90,
              maxHeight: '90dvh',
              background: T.bg,
              color: T.text,
              borderRadius: `${R.lg}px ${R.lg}px 0 0`,
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 -8px 32px rgba(15,18,24,0.18)',
              paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)',
            }}
          >
            {/* drag handle */}
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 8 }}>
              <span style={{ width: 40, height: 4, borderRadius: 999, background: T.border }} />
            </div>

            {/* header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: `12px ${PAGE_PADDING_X}px 4px`,
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: R.sm,
                  background: T.accentSoft,
                  color: T.accent,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <CalendarOff size={16} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 17, fontWeight: 700, letterSpacing: '-0.01em', color: T.text }}>
                  {t.title}
                </p>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: T.textTertiary }}>
                  {fmtDateLabel(date, t.dateLocale)}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="close"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: R.pill,
                  border: `1px solid ${T.border}`,
                  background: T.surface,
                  color: T.text,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* scroll body */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: `12px ${PAGE_PADDING_X}px 0`,
              }}
            >
              {/* templates */}
              <div style={{ marginBottom: 18 }}>
                <span style={labelStyle}>{t.templatesLabel}</span>
                {loadingTpl ? (
                  <div style={{ padding: '8px 0', color: T.textTertiary, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Loader2 size={14} className="animate-spin" />
                  </div>
                ) : templates.length === 0 ? (
                  <p style={{ margin: 0, fontSize: 12, color: T.textTertiary }}>
                    {t.noTemplatesHint}
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {templates.map((tpl) => (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => applyTemplate(tpl)}
                        style={{
                          padding: '8px 14px',
                          borderRadius: R.pill,
                          border: `1px solid ${T.border}`,
                          background: T.surface,
                          color: T.text,
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <span>{tpl.title}</span>
                        <span style={{ color: T.textTertiary, fontWeight: 500 }}>
                          · {tpl.duration_minutes} {t.minutesUnit}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* title */}
              <div style={{ marginBottom: 14 }}>
                <span style={labelStyle}>{t.titleLabel}</span>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t.titlePlaceholder}
                  style={inputStyle}
                />
              </div>

              {/* time + duration */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                <div>
                  <span style={labelStyle}>{t.startLabel}</span>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    style={{ ...inputStyle, textAlign: 'center' }}
                  />
                </div>
                <div>
                  <span style={labelStyle}>{t.durationLabel}</span>
                  <div style={{ ...inputStyle, display: 'flex', alignItems: 'center', padding: 0 }}>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={durationStr}
                      onChange={(e) => setDurationStr(e.target.value)}
                      style={{
                        flex: 1,
                        border: 'none',
                        background: 'transparent',
                        color: T.text,
                        fontSize: 15,
                        fontFamily: 'inherit',
                        textAlign: 'center',
                        outline: 'none',
                        height: '100%',
                        padding: '0 0 0 14px',
                        minWidth: 0,
                        boxSizing: 'border-box',
                      }}
                    />
                    <span style={{ color: T.textTertiary, fontSize: 14, fontWeight: 500, paddingRight: 14, flexShrink: 0 }}>
                      {t.minutesUnit}
                    </span>
                  </div>
                </div>
              </div>

              {errorText && (
                <p style={{ margin: '0 0 12px', fontSize: 13, color: T.danger }}>
                  {errorText}
                </p>
              )}
            </div>

            {/* save */}
            <div style={{ padding: `8px ${PAGE_PADDING_X}px 0` }}>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: R.md,
                  border: 'none',
                  background: T.text,
                  color: T.bg,
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: saving ? 'wait' : 'pointer',
                  opacity: saving ? 0.6 : 1,
                  fontFamily: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : null}
                {saving ? t.savingBtn : t.saveBtn}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
