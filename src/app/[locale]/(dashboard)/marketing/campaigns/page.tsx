/** --- YAML
 * name: Blast Campaigns
 * description: Массовые TG-рассылки по сегментам клиентов (все / VIP / regular / new / inactive). Создаёт pending notifications — забирает стандартный sender cron.
 * created: 2026-04-13
 * updated: 2026-04-13
 * --- */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Megaphone, Users, Send } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';
import { useConfirm } from '@/hooks/use-confirm';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

type Segment = 'all' | 'vip' | 'regular' | 'new' | 'inactive';

interface ClientRow {
  id: string;
  full_name: string;
  profile_id: string | null;
  tier: string | null;
  total_visits: number | null;
  last_visit_at: string | null;
}

const SEGMENTS: { key: Segment; label: string; desc: string }[] = [
  { key: 'all', label: 'Все', desc: 'Все клиенты с Telegram' },
  { key: 'vip', label: 'VIP', desc: '15+ визитов' },
  { key: 'regular', label: 'Постоянные', desc: '3-14 визитов' },
  { key: 'new', label: 'Новые', desc: '<3 визитов' },
  { key: 'inactive', label: 'Спящие', desc: 'Не были >60 дней' },
];

export default function CampaignsPage() {
  const { master } = useMaster();
  const confirm = useConfirm();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [segment, setSegment] = useState<Segment>('all');
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!master?.id) return;
    const supabase = createClient();
    const { data } = await supabase
      .from('clients')
      .select('id, full_name, profile_id, tier, total_visits, last_visit_at')
      .eq('master_id', master.id)
      .not('profile_id', 'is', null);
    setClients((data ?? []) as ClientRow[]);
  }, [master?.id]);

  useEffect(() => {
    load();
  }, [load]);

  function filterBySegment(list: ClientRow[], s: Segment): ClientRow[] {
    const now = Date.now();
    const sixty = 60 * 24 * 60 * 60 * 1000;
    return list.filter((c) => {
      switch (s) {
        case 'all':
          return true;
        case 'vip':
          return c.tier === 'vip';
        case 'regular':
          return c.tier === 'regular';
        case 'new':
          return c.tier === 'new';
        case 'inactive':
          return !c.last_visit_at || now - new Date(c.last_visit_at).getTime() > sixty;
      }
    });
  }

  const targets = filterBySegment(clients, segment);

  async function send() {
    if (!content.trim()) {
      toast.error('Введи текст сообщения');
      return;
    }
    if (!targets.length) {
      toast.error('Пустой сегмент');
      return;
    }
    if (!(await confirm({ title: 'Отправить рассылку?', description: `Сообщение уйдёт ${targets.length} клиентам.`, confirmLabel: 'Отправить' }))) return;
    setSending(true);
    const supabase = createClient();
    const campaignId = crypto.randomUUID().slice(0, 8);
    const rows = targets
      .filter((c) => c.profile_id)
      .map((c) => ({
        profile_id: c.profile_id as string,
        channel: 'telegram' as const,
        title: '📣 Сообщение от мастера',
        body: `${content.trim()} [camp:${campaignId}]`,
        scheduled_for: new Date().toISOString(),
      }));
    const { error } = await supabase.from('notifications').insert(rows);
    setSending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Отправлено ${rows.length} сообщений`);
    setContent('');
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Megaphone className="h-6 w-6 text-primary" />
          Массовые рассылки
        </h1>
        <p className="text-sm text-muted-foreground">
          Выбери сегмент клиентов и отправь сообщение всем сразу через Telegram.
        </p>
      </div>

      <div className="space-y-4 rounded-lg border bg-card p-5">
        <div>
          <Label className="mb-2 block">Сегмент</Label>
          <div className="flex flex-wrap gap-2">
            {SEGMENTS.map((s) => {
              const count = filterBySegment(clients, s.key).length;
              const active = segment === s.key;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSegment(s.key)}
                  className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                    active
                      ? 'border-primary bg-primary/10'
                      : 'bg-background hover:bg-muted'
                  }`}
                >
                  <div className="flex items-center gap-2 font-medium">
                    <Users className="h-3.5 w-3.5" />
                    {s.label}
                    <span className="text-xs text-muted-foreground">({count})</span>
                  </div>
                  <div className="text-xs text-muted-foreground">{s.desc}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <Label className="mb-2 block">Сообщение</Label>
          <Textarea
            rows={6}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Напиши текст рассылки…"
          />
          <div className="mt-1 text-xs text-muted-foreground">
            {content.length} символов · будет отправлено {targets.length} клиентам
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={send} disabled={sending || !targets.length}>
            <Send className="mr-1 h-4 w-4" />
            {sending ? 'Отправка…' : `Отправить (${targets.length})`}
          </Button>
        </div>
      </div>
    </div>
  );
}
