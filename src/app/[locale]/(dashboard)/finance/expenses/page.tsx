/** --- YAML
 * name: Expenses Page
 * description: Список расходов мастера + форма добавления с OCR по фото чека (OpenRouter Vision).
 * created: 2026-04-14
 * updated: 2026-04-14
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Receipt, Plus, Camera, Loader2, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Expense {
  id: string;
  date: string;
  amount: number;
  currency: string;
  category: string | null;
  description: string | null;
  vendor: string | null;
}

const CATEGORIES = ['Расходники', 'Аренда', 'Еда', 'Транспорт', 'Коммунальные', 'Реклама', 'Оборудование', 'Прочее'];

export default function ExpensesPage() {
  const { userId } = useAuthStore();
  const [items, setItems] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('UAH');
  const [category, setCategory] = useState('Прочее');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [vendor, setVendor] = useState('');
  const [ocrBusy, setOcrBusy] = useState(false);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('expenses')
        .select('id, date, amount, currency, category, description, vendor')
        .eq('profile_id', userId)
        .order('date', { ascending: false })
        .limit(50);
      setItems((data ?? []) as Expense[]);
      setLoading(false);
    })();
  }, [userId]);

  async function ocrUpload(file: File) {
    setOcrBusy(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch('/api/expenses/parse-receipt', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? 'OCR failed');
        return;
      }
      const r = json.result as { amount?: number; currency?: string; vendor?: string; date?: string; category?: string };
      if (r.amount) setAmount(String(r.amount));
      if (r.currency) setCurrency(r.currency);
      if (r.vendor) setVendor(r.vendor);
      if (r.date) setDate(r.date);
      if (r.category && CATEGORIES.includes(r.category)) setCategory(r.category);
      toast.success('Чек распознан');
    } catch {
      toast.error('Ошибка распознавания');
    } finally {
      setOcrBusy(false);
    }
  }

  async function add() {
    if (!userId || !amount) return;
    const supabase = createClient();
    const { data, error } = await supabase
      .from('expenses')
      .insert({
        profile_id: userId,
        date,
        amount: Number(amount),
        currency,
        category,
        vendor: vendor || null,
      })
      .select('id, date, amount, currency, category, description, vendor')
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    setItems((prev) => [data as Expense, ...prev]);
    setAmount('');
    setVendor('');
    toast.success('Расход добавлен');
  }

  async function remove(id: string) {
    const supabase = createClient();
    await supabase.from('expenses').delete().eq('id', id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Receipt className="h-6 w-6 text-primary" />
          Расходы
        </h1>
        <p className="text-sm text-muted-foreground">Сфотографируй чек — мы распознаем сумму автоматически.</p>
      </div>

      <div className="rounded-lg border bg-card p-5 space-y-3">
        <div className="flex items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-50">
            {ocrBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            {ocrBusy ? 'Распознаём…' : 'Сфоткать чек'}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) ocrUpload(f);
              }}
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <Label>Сумма</Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <Label>Валюта</Label>
            <Input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} />
          </div>
          <div>
            <Label>Дата</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label>Категория</Label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <Label>Поставщик / место</Label>
          <Input value={vendor} onChange={(e) => setVendor(e.target.value)} />
        </div>

        <Button onClick={add} disabled={!amount}>
          <Plus className="mr-1 h-4 w-4" /> Добавить
        </Button>
      </div>

      <div className="rounded-lg border bg-card p-5">
        <div className="mb-3 text-sm font-semibold">История</div>
        {loading ? (
          <div className="text-sm text-muted-foreground">Загрузка…</div>
        ) : items.length === 0 ? (
          <div className="text-sm text-muted-foreground">Пока нет записей.</div>
        ) : (
          <div className="space-y-2">
            {items.map((e) => (
              <div key={e.id} className="flex items-center justify-between rounded-md border p-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium">
                    {Number(e.amount).toLocaleString()} {e.currency}
                    {e.category && <span className="ml-2 text-xs text-muted-foreground">· {e.category}</span>}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {e.date}
                    {e.vendor && ` · ${e.vendor}`}
                  </div>
                </div>
                <button onClick={() => remove(e.id)} className="text-muted-foreground hover:text-destructive" aria-label="delete">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
