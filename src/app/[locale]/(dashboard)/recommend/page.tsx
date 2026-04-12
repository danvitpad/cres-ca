/** --- YAML
 * name: Master Recommendations
 * description: Master sends a cross-master recommendation for a client, earning bonus points on booking.
 * created: 2026-04-12
 * updated: 2026-04-12
 * --- */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type ClientRow = { id: string; full_name: string; profile_id: string | null };
type MasterOption = { id: string; display_name: string | null; specialization: string | null };
type Recommendation = {
  id: string;
  created_at: string;
  status: string;
  bonus_points: number;
  note: string | null;
  to_master: { display_name: string | null } | null;
  client: { full_name: string } | null;
};

export default function RecommendPage() {
  const supabase = createClient();
  const { master } = useMaster();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [targets, setTargets] = useState<MasterOption[]>([]);
  const [clientId, setClientId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState<Recommendation[]>([]);

  const load = useCallback(async () => {
    if (!master?.id) return;
    const [{ data: cs }, { data: ms }, { data: recs }] = await Promise.all([
      supabase.from('clients').select('id, full_name, profile_id').eq('master_id', master.id).order('full_name'),
      supabase.from('masters').select('id, display_name, specialization').neq('id', master.id).eq('is_active', true).limit(50),
      supabase
        .from('master_recommendations')
        .select('id, created_at, status, bonus_points, note, to_master:to_master_id(display_name), client:client_id(full_name)')
        .eq('from_master_id', master.id)
        .order('created_at', { ascending: false })
        .limit(20),
    ]);
    setClients((cs as ClientRow[]) ?? []);
    setTargets((ms as MasterOption[]) ?? []);
    setSent((recs as unknown as Recommendation[]) ?? []);
  }, [supabase, master?.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSend() {
    if (!master?.id || !targetId) {
      toast.error('Выбери коллегу');
      return;
    }
    setSubmitting(true);
    const { data: rec, error } = await supabase
      .from('master_recommendations')
      .insert({
        from_master_id: master.id,
        to_master_id: targetId,
        client_id: clientId || null,
        note: note.trim() || null,
      })
      .select('id')
      .single();
    if (error || !rec) {
      toast.error(error?.message ?? 'Ошибка');
      setSubmitting(false);
      return;
    }

    const client = clients.find((c) => c.id === clientId);
    if (client?.profile_id) {
      const targetName = targets.find((t) => t.id === targetId)?.display_name ?? 'мастер';
      await supabase.from('notifications').insert({
        profile_id: client.profile_id,
        channel: 'telegram',
        title: '✨ Рекомендация',
        body: `${master.profile.full_name} советует тебе ${targetName}. [rec:${rec.id}]`,
        scheduled_for: new Date().toISOString(),
      });
    }

    toast.success('Рекомендация отправлена');
    setClientId('');
    setTargetId('');
    setNote('');
    load();
    setSubmitting(false);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Рекомендации коллегам</h1>
        <p className="text-sm text-muted-foreground">
          Направь клиента коллеге и получи бонус, когда они запишутся.
        </p>
      </div>

      <div className="rounded-lg border bg-card p-5 space-y-4">
        <h2 className="text-lg font-medium">Новая рекомендация</h2>
        <div className="space-y-2">
          <Label>Клиент (необязательно)</Label>
          <select
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
          >
            <option value="">—</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label>Коллега</Label>
          <select
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
          >
            <option value="">—</option>
            {targets.map((m) => (
              <option key={m.id} value={m.id}>
                {m.display_name ?? 'Без имени'}
                {m.specialization ? ` · ${m.specialization}` : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label>Комментарий</Label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Напр.: хороший колорист" />
        </div>
        <Button onClick={handleSend} disabled={submitting || !targetId}>
          {submitting ? 'Отправка…' : 'Отправить'}
        </Button>
      </div>

      <div>
        <h2 className="text-lg font-medium mb-3">Отправленные ({sent.length})</h2>
        {sent.length === 0 ? (
          <p className="text-sm text-muted-foreground">Пока ничего не отправлено.</p>
        ) : (
          <div className="space-y-2">
            {sent.map((r) => (
              <div key={r.id} className="rounded-md border p-3 text-sm">
                <div className="flex justify-between">
                  <span className="font-medium">{r.to_master?.display_name ?? '—'}</span>
                  <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {r.client?.full_name ? `для ${r.client.full_name} · ` : ''}
                  {r.status} · +{r.bonus_points} pts
                </div>
                {r.note ? <p className="mt-1 text-xs">{r.note}</p> : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
