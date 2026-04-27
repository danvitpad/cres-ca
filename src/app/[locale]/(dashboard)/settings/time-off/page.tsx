/** --- YAML
 * name: Time Off Settings
 * description: Мастер добавляет отпуска/больничные/dayoff. Хранятся в blocked_times, автоматически удаляют онлайн-слоты через API /api/slots.
 * created: 2026-04-13
 * updated: 2026-04-13
 * --- */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Calendar as CalendarIcon, Plus, Trash2, Plane } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { humanizeError } from '@/lib/format/error';

interface BlockRow {
  id: string;
  starts_at: string;
  ends_at: string;
  reason: string | null;
}

export default function TimeOffPage() {
  const { master } = useMaster();
  const [blocks, setBlocks] = useState<BlockRow[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('Отпуск');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!master?.id) return;
    const supabase = createClient();
    const { data } = await supabase
      .from('blocked_times')
      .select('id, starts_at, ends_at, reason')
      .eq('master_id', master.id)
      .order('starts_at', { ascending: false });
    setBlocks((data ?? []) as BlockRow[]);
  }, [master?.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function add() {
    if (!master?.id || !startDate || !endDate) {
      toast.error('Укажи даты');
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from('blocked_times').insert({
      master_id: master.id,
      starts_at: new Date(`${startDate}T00:00:00`).toISOString(),
      ends_at: new Date(`${endDate}T23:59:59`).toISOString(),
      reason: reason.trim() || 'Выходной',
    });
    setSaving(false);
    if (error) {
      toast.error(humanizeError(error));
      return;
    }
    toast.success('Период добавлен');
    setStartDate('');
    setEndDate('');
    setReason('Отпуск');
    load();
  }

  async function remove(id: string) {
    const supabase = createClient();
    await supabase.from('blocked_times').delete().eq('id', id);
    setBlocks((p) => p.filter((x) => x.id !== id));
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Plane className="h-6 w-6 text-primary" />
          Отпуска и выходные
        </h1>
        <p className="text-sm text-muted-foreground">
          Добавь периоды когда ты недоступен — слоты автоматически исчезнут из онлайн-записи.
        </p>
      </div>

      <div className="space-y-3 rounded-lg border bg-card p-5">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-1">
            <Label>Начало</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Конец</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Причина</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={add} disabled={saving}>
            <Plus className="mr-1 h-4 w-4" />
            {saving ? '...' : 'Добавить'}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Запланированные периоды</h2>
        {blocks.length === 0 ? (
          <p className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
            Пока нет заблокированных периодов.
          </p>
        ) : (
          blocks.map((b) => {
            const start = new Date(b.starts_at);
            const end = new Date(b.ends_at);
            const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000));
            return (
              <div
                key={b.id}
                className="flex items-center justify-between rounded-lg border bg-card p-4"
              >
                <div className="flex items-center gap-3">
                  <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="text-sm font-medium">{b.reason ?? 'Выходной'}</div>
                    <div className="text-xs text-muted-foreground">
                      {start.toLocaleDateString()} – {end.toLocaleDateString()} · {days} дн.
                    </div>
                  </div>
                </div>
                <Button size="icon" variant="ghost" onClick={() => remove(b.id)}>
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
