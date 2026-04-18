/** --- YAML
 * name: RecurringExpensesTab
 * description: Manages recurring monthly expenses (rent, utilities, subscriptions). Cron /api/cron/recurring-expenses posts rows into expenses on the configured day_of_month.
 * created: 2026-04-17
 * updated: 2026-04-17
 * --- */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2, Pause, Play, Repeat } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';
import { usePageTheme, FONT, FONT_FEATURES, CURRENCY } from '@/lib/dashboard-theme';
import { useConfirm } from '@/hooks/use-confirm';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
// (Select removed — category is now a free-text Input with datalist; frequency uses a native <select>.)

type Frequency = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

interface RecurringExpense {
  id: string;
  name: string;
  amount: number;
  currency: string;
  category: string;
  day_of_month: number;
  frequency: Frequency;
  active: boolean;
  last_posted_date: string | null;
}

const CATEGORY_SUGGESTIONS = ['Аренда', 'Коммунальные', 'Подписки', 'Интернет', 'Связь', 'Реклама', 'Прочее'];

const FREQUENCY_OPTIONS: { key: Frequency; label: string }[] = [
  { key: 'weekly',    label: 'Еженедельно' },
  { key: 'monthly',   label: 'Ежемесячно' },
  { key: 'quarterly', label: 'Ежеквартально' },
  { key: 'yearly',    label: 'Ежегодно' },
];

export function RecurringExpensesTab() {
  const { master } = useMaster();
  const { C } = usePageTheme();
  const confirm = useConfirm();
  const [items, setItems] = useState<RecurringExpense[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state for new
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [frequency, setFrequency] = useState<Frequency>('monthly');
  const [day, setDay] = useState('1');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!master) return;
    const supabase = createClient();
    const { data } = await supabase
      .from('recurring_expenses')
      .select('id, name, amount, currency, category, day_of_month, frequency, active, last_posted_date')
      .eq('master_id', master.id)
      .order('day_of_month');
    setItems((data || []) as RecurringExpense[]);
    setLoading(false);
  }, [master]);

  useEffect(() => {
    load();
  }, [load]);

  async function addItem() {
    if (!master || !name.trim() || !amount) return;
    setSaving(true);
    const supabase = createClient();
    const cleanCat = category.trim() || 'Прочее';
    const { error } = await supabase.from('recurring_expenses').insert({
      master_id: master.id,
      name: name.trim(),
      amount: Number(amount),
      currency: 'UAH',
      category: cleanCat,
      frequency,
      day_of_month: Math.max(1, Math.min(28, parseInt(day) || 1)),
      active: true,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Постоянный расход добавлен');
    setName(''); setAmount(''); setCategory(''); setFrequency('monthly'); setDay('1');
    setShowForm(false);
    load();
  }

  async function removeItem(id: string, name: string) {
    if (!(await confirm({ title: `Удалить "${name}"?`, description: 'Больше не будет автоматически списываться ежемесячно.', confirmLabel: 'Удалить', destructive: true }))) return;
    const supabase = createClient();
    const { error } = await supabase.from('recurring_expenses').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Удалено');
    load();
  }

  async function toggleActive(id: string, current: boolean) {
    const supabase = createClient();
    const { error } = await supabase.from('recurring_expenses').update({ active: !current }).eq('id', id);
    if (error) { toast.error(error.message); return; }
    load();
  }

  if (loading) {
    return <div style={{ padding: 40, color: C.textSecondary, textAlign: 'center' }}>Загрузка...</div>;
  }

  const inputCls = 'border border-input focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40';
  const labelCls = 'text-xs font-semibold uppercase tracking-wide text-muted-foreground';

  return (
    <div style={{ fontFamily: FONT, fontFeatureSettings: FONT_FEATURES, color: C.text }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 650, margin: 0, letterSpacing: '-0.3px' }}>
            Постоянные расходы
          </h2>
          <p style={{ fontSize: 13, color: C.textSecondary, margin: '4px 0 0' }}>
            Аренда, коммуналка, подписки — автоматически списываются ежемесячно.
          </p>
        </div>
        <Button onClick={() => setShowForm(v => !v)}>
          <Plus size={14} style={{ marginRight: 6 }} />
          {showForm ? 'Отмена' : 'Добавить'}
        </Button>
      </div>

      {/* Inline add form */}
      {showForm && (
        <div style={{
          background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 14, padding: 20, marginBottom: 20,
        }}>
          <div className="grid gap-4" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr' }}>
            <div className="space-y-1.5">
              <Label className={labelCls}>Название</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Аренда кабинета" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <Label className={labelCls}>Сумма, ₴</Label>
              <Input type="number" min={0} step="1" value={amount} onChange={e => setAmount(e.target.value)} placeholder="8000" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <Label className={labelCls}>Категория</Label>
              <Input
                value={category}
                onChange={e => setCategory(e.target.value)}
                placeholder="Аренда / Подписки / своё..."
                list="recurring-expense-categories"
                className={inputCls}
              />
              <datalist id="recurring-expense-categories">
                {CATEGORY_SUGGESTIONS.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div className="space-y-1.5">
              <Label className={labelCls}>Частота</Label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as Frequency)}
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                style={{ color: C.text }}
              >
                {FREQUENCY_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className={labelCls}>День списания</Label>
              <Input type="number" min={1} max={28} value={day} onChange={e => setDay(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowForm(false)}>Отмена</Button>
            <Button onClick={addItem} disabled={saving || !name.trim() || !amount}>
              {saving ? 'Сохранение...' : 'Добавить'}
            </Button>
          </div>
        </div>
      )}

      {/* Items list */}
      {items.length === 0 ? (
        <div style={{
          padding: '56px 20px', textAlign: 'center',
          background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14,
        }}>
          <Repeat size={32} style={{ color: C.textTertiary, opacity: 0.4, margin: '0 auto 12px' }} />
          <p style={{ fontSize: 14, fontWeight: 600, color: C.text, margin: 0 }}>
            Нет постоянных расходов
          </p>
          <p style={{ fontSize: 13, color: C.textSecondary, margin: '4px 0 0' }}>
            Добавьте аренду, коммуналку или подписки — они будут автоматически списываться раз в месяц.
          </p>
        </div>
      ) : (
        <div style={{
          background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14,
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1.5fr 140px 140px 80px 100px',
            padding: '12px 20px', gap: 14, fontSize: 11, fontWeight: 600,
            color: C.textTertiary, letterSpacing: '0.04em', textTransform: 'uppercase',
            borderBottom: `1px solid ${C.border}`,
          }}>
            <span>Название</span>
            <span>Категория</span>
            <span style={{ textAlign: 'right' }}>Сумма</span>
            <span style={{ textAlign: 'center' }}>Число</span>
            <span style={{ textAlign: 'right' }}>Статус</span>
          </div>
          {items.map((it, i) => (
            <div key={it.id} style={{
              display: 'grid', gridTemplateColumns: '1.5fr 140px 140px 80px 100px',
              padding: '14px 20px', gap: 14, alignItems: 'center',
              borderBottom: i < items.length - 1 ? `1px solid ${C.border}` : 'none',
              opacity: it.active ? 1 : 0.5,
            }}>
              <span style={{ fontSize: 14, fontWeight: 550, color: C.text }}>{it.name}</span>
              <span style={{ fontSize: 13, color: C.textSecondary }}>{it.category}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: C.danger, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                −{Number(it.amount).toLocaleString()} {CURRENCY}
              </span>
              <span style={{ fontSize: 13, color: C.textTertiary, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                {it.day_of_month} числа
              </span>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
                <button
                  onClick={() => toggleActive(it.id, it.active)}
                  style={{
                    padding: 6, background: 'transparent', border: 'none', cursor: 'pointer',
                    color: it.active ? C.success : C.textTertiary,
                    borderRadius: 6,
                  }}
                  title={it.active ? 'Приостановить' : 'Возобновить'}
                >
                  {it.active ? <Play size={14} /> : <Pause size={14} />}
                </button>
                <button
                  onClick={() => removeItem(it.id, it.name)}
                  style={{
                    padding: 6, background: 'transparent', border: 'none', cursor: 'pointer',
                    color: C.textTertiary, borderRadius: 6, opacity: 0.5,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = C.danger; }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = '0.5'; e.currentTarget.style.color = C.textTertiary; }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
