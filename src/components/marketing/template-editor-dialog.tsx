/** --- YAML
 * name: TemplateEditorDialog
 * description: Master edits the message body for a single automation rule. Loads the active
 *              row from message_templates by (master_id, kind), shows a textarea + clickable
 *              variable chips that insert at the cursor, and a «Тестовая отправка себе»
 *              button that POSTs to /api/messaging/test-send with the draft content.
 * created: 2026-04-25
 * --- */

'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { X, Send, Save, RotateCcw } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export interface AutomationKindSpec {
  kind: string;
  title: string;
  description: string;
  defaultContent: string;
  variables: { key: string; label: string }[];
}

export const AUTOMATION_KIND_SPECS: Record<string, AutomationKindSpec> = {
  reminder_24h: {
    kind: 'reminder_24h',
    title: 'Напоминание за 24 часа',
    description: 'Уходит клиенту за день до визита',
    defaultContent: '📅 {client_name}, завтра в {time} у вас {service_name}. Подтвердите приход: {confirm_url} — {master_name}',
    variables: [
      { key: 'client_name', label: 'Имя клиента' },
      { key: 'time', label: 'Время визита' },
      { key: 'service_name', label: 'Услуга' },
      { key: 'master_name', label: 'Имя мастера' },
      { key: 'confirm_url', label: 'Ссылка подтверждения' },
    ],
  },
  reminder_2h: {
    kind: 'reminder_2h',
    title: 'Напоминание за 2 часа',
    description: 'Уходит клиенту за 2 часа до визита',
    defaultContent: '⏰ {client_name}, через 2 часа в {time} — {service_name}. Не опаздывайте!',
    variables: [
      { key: 'client_name', label: 'Имя клиента' },
      { key: 'time', label: 'Время визита' },
      { key: 'service_name', label: 'Услуга' },
      { key: 'master_name', label: 'Имя мастера' },
    ],
  },
  review_request: {
    kind: 'review_request',
    title: 'Запрос отзыва',
    description: 'Уходит клиенту через 2 часа после визита',
    defaultContent: '⭐ Как прошёл визит к {master_name} ({service_name})? Поставьте оценку — это помогает другим клиентам найти хорошего специалиста.',
    variables: [
      { key: 'client_name', label: 'Имя клиента' },
      { key: 'master_name', label: 'Имя мастера' },
      { key: 'service_name', label: 'Услуга' },
    ],
  },
  cadence: {
    kind: 'cadence',
    title: 'Smart rebooking',
    description: 'Уходит клиенту, который перестал приходить по своей привычке',
    defaultContent: '{client_name}, обычно ты приходишь раз в ~{avg} дней. Прошло уже {days} — пора записаться?',
    variables: [
      { key: 'client_name', label: 'Имя клиента' },
      { key: 'avg', label: 'Средний интервал (дней)' },
      { key: 'days', label: 'Дней с последнего визита' },
      { key: 'day_name', label: 'День недели (smart)' },
      { key: 'usual_time', label: 'Обычное время (smart)' },
    ],
  },
  win_back: {
    kind: 'win_back',
    title: 'Win-back',
    description: 'Уходит клиенту, который не был 60+ дней',
    defaultContent: '{client_name}, давно тебя не было 🙂 Хочешь вернуться? Есть свободные слоты на этой неделе.',
    variables: [
      { key: 'client_name', label: 'Имя клиента' },
      { key: 'master_name', label: 'Имя мастера' },
    ],
  },
  nps: {
    kind: 'nps',
    title: 'NPS опрос',
    description: 'Уходит клиенту после 3 / 10 / 20 / 50 визитов',
    defaultContent: '{client_name}, вы были у нас уже {total} раз. Оцените от 0 до 10 — насколько вы рекомендовали бы нас друзьям?',
    variables: [
      { key: 'client_name', label: 'Имя клиента' },
      { key: 'total', label: 'Всего визитов' },
    ],
  },
};

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
  const [content, setContent] = useState(spec.defaultContent);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [tplId, setTplId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true); // eslint-disable-line react-hooks/set-state-in-effect
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('message_templates')
        .select('id, content')
        .eq('master_id', masterId)
        .eq('kind', spec.kind)
        .eq('is_active', true)
        .maybeSingle();
      if (cancelled) return;
      if (data) {
        setContent((data as { content: string }).content);
        setTplId((data as { id: string }).id);
      } else {
        setContent(spec.defaultContent);
        setTplId(null);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, masterId, spec.kind, spec.defaultContent]);

  function insertVariable(key: string) {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const insert = `{${key}}`;
    const next = content.slice(0, start) + insert + content.slice(end);
    setContent(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + insert.length, start + insert.length);
    });
  }

  async function save() {
    if (!content.trim()) {
      toast.error('Шаблон пустой');
      return;
    }
    setSaving(true);
    const supabase = createClient();
    if (tplId) {
      const { error } = await supabase
        .from('message_templates')
        .update({ content })
        .eq('id', tplId);
      setSaving(false);
      if (error) { toast.error(error.message); return; }
      toast.success('Сохранено');
    } else {
      const { data, error } = await supabase
        .from('message_templates')
        .insert({ master_id: masterId, kind: spec.kind, content, is_active: true })
        .select('id')
        .single();
      setSaving(false);
      if (error) { toast.error(error.message); return; }
      if (data) setTplId((data as { id: string }).id);
      toast.success('Сохранено');
    }
    onOpenChange(false);
  }

  async function resetToDefault() {
    setContent(spec.defaultContent);
  }

  async function testSend() {
    setTesting(true);
    const res = await fetch('/api/messaging/test-send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: spec.kind, content }),
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

  const preview = content
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

  return (
    <div
      onClick={() => !saving && !testing && onOpenChange(false)}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-xl"
      >
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-base font-semibold">{spec.title}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">{spec.description}</p>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="p-1 rounded-md text-muted-foreground hover:bg-muted/60"
          >
            <X className="size-4" />
          </button>
        </div>

        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Текст сообщения
        </label>
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={5}
          disabled={loading}
          placeholder="Введи текст или нажми на переменную ниже"
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        />

        <div className="mt-3">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Переменные (клик — вставить)
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

        <div className="mt-4 rounded-lg border border-dashed border-border bg-muted/30 p-3">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Предпросмотр
          </p>
          <p className="text-[13px] text-foreground whitespace-pre-wrap">{preview}</p>
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
              disabled={saving || testing || !content.trim()}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted/60 disabled:opacity-50"
            >
              <Send className="size-3" />
              {testing ? 'Шлю…' : 'Тест себе'}
            </button>
            <button
              onClick={save}
              disabled={saving || testing || !content.trim()}
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
