/** --- YAML
 * name: Message Templates
 * description: Мастер управляет шаблонами сообщений для автонапоминаний и follow-up (reminder_24h, reminder_2h, thanks, win_back, review_request, cadence, nps, custom). Переменные: {client_name}, {service_name}, {time}, {date}, {master_name}.
 * created: 2026-04-13
 * updated: 2026-04-13
 * --- */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2, Save } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Kind =
  | 'reminder_24h'
  | 'reminder_2h'
  | 'thanks'
  | 'win_back'
  | 'review_request'
  | 'cadence'
  | 'nps'
  | 'custom';

const KIND_LABELS: Record<Kind, string> = {
  reminder_24h: 'Напоминание за 24ч',
  reminder_2h: 'Напоминание за 2ч',
  thanks: 'Спасибо после визита',
  win_back: 'Win-back (давно не был)',
  review_request: 'Запрос отзыва',
  cadence: 'Пора записаться',
  nps: 'NPS опрос',
  custom: 'Другое',
};

const DEFAULTS: Record<Kind, string> = {
  reminder_24h: '{client_name}, завтра в {time} у вас запись на {service_name}. Жду вас! — {master_name}',
  reminder_2h: '{client_name}, через 2 часа ({time}) у вас {service_name}. До встречи!',
  thanks: 'Спасибо, что пришли, {client_name}! Надеюсь, всё понравилось ❤️',
  win_back: '{client_name}, вы давно не были. Хотите записаться? Есть свободные слоты на этой неделе.',
  review_request: '{client_name}, оставьте отзыв о визите — мне важно ваше мнение.',
  cadence: '{client_name}, прошло {days} дней с последнего визита. Пора обновить образ?',
  nps: '{client_name}, оцените визит от 0 до 10. Что можно улучшить?',
  custom: '',
};

interface Template {
  id: string;
  kind: Kind;
  name: string;
  content: string;
  is_active: boolean;
}

export default function MessageTemplatesPage() {
  const supabase = createClient();
  const { master } = useMaster();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingKind, setCreatingKind] = useState<Kind | null>(null);

  const load = useCallback(async () => {
    if (!master?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from('message_templates')
      .select('id, kind, name, content, is_active')
      .eq('master_id', master.id)
      .order('kind', { ascending: true })
      .order('created_at', { ascending: true });
    setTemplates((data as Template[]) ?? []);
    setLoading(false);
  }, [supabase, master?.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function createTemplate(kind: Kind) {
    if (!master?.id) return;
    const { data, error } = await supabase
      .from('message_templates')
      .insert({
        master_id: master.id,
        kind,
        name: `${KIND_LABELS[kind]} #${templates.filter((t) => t.kind === kind).length + 1}`,
        content: DEFAULTS[kind],
      })
      .select()
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    setTemplates((prev) => [...prev, data as Template]);
    setCreatingKind(null);
  }

  async function saveTemplate(id: string, patch: Partial<Template>) {
    const { error } = await supabase.from('message_templates').update(patch).eq('id', id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setTemplates((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    toast.success('Сохранено');
  }

  async function deleteTemplate(id: string) {
    if (!confirm('Удалить шаблон?')) return;
    const { error } = await supabase.from('message_templates').delete().eq('id', id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  }

  const kinds = Object.keys(KIND_LABELS) as Kind[];

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Шаблоны сообщений</h1>
        <p className="text-sm text-muted-foreground">
          Переменные: <code className="rounded bg-muted px-1">{'{client_name}'}</code>,{' '}
          <code className="rounded bg-muted px-1">{'{service_name}'}</code>,{' '}
          <code className="rounded bg-muted px-1">{'{time}'}</code>,{' '}
          <code className="rounded bg-muted px-1">{'{date}'}</code>,{' '}
          <code className="rounded bg-muted px-1">{'{master_name}'}</code>,{' '}
          <code className="rounded bg-muted px-1">{'{days}'}</code>
        </p>
      </div>

      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-2">
          <Label>Добавить шаблон</Label>
          <Select value={creatingKind ?? ''} onValueChange={(v) => setCreatingKind(v as Kind)}>
            <SelectTrigger>
              <SelectValue placeholder="Выбери тип…" />
            </SelectTrigger>
            <SelectContent>
              {kinds.map((k) => (
                <SelectItem key={k} value={k}>
                  {KIND_LABELS[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button disabled={!creatingKind} onClick={() => creatingKind && createTemplate(creatingKind)}>
          <Plus className="mr-1 size-4" /> Создать
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Загрузка…</p>
      ) : templates.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Нет шаблонов — создай первый из выпадающего списка выше.
        </p>
      ) : (
        <div className="space-y-4">
          {kinds.map((kind) => {
            const group = templates.filter((t) => t.kind === kind);
            if (group.length === 0) return null;
            return (
              <div key={kind} className="rounded-xl border bg-card">
                <div className="border-b px-4 py-2 text-sm font-medium text-muted-foreground">
                  {KIND_LABELS[kind]}
                </div>
                <div className="divide-y">
                  {group.map((tpl) => (
                    <TemplateRow
                      key={tpl.id}
                      template={tpl}
                      onSave={(patch) => saveTemplate(tpl.id, patch)}
                      onDelete={() => deleteTemplate(tpl.id)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TemplateRow({
  template,
  onSave,
  onDelete,
}: {
  template: Template;
  onSave: (patch: Partial<Template>) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(template.name);
  const [content, setContent] = useState(template.content);
  const [isActive, setIsActive] = useState(template.is_active);
  const dirty = name !== template.name || content !== template.content || isActive !== template.is_active;

  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} className="flex-1" />
        <label className="flex items-center gap-1 text-xs">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          Активен
        </label>
      </div>
      <Textarea rows={3} value={content} onChange={(e) => setContent(e.target.value)} />
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={!dirty}
          onClick={() => onSave({ name, content, is_active: isActive })}
        >
          <Save className="mr-1 size-4" /> Сохранить
        </Button>
        <Button size="sm" variant="outline" onClick={onDelete}>
          <Trash2 className="mr-1 size-4" /> Удалить
        </Button>
      </div>
    </div>
  );
}
