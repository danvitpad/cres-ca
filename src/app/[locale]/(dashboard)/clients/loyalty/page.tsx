/** --- YAML
 * name: Client Loyalty — Punch Card
 * description: Master sets N (every Nth visit free); page shows progress per client.
 * created: 2026-04-13
 * updated: 2026-04-13
 * --- */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Gift, Save } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ClientRow {
  id: string;
  full_name: string;
  total_visits: number;
}

export default function LoyaltyPage() {
  const { master } = useMaster();
  const [every, setEvery] = useState(0);
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState<ClientRow[]>([]);

  const load = useCallback(async () => {
    if (!master?.id) return;
    const supabase = createClient();
    const { data: m } = await supabase
      .from('masters')
      .select('punch_card_every')
      .eq('id', master.id)
      .single();
    if (m) setEvery((m as { punch_card_every: number }).punch_card_every ?? 0);
    const { data: c } = await supabase
      .from('clients')
      .select('id, full_name, total_visits')
      .eq('master_id', master.id)
      .gte('total_visits', 1)
      .order('total_visits', { ascending: false });
    setClients((c ?? []) as ClientRow[]);
  }, [master?.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    if (!master?.id) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from('masters')
      .update({ punch_card_every: every })
      .eq('id', master.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success('Сохранено');
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Gift className="h-6 w-6 text-primary" />
          Punch-card лояльность
        </h1>
        <p className="text-sm text-muted-foreground">
          Каждый N-ый визит — бесплатный. Укажи N = 0 чтобы отключить.
        </p>
      </div>

      <div className="flex items-end gap-3 rounded-lg border bg-card p-5">
        <div className="flex-1 max-w-xs space-y-2">
          <Label>Каждый N-ый визит — бесплатный</Label>
          <Input
            type="number"
            min={0}
            max={100}
            value={every}
            onChange={(e) => setEvery(parseInt(e.target.value || '0', 10))}
          />
        </div>
        <Button onClick={save} disabled={saving}>
          <Save className="mr-1 h-4 w-4" />
          {saving ? '...' : 'Сохранить'}
        </Button>
      </div>

      {every > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground">Прогресс клиентов</h2>
          {clients.length === 0 ? (
            <p className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
              Пока нет визитов.
            </p>
          ) : (
            clients.map((c) => {
              const progress = c.total_visits % every;
              const ready = progress === 0;
              const pct = ready ? 100 : (progress / every) * 100;
              return (
                <div key={c.id} className="rounded-lg border bg-card p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium">{c.full_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {c.total_visits} визит(ов)
                      </div>
                    </div>
                    {ready ? (
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                        🎁 Следующий визит бесплатный
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {progress} / {every}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
