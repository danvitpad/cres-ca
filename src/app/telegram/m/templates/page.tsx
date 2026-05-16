/** --- YAML
 * name: MasterMiniAppTemplates
 * description: Шаблоны сообщений мастера в Mini App. Список из 7 типов
 *              (напоминания за 24/2 ч, запрос отзыва, умное возвращение, win-back,
 *              NPS, поздравление с ДР). Тап на пункт → bottom-sheet редактор с
 *              темой + текстом + чипами переменных (тап вставляет {var} в текст).
 *              Сохранённый кастомный шаблон автоматически берётся cron-задачами,
 *              приоритет над дефолтным.
 * created: 2026-05-10
 * --- */

'use client';

import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Loader2, X, Check, MessageSquare, Plus, RotateCcw,
  Bell, Clock, Star, Heart, Gauge, Cake,
  CheckCircle2, CalendarClock, XCircle,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { useTelegram } from '@/components/miniapp/telegram-provider';
import { getInitData } from '@/lib/telegram/webapp';
import { MobilePage, PageHeader } from '@/components/miniapp/shells';
import '@/styles/od-master-templates.css';
import { T, R, TYPE, SHADOW, PAGE_PADDING_X, SPRING, FONT_BASE } from '@/components/miniapp/design';

interface VariableSpec {
  key: string;   // техническое имя (напр. service_name)
  label: string; // русское имя (напр. Услуга) — то что мастер видит и в чипе, и в тексте {Услуга}
}

interface KindSpec {
  kind: string;
  title: string;
  description: string;
  icon: typeof Bell;
  defaultSubject: string;
  defaultContent: string;
  hasSubject: boolean;
  variables: VariableSpec[];
}

const SPECS: KindSpec[] = [
  {
    // ОДИН шаблон напоминания. На сервере пишется и в reminder_24h, и в reminder_2h
    // одинаковым контентом — cron берёт подходящий по времени за которое клиент
    // попросил напомнить. Текст один и тот же.
    kind: 'reminder',
    title: 'Напоминание о записи',
    description: 'Клиент сам выбирает за сколько до визита (10 мин — 24 ч)',
    icon: Bell,
    defaultSubject: '📅 Скоро запись',
    defaultContent: 'Напоминаю о записи:\n{Услуга} на {Время}\nСтоимость: {Стоимость}\nАдрес: {Адрес}',
    hasSubject: true,
    variables: [
      { key: 'service_name', label: 'Услуга' },
      { key: 'time', label: 'Время' },
      { key: 'price', label: 'Стоимость' },
      { key: 'address', label: 'Адрес' },
      { key: 'master_name', label: 'Имя мастера' },
      { key: 'client_name', label: 'Имя клиента' },
      { key: 'confirm_url', label: 'Ссылка подтверждения' },
    ],
  },
  {
    // Уходит клиенту в момент создания записи. Текст хранится в
    // message_templates(kind='booking_confirmation'); подставляется триггером
    // dispatch_booking_notification. Если пусто — fallback «Запись подтверждена».
    kind: 'booking_confirmation',
    title: 'Подтверждение записи',
    description: 'Уходит клиенту в момент бронирования',
    icon: CheckCircle2,
    defaultSubject: '✅ Запись подтверждена',
    defaultContent: 'Вы записаны к {Имя мастера} на {Время}.\nУслуга: {Услуга}\nСтоимость: {Стоимость}\nАдрес: {Адрес}',
    hasSubject: true,
    variables: [
      { key: 'service_name', label: 'Услуга' },
      { key: 'time', label: 'Время' },
      { key: 'master_name', label: 'Имя мастера' },
      { key: 'client_name', label: 'Имя клиента' },
      { key: 'price', label: 'Стоимость' },
      { key: 'address', label: 'Адрес' },
      { key: 'confirm_url', label: 'Ссылка подтверждения' },
    ],
  },
  {
    // Уходит клиенту когда мастер двигает время записи. {Старое время} —
    // время до переноса, {Время} — новое.
    kind: 'appointment_rescheduled',
    title: 'Перенос записи',
    description: 'Уходит клиенту когда меняется время визита',
    icon: CalendarClock,
    defaultSubject: '🔄 Запись перенесена',
    defaultContent: 'Запись к {Имя мастера} с {Старое время} перенесена на {Время}.\nУслуга: {Услуга}',
    hasSubject: true,
    variables: [
      { key: 'service_name', label: 'Услуга' },
      { key: 'time', label: 'Время' },
      { key: 'old_time', label: 'Старое время' },
      { key: 'master_name', label: 'Имя мастера' },
      { key: 'client_name', label: 'Имя клиента' },
      { key: 'address', label: 'Адрес' },
    ],
  },
  {
    // Уходит клиенту когда запись отменяется (любая сторона).
    kind: 'appointment_cancelled',
    title: 'Отмена записи',
    description: 'Уходит клиенту когда запись отменяется',
    icon: XCircle,
    defaultSubject: '❌ Запись отменена',
    defaultContent: 'Запись к {Имя мастера} на {Время} отменена.',
    hasSubject: true,
    variables: [
      { key: 'service_name', label: 'Услуга' },
      { key: 'time', label: 'Время' },
      { key: 'master_name', label: 'Имя мастера' },
      { key: 'client_name', label: 'Имя клиента' },
    ],
  },
  {
    kind: 'review_request',
    title: 'Запрос отзыва',
    description: 'Уходит клиенту через 2 часа после визита',
    icon: Star,
    defaultSubject: '⭐ Оцените визит',
    defaultContent: 'Как прошёл визит?\nУслуга: {Услуга}\nМастер: {Имя мастера}\n\nОцените, пожалуйста — это помогает другим клиентам.',
    hasSubject: true,
    variables: [
      { key: 'service_name', label: 'Услуга' },
      { key: 'master_name', label: 'Имя мастера' },
      { key: 'client_name', label: 'Имя клиента' },
    ],
  },
  {
    kind: 'cadence',
    title: 'Умное возвращение',
    description: 'Когда клиент перестал приходить по своей привычке',
    icon: CalendarClock,
    defaultSubject: '⏰ Пора записаться?',
    defaultContent: 'Обычно интервал между визитами ~{Средний интервал} дней.\nПрошло уже {Дней без визита} — пора записаться?',
    hasSubject: true,
    variables: [
      { key: 'avg', label: 'Средний интервал' },
      { key: 'days', label: 'Дней без визита' },
      { key: 'day_name', label: 'День недели' },
      { key: 'usual_time', label: 'Обычное время' },
      { key: 'client_name', label: 'Имя клиента' },
    ],
  },
  {
    kind: 'win_back',
    title: 'Возврат «спящих»',
    description: 'Клиент не был 60+ дней',
    icon: Heart,
    defaultSubject: '💜 Давно не виделись',
    defaultContent: 'Давно не виделись 🙂\nЕсть свободные слоты на этой неделе — записаться можно прямо в боте.',
    hasSubject: true,
    variables: [
      { key: 'client_name', label: 'Имя клиента' },
      { key: 'master_name', label: 'Имя мастера' },
    ],
  },
  {
    kind: 'nps',
    title: 'NPS опрос',
    description: 'После 3 / 10 / 20 / 50 визитов',
    icon: Gauge,
    defaultSubject: '📊 Короткий опрос',
    defaultContent: 'Уже {Всего визитов}-й визит — спасибо за доверие!\nОцените от 0 до 10, насколько порекомендовали бы нас друзьям.',
    hasSubject: true,
    variables: [
      { key: 'total', label: 'Всего визитов' },
      { key: 'client_name', label: 'Имя клиента' },
    ],
  },
  {
    kind: 'birthday',
    title: 'Поздравление с ДР',
    description: 'Уходит клиенту в день его рождения',
    icon: Cake,
    defaultSubject: '',
    defaultContent: '{Имя клиента}, с днём рождения! 🎂\n{Скидка}',
    hasSubject: false,
    variables: [
      { key: 'client_name', label: 'Имя клиента' },
      { key: 'discount_text', label: 'Скидка' },
    ],
  },
];

/** Двусторонний конвертер. UI оперирует {Имя клиента}; cron-задачи и БД работают
 *  с {client_name}. При сохранении переводим UI → key, при загрузке key → UI.
 *  Один глобальный список (объединение всех specs) — все label'ы уникальны. */
const ALL_VARS: VariableSpec[] = (() => {
  const map = new Map<string, string>();
  for (const s of SPECS) for (const v of s.variables) map.set(v.key, v.label);
  return Array.from(map.entries()).map(([key, label]) => ({ key, label }));
})();

function toStorageFormat(text: string): string {
  let out = text;
  for (const v of ALL_VARS) out = out.replaceAll(`{${v.label}}`, `{${v.key}}`);
  return out;
}

function toDisplayFormat(text: string): string {
  let out = text;
  for (const v of ALL_VARS) out = out.replaceAll(`{${v.key}}`, `{${v.label}}`);
  return out;
}

interface SavedTemplate {
  subject: string | null;
  content: string;
}

export default function MasterMiniAppTemplates() {
  const { userId } = useAuthStore();
  const { haptic } = useTelegram();
  const router = useRouter();
  const [saved, setSaved] = useState<Record<string, SavedTemplate>>({});
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [editing, setEditing] = useState<KindSpec | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const initData = getInitData();
      if (!initData) { setLoading(false); return; }
      const res = await fetch('/api/telegram/m/templates-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData }),
      });
      if (cancelled) return;
      if (!res.ok) { setLoading(false); return; }
      const json = await res.json() as { templates: Record<string, SavedTemplate> };
      if (cancelled) return;
      setSaved(json.templates ?? {});
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [userId, refreshKey]);

  return (
    <MobilePage className="od-master-templates">
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
      <PageHeader title="Шаблоны" subtitle="Тексты автоматических сообщений клиентам" />

      {/* Литерально .ip-tpl-list / .ip-tpl-item / .ip-tpl-icon /
          .tpl-icon-{green|blue|red|amber|neutral} / .ip-tpl-body /
          .ip-tpl-name / .ip-tpl-sub из OD master-templates.html. */}
      <div className="ip-tpl-list">
        {loading ? (
          [0, 1, 2, 3].map((i) => (
            <div key={i} style={{ height: 70, borderRadius: 8, background: 'var(--m-surface-elevated)', marginBottom: 8 }} />
          ))
        ) : (
          SPECS.map((spec) => {
            const Icon = spec.icon;
            // Раскраска иконки по типу шаблона (OD palette):
            const iconClass =
              spec.kind === 'reminder' || spec.kind === 'booking_confirmation' ? 'tpl-icon-blue' :
              spec.kind === 'review_request' || spec.kind === 'birthday' ? 'tpl-icon-amber' :
              spec.kind === 'win_back' || spec.kind === 'cadence' ? 'tpl-icon-green' :
              spec.kind === 'appointment_cancelled' ? 'tpl-icon-red' :
              'tpl-icon-neutral';
            return (
              <button
                type="button"
                key={spec.kind}
                className="ip-tpl-item"
                onClick={() => { haptic('light'); setEditing(spec); }}
              >
                <div className={`ip-tpl-icon ${iconClass}`}>
                  <Icon size={16} strokeWidth={2} />
                </div>
                <div className="ip-tpl-body">
                  <p className="ip-tpl-name">{spec.title}</p>
                  <p className="ip-tpl-sub">{spec.description}</p>
                </div>
              </button>
            );
          })
        )}
      </div>

      <AnimatePresence>
        {editing && (
          <TemplateSheet
            spec={editing}
            saved={saved[editing.kind] ?? null}
            onClose={() => setEditing(null)}
            onSaved={() => { setEditing(null); setRefreshKey((k) => k + 1); }}
          />
        )}
      </AnimatePresence>
    </MobilePage>
  );
}

function TemplateSheet({ spec, saved, onClose, onSaved }: {
  spec: KindSpec;
  saved: SavedTemplate | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { haptic } = useTelegram();
  // saved хранится в storage-формате (с key'ами), default уже в display-формате (с label'ами)
  const [subject, setSubject] = useState(saved?.subject ? toDisplayFormat(saved.subject) : spec.defaultSubject);
  const [content, setContent] = useState(saved?.content ? toDisplayFormat(saved.content) : spec.defaultContent);
  const [activeField, setActiveField] = useState<'subject' | 'content'>('content');
  const [busy, setBusy] = useState(false);
  const [resetting, setResetting] = useState(false);
  const subjectRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const hasCustom = !!saved?.content;

  function insertVariable(label: string) {
    // Вставляем русский label — мастер видит {Имя клиента}, не {client_name}.
    // На сервер уйдёт уже сконвертированный текст.
    const insert = `{${label}}`;
    haptic('selection');
    if (activeField === 'subject' && spec.hasSubject) {
      const el = subjectRef.current;
      if (!el) { setSubject((s) => s + insert); return; }
      const start = el.selectionStart ?? subject.length;
      const end = el.selectionEnd ?? subject.length;
      const next = subject.slice(0, start) + insert + subject.slice(end);
      setSubject(next);
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(start + insert.length, start + insert.length);
      });
    } else {
      const el = contentRef.current;
      if (!el) { setContent((s) => s + insert); return; }
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const next = content.slice(0, start) + insert + content.slice(end);
      setContent(next);
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(start + insert.length, start + insert.length);
      });
    }
  }

  async function callMutate(payload: Record<string, unknown>) {
    const initData = getInitData();
    const res = await fetch('/api/telegram/m/template-mutate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(initData ? { 'X-TG-Init-Data': initData } : {}),
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.error || 'failed');
    }
    return res.json();
  }

  async function save() {
    if (busy) return;
    if (!content.trim()) { haptic('error'); return; }
    setBusy(true);
    try {
      // Перед отправкой переводим UI-текст ({Имя клиента}) в storage-формат
      // ({client_name}) — cron-задачи и trigger DB подставляют именно key'и.
      await callMutate({
        action: 'save',
        kind: spec.kind,
        subject: spec.hasSubject ? toStorageFormat(subject) : null,
        content: toStorageFormat(content),
      });
      haptic('success');
      onSaved();
    } catch {
      haptic('error');
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    if (resetting) return;
    setResetting(true);
    try {
      await callMutate({ action: 'reset', kind: spec.kind });
      haptic('success');
      onSaved();
    } catch {
      haptic('error');
    } finally {
      setResetting(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={() => !busy && !resetting && onClose()}
      style={{
        position: 'fixed', inset: 0, zIndex: 80,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
      }}
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={SPRING.default}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 480,
          borderRadius: `${R.lg}px ${R.lg}px 0 0`,
          background: T.surface,
          padding: 0,
          paddingBottom: 'calc(96px + env(safe-area-inset-bottom, 0px))',
          boxShadow: SHADOW.elevated,
          maxHeight: 'calc(var(--tg-viewport-height, 100dvh) - max(var(--tg-content-top, 0px), 80px))', overflowY: 'auto',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: `18px ${PAGE_PADDING_X}px 14px`,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ ...TYPE.h3, color: T.text, margin: 0 }}>{spec.title}</h3>
            <p style={{ ...TYPE.caption, color: T.textTertiary, margin: '2px 0 0' }}>{spec.description}</p>
          </div>
          <button
            type="button" onClick={() => !busy && !resetting && onClose()}
            aria-label="Закрыть"
            style={{
              width: 32, height: 32, borderRadius: '50%',
              border: 'none', background: T.bgSubtle, color: T.textSecondary,
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            }}
          >
            <X size={14} />
          </button>
        </div>

        <div style={{ height: 1, background: T.borderSubtle }} />

        {/* Subject (если есть) — необязательное поле */}
        {spec.hasSubject && (
          <>
            <div style={{ padding: `12px ${PAGE_PADDING_X}px 14px` }}>
              <p style={labelStyle}>Тема <span style={{ color: T.textTertiary, fontWeight: 400 }}>· необов&apos;язково</span></p>
              <input
                ref={subjectRef}
                value={subject}
                onChange={(e) => setSubject(e.target.value.slice(0, 200))}
                onFocus={() => setActiveField('subject')}
                placeholder={spec.defaultSubject}
                style={inputStyle}
              />
            </div>
            <div style={{ height: 1, background: T.borderSubtle }} />
          </>
        )}

        {/* Content */}
        <div style={{ padding: `12px ${PAGE_PADDING_X}px 14px` }}>
          <p style={labelStyle}>{spec.hasSubject ? 'Текст' : 'Сообщение'}</p>
          <textarea
            ref={contentRef}
            value={content}
            onChange={(e) => setContent(e.target.value.slice(0, 2000))}
            onFocus={() => setActiveField('content')}
            placeholder={spec.defaultContent}
            rows={6}
            style={{ ...inputStyle, resize: 'none' as const, minHeight: 120 }}
          />
        </div>

        <div style={{ height: 1, background: T.borderSubtle }} />

        {/* Variable chips */}
        <div style={{ padding: `12px ${PAGE_PADDING_X}px 4px` }}>
          <p style={{
            ...TYPE.micro, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.06em', color: T.textTertiary,
            margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <MessageSquare size={11} /> Вставить переменную
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {spec.variables.map((v) => (
              <button
                key={v.key}
                type="button"
                onClick={() => insertVariable(v.label)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '6px 12px', borderRadius: R.pill,
                  border: `1px solid ${T.borderSubtle}`,
                  background: T.bgSubtle,
                  color: T.text,
                  fontSize: 13, fontWeight: 500,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                <Plus size={11} strokeWidth={2.4} color={T.accent} />
                {v.label}
              </button>
            ))}
          </div>
        </div>

        <p style={{
          ...TYPE.micro, color: T.textTertiary,
          padding: `8px ${PAGE_PADDING_X}px 0`, margin: 0, lineHeight: 1.5,
        }}>
          Тап на чип — вставит {'{переменную}'} в активное поле. При отправке клиенту переменные заменятся реальными значениями.
        </p>

        <div style={{ padding: `16px ${PAGE_PADDING_X}px 0`, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            type="button"
            onClick={save}
            disabled={busy}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              width: '100%', padding: '15px 16px', borderRadius: R.lg, border: 'none',
              background: T.accent, color: '#fff',
              ...TYPE.bodyStrong, fontWeight: 700, cursor: busy ? 'wait' : 'pointer',
              fontFamily: 'inherit', opacity: busy ? 0.6 : 1,
            }}
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            {busy ? 'Сохраняем…' : 'Сохранить'}
          </button>

          {hasCustom && (
            <button
              type="button"
              onClick={reset}
              disabled={resetting}
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '12px 16px', borderRadius: R.pill,
                border: `1px solid ${T.border}`,
                background: T.surface, color: T.textSecondary,
                ...TYPE.bodyStrong, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                marginTop: 4,
              }}
            >
              {resetting ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
              Сбросить к стандартному
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: T.textTertiary,
  margin: 0,
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: T.bgSubtle,
  border: `1px solid ${T.borderSubtle}`,
  borderRadius: 12,
  outline: 'none',
  fontSize: 16,
  fontWeight: 500,
  lineHeight: 1.4,
  color: T.text,
  fontFamily: 'inherit',
  padding: '12px 14px',
};
