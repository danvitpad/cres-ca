/** --- YAML
 * name: Client Loyalty — Punch Card
 * description: Master sets N (every Nth visit free); page shows progress per client.
 * created: 2026-04-13
 * updated: 2026-04-17
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
import { usePageTheme, FONT, FONT_FEATURES, pageContainer, cardStyle } from '@/lib/dashboard-theme';

interface ClientRow {
  id: string;
  full_name: string;
  total_visits: number;
}

export default function LoyaltyPage() {
  const { master } = useMaster();
  const { C } = usePageTheme();
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
    <div style={{ ...pageContainer, background: C.bg, color: C.text }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 24, fontWeight: 600, margin: 0, color: C.text }}>
            <Gift style={{ width: 24, height: 24, color: C.accent }} />
            Punch-card лояльность
          </h1>
          <p style={{ fontSize: 14, color: C.textSecondary, margin: '4px 0 0' }}>
            Каждый N-ый визит — бесплатный. Укажи N = 0 чтобы отключить.
          </p>
        </div>

        <div style={{ ...cardStyle(C), display: 'flex', alignItems: 'flex-end', gap: 12, padding: 20 }}>
          <div style={{ flex: 1, maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 8 }}>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: C.textSecondary, margin: 0 }}>Прогресс клиентов</h2>
            {clients.length === 0 ? (
              <p style={{ ...cardStyle(C), padding: 24, textAlign: 'center', fontSize: 14, color: C.textSecondary, margin: 0 }}>
                Пока нет визитов.
              </p>
            ) : (
              clients.map((c) => {
                const progress = c.total_visits % every;
                const ready = progress === 0;
                const pct = ready ? 100 : (progress / every) * 100;
                return (
                  <div key={c.id} style={{ ...cardStyle(C), padding: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                      <div>
                        <div style={{ fontWeight: 510 }}>{c.full_name}</div>
                        <div style={{ fontSize: 12, color: C.textSecondary }}>
                          {c.total_visits} визит(ов)
                        </div>
                      </div>
                      {ready ? (
                        <span style={{ borderRadius: 999, background: C.successSoft, padding: '4px 12px', fontSize: 12, fontWeight: 600, color: C.success }}>
                          🎁 Следующий визит бесплатный
                        </span>
                      ) : (
                        <span style={{ fontSize: 12, color: C.textSecondary }}>
                          {progress} / {every}
                        </span>
                      )}
                    </div>
                    <div style={{ marginTop: 8, height: 6, overflow: 'hidden', borderRadius: 999, background: C.surfaceElevated }}>
                      <div
                        style={{ height: '100%', background: C.accent, transition: 'all 0.2s', width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
