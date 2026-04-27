/** --- YAML
 * name: Split Payments
 * description: Управление split-платежами по визиту. Предоплата + остаток = полная стоимость. Авто-расчёт баланса.
 * created: 2026-04-13
 * updated: 2026-04-13
 * --- */

'use client';

import { use, useCallback, useEffect, useState } from 'react';
import { Receipt, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { humanizeError } from '@/lib/format/error';

interface Appointment {
  id: string;
  price: number;
  currency: string;
  starts_at: string;
  client: { full_name: string | null } | null;
  service: { name: string | null } | null;
}

interface Payment {
  id: string;
  amount: number;
  type: string;
  status: string;
  payment_method: string | null;
  created_at: string;
}

export default function SplitPaymentsPage({ params }: { params: Promise<{ apt_id: string }> }) {
  const { apt_id } = use(params);
  const supabase = createClient();
  const { master } = useMaster();
  const [apt, setApt] = useState<Appointment | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState('');
  const [kind, setKind] = useState<'prepayment' | 'remainder' | 'full'>('prepayment');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'online' | 'other'>('cash');

  const load = useCallback(async () => {
    if (!apt_id) return;
    setLoading(true);
    const [{ data: a }, { data: p }] = await Promise.all([
      supabase
        .from('appointments')
        .select('id, price, currency, starts_at, client:clients(full_name), service:services(name)')
        .eq('id', apt_id)
        .maybeSingle(),
      supabase
        .from('payments')
        .select('id, amount, type, status, payment_method, created_at')
        .eq('appointment_id', apt_id)
        .order('created_at', { ascending: true }),
    ]);
    setApt((a as unknown as Appointment) ?? null);
    setPayments(((p ?? []) as unknown as Payment[]));
    setLoading(false);
  }, [apt_id, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const paidSuccess = payments.filter((p) => (p.status === 'success' || p.status === 'completed') && p.type !== 'refund');
  const totalPaid = paidSuccess.reduce((a, p) => a + Number(p.amount ?? 0), 0);
  const totalDue = Number(apt?.price ?? 0);
  const balance = totalDue - totalPaid;

  async function addPayment() {
    if (!apt || !master?.id || !amount) return;
    const val = Number(amount);
    if (!val || val <= 0) return;
    const { data, error } = await supabase
      .from('payments')
      .insert({
        appointment_id: apt.id,
        master_id: master.id,
        amount: val,
        currency: apt.currency,
        type: kind,
        payment_method: paymentMethod,
        status: 'completed',
      })
      .select('id, amount, type, status, payment_method, created_at')
      .single();
    if (error) {
      toast.error(humanizeError(error));
      return;
    }
    setPayments((prev) => [...prev, data as Payment]);
    setAmount('');
    toast.success('Платёж добавлен');
  }

  function suggest(type: 'prepayment' | 'remainder' | 'full') {
    setKind(type);
    if (type === 'prepayment') setAmount(String(Math.round(totalDue * 0.3)));
    else if (type === 'remainder') setAmount(String(Math.max(0, balance)));
    else setAmount(String(totalDue));
  }

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Загрузка…</div>;
  if (!apt) return <div className="p-6 text-sm text-muted-foreground">Визит не найден.</div>;

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Receipt className="h-6 w-6 text-primary" />
          Split-платежи
        </h1>
        <p className="text-sm text-muted-foreground">
          {apt.service?.name ?? '—'} · {apt.client?.full_name ?? '—'} ·{' '}
          {new Date(apt.starts_at).toLocaleDateString('ru-RU')}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border bg-card p-3">
          <div className="text-xs text-muted-foreground">Стоимость</div>
          <div className="text-lg font-semibold">{totalDue.toFixed(0)} {apt.currency}</div>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <div className="text-xs text-muted-foreground">Оплачено</div>
          <div className="text-lg font-semibold text-emerald-600">{totalPaid.toFixed(0)}</div>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <div className="text-xs text-muted-foreground">Остаток</div>
          <div className={`text-lg font-semibold ${balance > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
            {balance.toFixed(0)}
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-5 space-y-3">
        <div className="text-sm font-semibold">Новый платёж</div>
        <div className="flex gap-2">
          <Button size="sm" variant={kind === 'prepayment' ? 'default' : 'outline'} onClick={() => suggest('prepayment')}>
            Предоплата 30%
          </Button>
          <Button size="sm" variant={kind === 'remainder' ? 'default' : 'outline'} onClick={() => suggest('remainder')}>
            Остаток
          </Button>
          <Button size="sm" variant={kind === 'full' ? 'default' : 'outline'} onClick={() => suggest('full')}>
            Полная сумма
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label>Сумма</Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <Label>Способ оплаты</Label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as 'cash' | 'card' | 'online' | 'other')}
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="cash">Наличные</option>
              <option value="card">Карта</option>
              <option value="online">Онлайн</option>
              <option value="other">Другое</option>
            </select>
          </div>
          <div className="flex items-end">
            <Button onClick={addPayment} disabled={!amount}>
              <Plus className="mr-1 h-4 w-4" /> Добавить платёж
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-5">
        <div className="mb-3 text-sm font-semibold">История платежей</div>
        {payments.length === 0 ? (
          <div className="text-sm text-muted-foreground">Платежей пока нет.</div>
        ) : (
          <div className="space-y-2">
            {payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
                <div>
                  <div className="font-medium">
                    {p.type === 'prepayment' ? 'Предоплата' : p.type === 'remainder' ? 'Остаток' : p.type === 'full' ? 'Полная сумма' : p.type}
                    {p.payment_method && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        ({p.payment_method === 'cash' ? 'Наличные' : p.payment_method === 'card' ? 'Карта' : p.payment_method === 'online' ? 'Онлайн' : p.payment_method})
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(p.created_at).toLocaleString('ru-RU')} · {p.status}
                  </div>
                </div>
                <div className="font-semibold">{Number(p.amount).toFixed(0)} {apt.currency}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
