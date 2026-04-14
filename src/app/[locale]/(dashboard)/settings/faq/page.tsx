/** --- YAML
 * name: FAQ Templates
 * description: CRUD для шаблонов ответов на частые вопросы клиентов. Копирование в буфер в одно касание.
 * created: 2026-04-13
 * updated: 2026-04-13
 * --- */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { MessageSquare, Plus, Copy, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface Faq {
  id: string;
  question: string;
  answer: string;
  position: number;
}

const DEFAULTS: { question: string; answer: string }[] = [
  { question: 'Сколько стоит?', answer: 'Цены зависят от услуги — актуальный прайс у меня в профиле: {link}' },
  { question: 'Где находится?', answer: 'Адрес: {address}. Как добраться: {transport}' },
  { question: 'Можно переписать?', answer: 'Конечно, давайте подберём удобное время. Напишите когда удобно.' },
];

export default function FaqTemplatesPage() {
  const supabase = createClient();
  const { master } = useMaster();
  const [items, setItems] = useState<Faq[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [a, setA] = useState('');

  const load = useCallback(async () => {
    if (!master?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from('faq_templates')
      .select('id, question, answer, position')
      .eq('master_id', master.id)
      .order('position', { ascending: true });
    setItems(((data ?? []) as Faq[]));
    setLoading(false);
  }, [master?.id, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  async function add() {
    if (!master?.id || !q || !a) return;
    const { data, error } = await supabase
      .from('faq_templates')
      .insert({ master_id: master.id, question: q, answer: a, position: items.length })
      .select('id, question, answer, position')
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    setItems((prev) => [...prev, data as Faq]);
    setQ('');
    setA('');
    toast.success('Добавлено');
  }

  async function remove(id: string) {
    await supabase.from('faq_templates').delete().eq('id', id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  async function seed() {
    if (!master?.id) return;
    const rows = DEFAULTS.map((d, i) => ({ master_id: master.id, question: d.question, answer: d.answer, position: i }));
    const { data, error } = await supabase.from('faq_templates').insert(rows).select('id, question, answer, position');
    if (error) {
      toast.error(error.message);
      return;
    }
    setItems((prev) => [...prev, ...((data ?? []) as Faq[])]);
    toast.success('Шаблоны добавлены');
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Скопировано');
    } catch {
      toast.error('Не удалось скопировать');
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <MessageSquare className="h-6 w-6 text-primary" />
          FAQ-шаблоны
        </h1>
        <p className="text-sm text-muted-foreground">
          Быстрые ответы на частые вопросы. Тап → копируется в буфер → вставляете в чат.
        </p>
      </div>

      {items.length === 0 && !loading && (
        <Button variant="outline" onClick={seed}>
          Добавить стандартные шаблоны
        </Button>
      )}

      <div className="rounded-lg border bg-card p-5 space-y-3">
        <div className="text-sm font-semibold">Новый шаблон</div>
        <Input placeholder="Вопрос" value={q} onChange={(e) => setQ(e.target.value)} />
        <Textarea placeholder="Ответ" value={a} onChange={(e) => setA(e.target.value)} rows={3} />
        <Button onClick={add} disabled={!q || !a}>
          <Plus className="mr-1 h-4 w-4" /> Добавить
        </Button>
      </div>

      <div className="space-y-2">
        {loading ? (
          <div className="text-sm text-muted-foreground">Загрузка…</div>
        ) : items.length === 0 ? (
          <div className="text-sm text-muted-foreground">Пока нет шаблонов.</div>
        ) : (
          items.map((it) => (
            <div key={it.id} className="rounded-lg border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold">{it.question}</div>
                  <div className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{it.answer}</div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="outline" onClick={() => copy(it.answer)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="outline" onClick={() => remove(it.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
