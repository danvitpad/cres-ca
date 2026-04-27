/** --- YAML
 * name: TemplateEditorDialog
 * description: Master edits subject + body for a single automation rule (gmail-style). Loads
 *              the active row from message_templates by (master_id, kind), shows two fields
 *              (subject + body) with shared variable chips, side-by-side preview, plus
 *              «Тестовая отправка себе». TG dispatch renders subject as bold first line;
 *              email dispatch uses subject as the real Subject header.
 * created: 2026-04-25
 * updated: 2026-04-25
 * --- */

'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { X, Send, Save, RotateCcw, Mail } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { humanizeError } from '@/lib/format/error';

export interface AutomationKindSpec {
  kind: string;
  title: string;
  description: string;
  defaultSubject: string;
  defaultContent: string;
  variables: { key: string; label: string }[];
}

/* Дефолтные шаблоны — без приветствий типа «Привет», нейтрально для «ты» и «Вы».
   Структурированный формат: услуга на время / стоимость / адрес. Мастер может
   переопределить любой шаблон в диалоге. */
export const AUTOMATION_KIND_SPECS: Record<string, AutomationKindSpec> = {
  reminder_24h: {
    kind: 'reminder_24h',
    title: 'Напоминание за 24 часа',
    description: 'Уходит клиенту за день до визита',
    defaultSubject: '📅 Запись на завтра',
    defaultContent: 'Напоминаю о записи на завтра:\n{service_name} на {time}\nСтоимость: {price}\nАдрес: {address}',
    variables: [
      { key: 'service_name', label: 'Услуга' },
      { key: 'time', label: 'Время визита' },
      { key: 'price', label: 'Стоимость (с валютой)' },
      { key: 'address', label: 'Адрес мастера' },
      { key: 'master_name', label: 'Имя мастера' },
      { key: 'client_name', label: 'Имя клиента' },
      { key: 'confirm_url', label: 'Ссылка подтверждения' },
    ],
  },
  reminder_2h: {
    kind: 'reminder_2h',
    title: 'Напоминание за 2 часа',
    description: 'Уходит клиенту за 2 часа до визита',
    defaultSubject: '⏰ Через 2 часа — запись',
    defaultContent: 'Напоминаю — через 2 часа запись:\n{service_name} на {time}\nСтоимость: {price}\nАдрес: {address}',
    variables: [
      { key: 'service_name', label: 'Услуга' },
      { key: 'time', label: 'Время визита' },
      { key: 'price', label: 'Стоимость (с валютой)' },
      { key: 'address', label: 'Адрес мастера' },
      { key: 'master_name', label: 'Имя мастера' },
      { key: 'client_name', label: 'Имя клиента' },
    ],
  },
  review_request: {
    kind: 'review_request',
    title: 'Запрос отзыва',
    description: 'Уходит клиенту через 2 часа после визита',
    defaultSubject: '⭐ Оцените визит',
    defaultContent: 'Как прошёл визит?\nУслуга: {service_name}\nМастер: {master_name}\n\nОцените, пожалуйста — это помогает другим клиентам найти хорошего специалиста.',
    variables: [
      { key: 'service_name', label: 'Услуга' },
      { key: 'master_name', label: 'Имя мастера' },
      { key: 'client_name', label: 'Имя клиента' },
    ],
  },
  cadence: {
    kind: 'cadence',
    title: 'Умное возвращение',
    description: 'Уходит клиенту, который перестал приходить по своей привычке',
    defaultSubject: '⏰ Пора записаться?',
    defaultContent: 'Обычно интервал между визитами ~{avg} дней.\nПрошло уже {days} — пора записаться?',
    variables: [
      { key: 'avg', label: 'Средний интервал (дней)' },
      { key: 'days', label: 'Дней с последнего визита' },
      { key: 'day_name', label: 'День недели (smart)' },
      { key: 'usual_time', label: 'Обычное время (smart)' },
      { key: 'client_name', label: 'Имя клиента' },
    ],
  },
  win_back: {
    kind: 'win_back',
    title: 'Возврат «спящих»',
    description: 'Уходит клиенту, который не был 60+ дней',
    defaultSubject: '💜 Давно не виделись',
    defaultContent: 'Давно не виделись 🙂\nЕсть свободные слоты на этой неделе — записаться можно прямо в боте.',
    variables: [
      { key: 'client_name', label: 'Имя клиента' },
      { key: 'master_name', label: 'Имя мастера' },
    ],
  },
  nps: {
    kind: 'nps',
    title: 'NPS опрос',
    description: 'Уходит клиенту после 3 / 10 / 20 / 50 визитов',
    defaultSubject: '📊 Короткий опрос',
    defaultContent: 'Уже {total}-й визит — спасибо за доверие!\nОцените от 0 до 10, насколько порекомендовали бы нас друзьям.',
    variables: [
      { key: 'total', label: 'Всего визитов' },
      { key: 'client_name', label: 'Имя клиента' },
    ],
  },
};

interface MessageTemplateRow {
  id: string;
  subject: string | null;
  content: string;
}

export function TemplateEditorDialog({
  open,
  onOpenChange,
  spec,
  masterId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spec: AutomationKindSpec;
  masterId: string;
}) {
  const [subject, setSubject] = useState(spec.defaultSubject);
  const [content, setContent] = useState(spec.defaultContent);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [tplId, setTplId] = useState<string | null>(null);
  const [activeField, setActiveField] = useState<'subject' | 'content'>('content');
  const subjectRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true); // eslint-disable-line react-hooks/set-state-in-effect
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('message_templates')
        .select('id, subject, content')
        .eq('master_id', masterId)
        .eq('kind', spec.kind)
        .eq('is_active', true)
        .maybeSingle();
      if (cancelled) return;
      if (data) {
        const row = data as MessageTemplateRow;
        setSubject(row.subject ?? spec.defaultSubject);
        setContent(row.content);
        setTplId(row.id);
      } else {
        setSubject(spec.defaultSubject);
        setContent(spec.defaultContent);
        setTplId(null);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, masterId, spec.kind, spec.defaultSubject, spec.defaultContent]);

  function insertVariable(key: string) {
    const insert = `{${key}}`;
    if (activeField === 'subject') {
      const el = subjectRef.current;
      if (!el) {
        setSubject((s) => s + insert);
        return;
      }
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
      if (!el) {
        setContent((s) => s + insert);
        return;
      }
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

  async function save() {
    if (!subject.trim() || !content.trim()) {
      toast.error('Тема и текст не должны быть пустыми');
      return;
    }
    setSaving(true);
    const supabase = createClient();
    if (tplId) {
      const { error } = await supabase
        .from('message_templates')
        .update({ subject, content })
        .eq('id', tplId);
      setSaving(false);
      if (error) { toast.error(humanizeError(error)); return; }
      toast.success('Сохранено');
    } else {
      const { data, error } = await supabase
        .from('message_templates')
        .insert({
          master_id: masterId,
          kind: spec.kind,
          name: spec.title,
          subject,
          content,
          is_active: true,
        })
        .select('id')
        .single();
      setSaving(false);
      if (error) { toast.error(humanizeError(error)); return; }
      if (data) setTplId((data as { id: string }).id);
      toast.success('Сохранено');
    }
    onOpenChange(false);
  }

  function resetToDefault() {
    setSubject(spec.defaultSubject);
    setContent(spec.defaultContent);
  }

  async function testSend() {
    setTesting(true);
    const res = await fetch('/api/messaging/test-send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: spec.kind, subject, content }),
    });
    setTesting(false);
    const data = await res.json().catch(() => ({} as Record<string, unknown>));
    if (!res.ok) {
      toast.error((data as { error?: string }).error || 'Не удалось отправить');
      return;
    }
    toast.success('Отправил тест себе в Telegram');
  }

  if (!open) return null;

  function renderPreview(tpl: string) {
    return tpl
      .replace(/\{client_name\}/g, 'Анна')
      .replace(/\{master_name\}/g, 'Даниил')
      .replace(/\{service_name\}/g, 'Маникюр')
      .replace(/\{time\}/g, '15:30')
      .replace(/\{date\}/g, 'завтра')
      .replace(/\{confirm_url\}/g, 'cres-ca.com/c/sample')
      .replace(/\{avg\}/g, '21')
      .replace(/\{days\}/g, '28')
      .replace(/\{day_name\}/g, 'четверг')
      .replace(/\{usual_time\}/g, '15:00')
      .replace(/\{total\}/g, '10');
  }

  const subjectPreview = renderPreview(subject);
  const bodyPreview = renderPreview(content);

  return (
    <div
      onClick={() => !saving && !testing && onOpenChange(false)}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[88vh] overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-xl"
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2">
              <Mail className="size-4 text-muted-foreground" />
              <h3 className="text-base font-semibold">{spec.title}</h3>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">{spec.description}</p>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="p-1 rounded-md text-muted-foreground hover:bg-muted/60"
            aria-label="Закрыть"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Subject */}
        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Тема
        </label>
        <input
          ref={subjectRef}
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          onFocus={() => setActiveField('subject')}
          disabled={loading}
          placeholder="Тема (для email — это Subject; в TG — жирная первая строка)"
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium outline-none focus:border-primary"
        />

        {/* Body */}
        <label className="mt-3 mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Текст сообщения
        </label>
        <textarea
          ref={contentRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onFocus={() => setActiveField('content')}
          rows={5}
          disabled={loading}
          placeholder="Введи текст или нажми на переменную ниже"
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        />

        {/* Variables */}
        <div className="mt-3">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Переменные (клик — вставить в активное поле: {activeField === 'subject' ? 'тема' : 'текст'})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {spec.variables.map((v) => (
              <button
                key={v.key}
                type="button"
                onClick={() => insertVariable(v.key)}
                title={v.label}
                className="rounded-md border border-border bg-muted/60 px-2 py-0.5 text-[11px] font-mono text-foreground hover:bg-primary/15 hover:border-primary/40"
              >
                {`{${v.key}}`}
              </button>
            ))}
          </div>
        </div>

        {/* Preview — gmail-style stack */}
        <div className="mt-4 rounded-lg border border-dashed border-border bg-muted/30 p-3">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Предпросмотр
          </p>
          <p className="text-[13px] font-semibold text-foreground">{subjectPreview}</p>
          <p className="mt-1 text-[13px] text-foreground whitespace-pre-wrap">{bodyPreview}</p>
        </div>

        <div className="mt-5 flex flex-wrap gap-2 justify-between">
          <button
            onClick={resetToDefault}
            disabled={saving || testing}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60"
            title="Вернуть стандартный текст"
          >
            <RotateCcw className="size-3" />
            Сбросить
          </button>
          <div className="flex gap-2">
            <button
              onClick={testSend}
              disabled={saving || testing || !content.trim() || !subject.trim()}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted/60 disabled:opacity-50"
            >
              <Send className="size-3" />
              {testing ? 'Шлю…' : 'Тест себе'}
            </button>
            <button
              onClick={save}
              disabled={saving || testing || !content.trim() || !subject.trim()}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Save className="size-3" />
              {saving ? 'Сохраняю…' : 'Сохранить'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
