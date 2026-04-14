/** --- YAML
 * name: Promo Codes
 * description: CRUD промокодов мастера — код, % скидки, лимит использований, срок действия. Счётчик использований инкрементится при применении при онлайн-записи.
 * created: 2026-04-13
 * updated: 2026-04-13
 * --- */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Tag, Plus, Trash2, Copy } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface PromoCode {
  id: string;
  code: string;
  discount_percent: number;
  max_uses: number | null;
  uses_count: number;
  valid_from: string | null;
  valid_until: string | null;
  is_active: boolean;
}

export default function DealsPage() {
  const { master } = useMaster();
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [code, setCode] = useState('');
  const [discount, setDiscount] = useState(10);
  const [maxUses, setMaxUses] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!master?.id) return;
    const supabase = createClient();
    const { data } = await supabase
      .from('promo_codes')
      .select('*')
      .eq('master_id', master.id)
      .order('created_at', { ascending: false });
    setCodes((data ?? []) as PromoCode[]);
  }, [master?.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function add() {
    if (!master?.id || !code.trim() || discount <= 0) {
      toast.error('Заполни код и скидку');
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from('promo_codes').insert({
      master_id: master.id,
      code: code.trim().toUpperCase(),
      discount_percent: discount,
      max_uses: maxUses ? parseInt(maxUses) : null,
      valid_until: validUntil ? new Date(validUntil).toISOString() : null,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Промокод создан');
    setCode('');
    setDiscount(10);
    setMaxUses('');
    setValidUntil('');
    load();
  }

  async function toggle(p: PromoCode) {
    const supabase = createClient();
    await supabase.from('promo_codes').update({ is_active: !p.is_active }).eq('id', p.id);
    setCodes((prev) => prev.map((x) => (x.id === p.id ? { ...x, is_active: !p.is_active } : x)));
  }

  async function remove(id: string) {
    const supabase = createClient();
    await supabase.from('promo_codes').delete().eq('id', id);
    setCodes((p) => p.filter((x) => x.id !== id));
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Скопировано');
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Tag className="h-6 w-6 text-primary" />
          Промокоды и акции
        </h1>
        <p className="text-sm text-muted-foreground">
          Создавай промокоды со скидками, отправляй клиентам в рассылках и отслеживай использования.
        </p>
      </div>

      <div className="space-y-3 rounded-lg border bg-card p-5">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="space-y-1">
            <Label>Код</Label>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="SUMMER20"
            />
          </div>
          <div className="space-y-1">
            <Label>Скидка %</Label>
            <Input
              type="number"
              min={1}
              max={100}
              value={discount}
              onChange={(e) => setDiscount(parseInt(e.target.value) || 0)}
            />
          </div>
          <div className="space-y-1">
            <Label>Лимит</Label>
            <Input
              type="number"
              min={1}
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value)}
              placeholder="∞"
            />
          </div>
          <div className="space-y-1">
            <Label>Действует до</Label>
            <Input
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={add} disabled={saving}>
            <Plus className="mr-1 h-4 w-4" />
            {saving ? '...' : 'Создать'}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {codes.length === 0 ? (
          <p className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
            Пока нет промокодов.
          </p>
        ) : (
          codes.map((p) => {
            const pct = p.max_uses ? Math.min(100, (p.uses_count / p.max_uses) * 100) : 0;
            const expired = p.valid_until && new Date(p.valid_until) < new Date();
            return (
              <div
                key={p.id}
                className={`rounded-lg border p-4 ${
                  p.is_active && !expired ? 'bg-card' : 'bg-muted/40 opacity-70'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <code className="rounded bg-primary/10 px-2 py-0.5 font-mono text-sm font-bold text-primary">
                        {p.code}
                      </code>
                      <span className="text-lg font-semibold">−{p.discount_percent}%</span>
                      {expired && <span className="text-xs text-red-500">истёк</span>}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Использовано: {p.uses_count}
                      {p.max_uses ? ` / ${p.max_uses}` : ''}
                      {p.valid_until && ` · до ${new Date(p.valid_until).toLocaleDateString()}`}
                    </div>
                    {p.max_uses && (
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded bg-muted">
                        <div
                          className="h-full bg-primary"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => copy(p.code)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => toggle(p)}>
                      {p.is_active ? 'Пауза' : 'Вкл'}
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(p.id)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
