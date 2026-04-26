/** --- YAML
 * name: Blast Campaigns
 * description: Mass TG/email broadcasts with a gmail-style composer (Subject + Body +
 *              optional attachments). Supports segment selection (all/VIP/regular/new/inactive)
 *              and manual client picker. Creates pending notifications for the cron sender;
 *              attachment URLs go into notifications.data.attachment_urls so the TG dispatcher
 *              can re-send them via bot.sendDocument.
 * created: 2026-04-13
 * updated: 2026-04-25
 * --- */

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Users, Send, Search, Check, Paperclip, X, FileText } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';
import { useConfirm } from '@/hooks/use-confirm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Mode = 'segment' | 'manual';
type Segment = 'all' | 'vip' | 'regular' | 'new' | 'inactive';
type Channel = 'telegram' | 'email' | 'both';

interface ClientRow {
  id: string;
  full_name: string;
  profile_id: string | null;
  tier: string | null;
  total_visits: number | null;
  last_visit_at: string | null;
}

interface Attachment {
  name: string;
  size: number;
  url: string;
  path: string;
}

const SEGMENTS: { key: Segment; label: string; desc: string }[] = [
  { key: 'all',      label: 'Все',         desc: 'Все клиенты' },
  { key: 'vip',      label: 'VIP',         desc: '15+ визитов' },
  { key: 'regular',  label: 'Постоянные',  desc: '3-14 визитов' },
  { key: 'new',      label: 'Новые',       desc: '<3 визитов' },
  { key: 'inactive', label: 'Спящие',      desc: 'Не были >60 дней' },
];

const MAX_ATTACH_MB = 20;

export default function CampaignsPage() {
  const { master } = useMaster();
  const confirm = useConfirm();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [mode, setMode] = useState<Mode>('segment');
  const [segment, setSegment] = useState<Segment>('all');
  const [pickedIds, setPickedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [channel, setChannel] = useState<Channel>('telegram');
  const [scheduleAt, setScheduleAt] = useState<string>('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => { load(); }, [load]);

  function filterBySegment(list: ClientRow[], s: Segment): ClientRow[] {
    const now = Date.now();
    const sixty = 60 * 24 * 60 * 60 * 1000;
    return list.filter((c) => {
      switch (s) {
        case 'all': return true;
        case 'vip': return c.tier === 'vip';
        case 'regular': return c.tier === 'regular';
        case 'new': return c.tier === 'new';
        case 'inactive': return !c.last_visit_at || now - new Date(c.last_visit_at).getTime() > sixty;
      }
    });
  }

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
  function pickAll() { setPickedIds(new Set(filteredForPicker.map(c => c.id))); }
  function pickNone() { setPickedIds(new Set()); }

  async function handleAttachFiles(files: FileList | null) {
    if (!files || !files.length || !master?.id) return;
    setUploading(true);
    const supabase = createClient();
    const next: Attachment[] = [...attachments];
    for (const f of Array.from(files)) {
      if (f.size > MAX_ATTACH_MB * 1024 * 1024) {
        toast.error(`«${f.name}» больше ${MAX_ATTACH_MB}MB — пропускаю`);
        continue;
      }
      const safeName = f.name.replace(/[^a-zA-Zа-яА-Я0-9._-]/g, '_').slice(0, 80);
      const path = `broadcasts/${master.id}/${Date.now()}-${safeName}`;
      const { error } = await supabase.storage.from('posts').upload(path, f, {
        cacheControl: '31536000',
        upsert: false,
      });
      if (error) {
        toast.error(`Не удалось загрузить «${f.name}»: ${error.message}`);
        continue;
      }
      const { data: pub } = supabase.storage.from('posts').getPublicUrl(path);
      next.push({ name: f.name, size: f.size, url: pub.publicUrl, path });
    }
    setAttachments(next);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function removeAttachment(idx: number) {
    const a = attachments[idx];
    if (!a) return;
    const supabase = createClient();
    await supabase.storage.from('posts').remove([a.path]).catch(() => null);
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  }

  async function send() {
    if (!subject.trim()) { toast.error('Введи тему сообщения'); return; }
    if (!content.trim()) { toast.error('Введи текст сообщения'); return; }
    if (!targets.length) {
      toast.error(mode === 'segment' ? 'Пустой сегмент' : 'Выбери получателей');
      return;
    }
    const scheduledIso = scheduleAt ? new Date(scheduleAt).toISOString() : new Date().toISOString();
    if (scheduleAt && new Date(scheduleAt).getTime() < Date.now() - 60_000) {
      toast.error('Время в прошлом — поставь будущую дату или оставь поле пустым для немедленной отправки');
      return;
    }
    const channels: ('telegram' | 'email')[] = channel === 'both' ? ['telegram', 'email'] : [channel];
    const whenLabel = scheduleAt
      ? new Date(scheduleAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
      : 'сейчас';
    const channelLabel = channel === 'both' ? 'Telegram + Email' : channel === 'email' ? 'Email' : 'Telegram';
    if (!(await confirm({
      title: 'Отправить рассылку?',
      description: `${channelLabel} · ${targets.length} ${targets.length === 1 ? 'клиенту' : 'клиентам'} · ${whenLabel}.`,
      confirmLabel: scheduleAt ? 'Запланировать' : 'Отправить',
    }))) return;

    setSending(true);
    const supabase = createClient();
    const campaignId = crypto.randomUUID().slice(0, 8);
    const attachmentUrls = attachments.map(a => ({ url: a.url, name: a.name, size: a.size }));

    type Row = {
      profile_id: string;
      channel: 'telegram' | 'email';
      title: string;
      body: string;
      scheduled_for: string;
      data: Record<string, unknown>;
    };
    const rows: Row[] = [];
    for (const c of targets) {
      if (!c.profile_id) continue;
      for (const ch of channels) {
        rows.push({
          profile_id: c.profile_id,
          channel: ch,
          title: subject.trim(),
          // body чистый — маркер кампании хранится в data.campaign_id (используется
          // для аналитики), а раньше дублировался в виде «[camp:xxx]» в самом тексте
          // и был виден клиенту в TG. Убрали.
          body: content.trim(),
          scheduled_for: scheduledIso,
          data: {
            campaign_id: campaignId,
            kind: 'broadcast',
            attachment_urls: attachmentUrls.length ? attachmentUrls : undefined,
          },
        });
      }
    }

    const { error } = await supabase.from('notifications').insert(rows);
    setSending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (master?.id) {
      await supabase.from('ai_actions_log').insert({
        master_id: master.id,
        source: 'dashboard',
        action_type: 'broadcast_send',
        input_text: `${subject.trim()}\n${content.trim().slice(0, 500)}`,
        result: {
          campaign_id: campaignId,
          target_count: targets.length,
          recipient_count: rows.length,
          attachment_count: attachmentUrls.length,
          mode,
          segment: mode === 'segment' ? segment : null,
        },
        status: 'success',
      });
    }
    toast.success(scheduleAt
      ? `Запланировано ${rows.length} сообщений`
      : `Отправлено ${rows.length} сообщений`);
    setSubject('');
    setContent('');
    setScheduleAt('');
    setAttachments([]);
    if (mode === 'manual') setPickedIds(new Set());
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-6">
      {/* Recipient mode */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Получатели</h2>
          <div className="inline-flex gap-1 rounded-lg bg-muted p-0.5 text-xs">
            {(['segment', 'manual'] as Mode[]).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`rounded-md px-3 py-1 font-medium transition ${
                  mode === m ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {m === 'segment' ? 'По сегменту' : 'Вручную'}
              </button>
            ))}
          </div>
        </div>

        {mode === 'segment' ? (
          <div className="flex flex-wrap gap-1.5">
            {SEGMENTS.map((s) => {
              const count = filterBySegment(clients, s.key).length;
              const active = segment === s.key;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSegment(s.key)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    active ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background hover:bg-muted'
                  }`}
                >
                  <Users className="mr-1 inline h-3 w-3" />
                  {s.label} <span className="opacity-60">· {count}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{pickedIds.size} из {clients.length} выбрано</span>
              <div className="flex gap-2">
                <button type="button" onClick={pickAll} className="font-medium text-primary hover:underline">Выбрать все ({filteredForPicker.length})</button>
                <span className="text-muted-foreground">·</span>
                <button type="button" onClick={pickNone} className="font-medium text-muted-foreground hover:text-foreground">Снять</button>
              </div>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск клиента…"
                className="pl-9 h-9"
              />
            </div>
            <div className="max-h-56 overflow-y-auto rounded-md border bg-card">
              {filteredForPicker.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">Нет клиентов</div>
              ) : (
                filteredForPicker.map(c => {
                  const checked = pickedIds.has(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleClient(c.id)}
                      className="flex w-full items-center gap-3 border-b border-border px-3 py-2 text-left text-sm hover:bg-muted last:border-b-0"
                    >
                      <div className={`flex h-4 w-4 items-center justify-center rounded border-2 transition ${
                        checked ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-background'
                      }`}>
                        {checked && <Check className="h-2.5 w-2.5" />}
                      </div>
                      <span className="flex-1 truncate">{c.full_name || '—'}</span>
                      {c.tier === 'vip' && <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">VIP</span>}
                      <span className="text-[11px] text-muted-foreground">{c.total_visits || 0} виз.</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Gmail-style composer */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {/* Subject */}
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Тема"
          className="w-full px-4 py-3 text-sm font-medium bg-transparent border-0 border-b border-border outline-none focus:border-primary placeholder:text-muted-foreground"
        />

        {/* Body */}
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={10}
          placeholder="Напиши текст рассылки…"
          className="w-full px-4 py-3 text-sm bg-transparent border-0 outline-none resize-none placeholder:text-muted-foreground"
        />

        {/* Attachments chips */}
        {attachments.length > 0 && (
          <div className="px-4 pb-3 flex flex-wrap gap-2">
            {attachments.map((a, i) => (
              <div
                key={i}
                className="inline-flex items-center gap-2 rounded-md border border-border bg-muted/50 pl-2 pr-1 py-1 text-[11px]"
              >
                <FileText className="h-3 w-3 text-muted-foreground" />
                <span className="font-medium">{a.name}</span>
                <span className="text-muted-foreground">{(a.size / 1024).toFixed(0)} KB</span>
                <button
                  type="button"
                  onClick={() => removeAttachment(i)}
                  className="p-0.5 rounded hover:bg-background text-muted-foreground hover:text-foreground"
                  aria-label="Убрать вложение"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Toolbar — gmail-style bottom bar */}
        <div className="flex items-center gap-2 px-3 py-2 border-t border-border bg-muted/30 flex-wrap">
          {/* Send */}
          <Button
            onClick={send}
            disabled={sending || !targets.length}
            size="sm"
            className="rounded-full"
          >
            <Send className="mr-1.5 h-3.5 w-3.5" />
            {sending ? 'Отправка…' : scheduleAt ? `Запланировать (${targets.length})` : `Отправить (${targets.length})`}
          </Button>

          {/* Channel select */}
          <div className="inline-flex gap-0 rounded-md border border-border overflow-hidden text-[11px]">
            {(['telegram', 'email', 'both'] as Channel[]).map((c, i) => (
              <button
                key={c}
                type="button"
                onClick={() => setChannel(c)}
                className={`px-2.5 py-1 font-medium transition ${i > 0 ? 'border-l border-border' : ''} ${
                  channel === c ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'
                }`}
              >
                {c === 'telegram' ? 'TG' : c === 'email' ? 'Email' : 'TG + Email'}
              </button>
            ))}
          </div>

          {/* Schedule */}
          <input
            type="datetime-local"
            value={scheduleAt}
            onChange={(e) => setScheduleAt(e.target.value)}
            className="rounded-md border border-border bg-background px-2 py-1 text-[11px] outline-none focus:border-primary"
            title="Оставь пустым для немедленной отправки"
          />

          <div className="ml-auto flex items-center gap-1">
            {/* Attachment */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              hidden
              onChange={(e) => handleAttachFiles(e.target.files)}
              accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx,.zip,.txt"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || !master?.id}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-50"
              title="Прикрепить файл"
            >
              <Paperclip className="h-4 w-4" />
            </button>
            {uploading && <span className="text-[11px] text-muted-foreground">загружаю…</span>}
          </div>
        </div>
      </div>

      {/* Footer hint */}
      <p className="text-[11px] text-muted-foreground">
        {channel === 'telegram' && 'Только клиентам, у кого подключён Telegram-бот.'}
        {channel === 'email' && 'Только клиентам, у кого есть email в профиле.'}
        {channel === 'both' && 'TG + Email одновременно — каждый канал получит сообщение.'}
        {' · Файлы до '}{MAX_ATTACH_MB}{' MB. Вложения уходят отдельным сообщением после текста.'}
      </p>
    </div>
  );
}
