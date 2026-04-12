/** --- YAML
 * name: Consent Forms Manager
 * description: Master sends digital informed-consent text to a client; tracks signed status.
 * created: 2026-04-12
 * updated: 2026-04-12
 * --- */

'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { FileSignature, CheckCircle2, Clock } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

type ClientLite = { id: string; full_name: string; profile_id: string | null };
type ConsentRow = {
  id: string;
  client_id: string;
  form_text: string;
  client_agreed: boolean;
  agreed_at: string | null;
  created_at: string;
  client: { full_name: string } | { full_name: string }[] | null;
};

const TEMPLATES: { label: string; text: string }[] = [
  {
    label: 'Шаблон: косметология',
    text: 'Я подтверждаю, что ознакомлен(а) с противопоказаниями процедуры, мне разъяснены возможные риски и побочные эффекты. Я предоставил(а) достоверную информацию о состоянии здоровья, аллергиях и принимаемых препаратах. Согласие даётся добровольно.',
  },
  {
    label: 'Шаблон: инъекции',
    text: 'Я даю информированное согласие на проведение инъекционной процедуры. Подтверждаю, что у меня нет противопоказаний (беременность, инфекции, аутоиммунные заболевания). Понимаю возможные риски: гематомы, отёчность, индивидуальные реакции.',
  },
];

export default function ConsentsPage() {
  const supabase = createClient();
  const { master } = useMaster();
  const [clients, setClients] = useState<ClientLite[]>([]);
  const [rows, setRows] = useState<ConsentRow[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!master?.id) return;
    setLoading(true);
    const [{ data: cls }, { data: forms }] = await Promise.all([
      supabase
        .from('clients')
        .select('id, full_name, profile_id')
        .eq('master_id', master.id)
        .order('full_name'),
      supabase
        .from('consent_forms')
        .select('id, client_id, form_text, client_agreed, agreed_at, created_at, client:clients(full_name)')
        .eq('master_id', master.id)
        .order('created_at', { ascending: false })
        .limit(50),
    ]);
    setClients((cls as ClientLite[] | null) ?? []);
    setRows((forms as unknown as ConsentRow[] | null) ?? []);
    setLoading(false);
  }, [supabase, master?.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function send() {
    if (!master?.id || !selectedClient || !text.trim()) {
      toast.error('Выбери клиента и заполни текст');
      return;
    }
    setSending(true);
    const client = clients.find((c) => c.id === selectedClient);

    const { error } = await supabase.from('consent_forms').insert({
      master_id: master.id,
      client_id: selectedClient,
      form_text: text.trim(),
      client_agreed: false,
    });
    if (error) {
      toast.error(error.message);
      setSending(false);
      return;
    }

    if (client?.profile_id) {
      await supabase.from('notifications').insert({
        profile_id: client.profile_id,
        channel: 'telegram',
        title: '📝 Нужно подписать согласие',
        body: `Мастер просит подписать информированное согласие. Открой /forms → "Согласия". [consent:${selectedClient}]`,
        scheduled_for: new Date().toISOString(),
      });
    }

    toast.success('Согласие отправлено');
    setText('');
    setSending(false);
    load();
  }

  const pending = rows.filter((r) => !r.client_agreed);
  const signed = rows.filter((r) => r.client_agreed);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <FileSignature className="h-6 w-6 text-primary" />
          Цифровые согласия
        </h1>
        <p className="text-sm text-muted-foreground">
          Отправь информированное согласие клиенту перед сложной процедурой. Подпись фиксируется с датой.
        </p>
      </div>

      <div className="rounded-lg border bg-card p-5 space-y-4">
        <div className="space-y-2">
          <Label>Клиент</Label>
          <Select value={selectedClient} onValueChange={(v) => setSelectedClient(v ?? '')}>
            <SelectTrigger>
              <SelectValue placeholder="Выбери клиента" />
            </SelectTrigger>
            <SelectContent>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.full_name}
                  {!c.profile_id && ' (без профиля — подписать не сможет)'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Текст согласия</Label>
          <div className="flex flex-wrap gap-2">
            {TEMPLATES.map((tpl) => (
              <Button
                key={tpl.label}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setText(tpl.text)}
              >
                {tpl.label}
              </Button>
            ))}
          </div>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            placeholder="Опиши процедуру, риски, что подтверждает клиент…"
          />
        </div>

        <Button onClick={send} disabled={sending || !selectedClient || !text.trim()}>
          Отправить клиенту
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stat label="Ожидают подписи" value={pending.length.toString()} accent={pending.length > 0} />
        <Stat label="Подписано" value={signed.length.toString()} />
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Загрузка…</p>
      ) : rows.length === 0 ? (
        <p className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
          Пока нет отправленных согласий.
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => {
            const c = Array.isArray(r.client) ? r.client[0] : r.client;
            return (
              <div
                key={r.id}
                className={cn(
                  'rounded-lg border p-4',
                  r.client_agreed ? 'border-emerald-200 bg-emerald-50/40 dark:border-emerald-900 dark:bg-emerald-950/20' : 'border-amber-200 bg-amber-50/40 dark:border-amber-900 dark:bg-amber-950/20',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Link href={`/clients/${r.client_id}`} className="font-medium hover:underline">
                        {c?.full_name ?? '—'}
                      </Link>
                      {r.client_agreed ? (
                        <span className="flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" />
                          подписано {r.agreed_at ? new Date(r.agreed_at).toLocaleDateString() : ''}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
                          <Clock className="h-3 w-3" />
                          ожидает
                        </span>
                      )}
                    </div>
                    <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{r.form_text}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn('text-lg font-semibold', accent && 'text-amber-600')}>{value}</div>
    </div>
  );
}
