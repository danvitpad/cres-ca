/** --- YAML
 * name: Blast Campaigns
 * description: Mass TG broadcasts. Supports segment selection (all/VIP/regular/new/inactive) AND manual client picker (search + checkboxes). Creates pending notifications for the cron sender.
 * created: 2026-04-13
 * updated: 2026-04-17
 * --- */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Megaphone, Users, Send, Search, Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';
import { useConfirm } from '@/hooks/use-confirm';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

type Mode = 'segment' | 'manual';
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
  const [mode, setMode] = useState<Mode>('segment');
  const [segment, setSegment] = useState<Segment>('all');
  const [pickedIds, setPickedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!master?.id) return;
    const supabase = createClient();
    const { data } = await supabase
      .from('clients')
      .select('id, full_name, profile_id, tier, total_visits, last_visit_at')
      .eq('master_id', master.id)
      .not('profile_id', 'is', null)
      .order('full_name', { ascending: true });
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

  // Final list of recipients depending on mode
  const targets = useMemo(() => {
    if (mode === 'segment') return filterBySegment(clients, segment);
    return clients.filter(c => pickedIds.has(c.id));
  }, [mode, segment, clients, pickedIds]);

  const filteredForPicker = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(c => c.full_name.toLowerCase().includes(q));
  }, [search, clients]);

  function toggleClient(id: string) {
    setPickedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function pickAll() {
    setPickedIds(new Set(filteredForPicker.map(c => c.id)));
  }
  function pickNone() {
    setPickedIds(new Set());
  }

  async function send() {
    if (!content.trim()) {
      toast.error('Введи текст сообщения');
      return;
    }
    if (!targets.length) {
      toast.error(mode === 'segment' ? 'Пустой сегмент' : 'Выбери получателей');
      return;
    }
    if (!(await confirm({
      title: 'Отправить рассылку?',
      description: `Сообщение уйдёт ${targets.length} ${targets.length === 1 ? 'клиенту' : 'клиентам'}.`,
      confirmLabel: 'Отправить',
    }))) return;

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
      if (master?.id) {
        await supabase.from('ai_actions_log').insert({
          master_id: master.id,
          source: 'dashboard',
          action_type: 'broadcast_send',
          input_text: content.trim().slice(0, 500),
          result: {
            campaign_id: campaignId,
            target_count: targets.length,
            recipient_count: rows.length,
            mode,
            segment: mode === 'segment' ? segment : null,
          },
          status: 'failed',
          error_message: error.message,
        });
      }
      toast.error(error.message);
      return;
    }
    if (master?.id) {
      await supabase.from('ai_actions_log').insert({
        master_id: master.id,
        source: 'dashboard',
        action_type: 'broadcast_send',
        input_text: content.trim().slice(0, 500),
        result: {
          campaign_id: campaignId,
          target_count: targets.length,
          recipient_count: rows.length,
          mode,
          segment: mode === 'segment' ? segment : null,
        },
        status: 'success',
      });
    }
    toast.success(`Отправлено ${rows.length} сообщений`);
    setContent('');
    if (mode === 'manual') setPickedIds(new Set());
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Megaphone className="h-6 w-6 text-primary" />
          Массовые рассылки
        </h1>
        <p className="text-sm text-muted-foreground">
          Выбери сегмент клиентов или отдельных получателей и отправь сообщение через Telegram.
        </p>
      </div>

      {/* Mode switcher */}
      <div className="inline-flex gap-1 rounded-lg bg-muted p-1">
        {(['segment', 'manual'] as Mode[]).map(m => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
              mode === m
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {m === 'segment' ? 'По сегменту' : 'Выбрать вручную'}
          </button>
        ))}
      </div>

      <div className="space-y-4 rounded-lg border bg-card p-5">
        {mode === 'segment' && (
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
        )}

        {mode === 'manual' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Получатели <span className="text-muted-foreground">({pickedIds.size} выбрано из {clients.length})</span></Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={pickAll}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Выбрать все ({filteredForPicker.length})
                </button>
                <span className="text-muted-foreground">·</span>
                <button
                  type="button"
                  onClick={pickNone}
                  className="text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  Снять
                </button>
              </div>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск клиента по имени..."
                className="pl-9"
              />
            </div>

            <div className="max-h-72 overflow-y-auto rounded-md border">
              {filteredForPicker.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  Нет клиентов с подключённым Telegram
                </div>
              ) : (
                filteredForPicker.map(c => {
                  const checked = pickedIds.has(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleClient(c.id)}
                      className="flex w-full items-center gap-3 border-b px-3 py-2.5 text-left text-sm hover:bg-muted last:border-b-0"
                    >
                      <div className={`flex h-5 w-5 items-center justify-center rounded border-2 transition ${
                        checked
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-input bg-background'
                      }`}>
                        {checked && <Check className="h-3 w-3" />}
                      </div>
                      <span className="flex-1 font-medium">{c.full_name || '—'}</span>
                      {c.tier === 'vip' && (
                        <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                          VIP
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {c.total_visits || 0} визитов
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}

        <div>
          <Label className="mb-2 block">Сообщение</Label>
          <Textarea
            rows={6}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Напиши текст рассылки…"
          />
          <div className="mt-1 text-xs text-muted-foreground">
            {content.length} символов · будет отправлено {targets.length}{' '}
            {targets.length === 1 ? 'клиенту' : 'клиентам'}
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
