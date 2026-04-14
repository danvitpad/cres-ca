/** --- YAML
 * name: Client Debt Banner
 * description: Показывает задолженность клиента по прошлым визитам. Fetchает completed appointments - сумма payments.
 * created: 2026-04-13
 * updated: 2026-04-13
 * --- */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface Props {
  clientId: string;
  masterId: string;
  locale?: string;
}

interface DebtVisit {
  id: string;
  price: number;
  paid: number;
  starts_at: string;
}

export function ClientDebtBanner({ clientId, masterId, locale = 'ru' }: Props) {
  const [visits, setVisits] = useState<DebtVisit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clientId || !masterId) return;
    const supabase = createClient();
    (async () => {
      const { data: apts } = await supabase
        .from('appointments')
        .select('id, price, starts_at, payments(amount, status, type)')
        .eq('client_id', clientId)
        .eq('master_id', masterId)
        .eq('status', 'completed')
        .order('starts_at', { ascending: false })
        .limit(30);

      const result: DebtVisit[] = [];
      for (const a of (apts ?? []) as unknown as {
        id: string;
        price: number | null;
        starts_at: string;
        payments: { amount: number | null; status: string; type: string }[] | null;
      }[]) {
        const paid = (a.payments ?? [])
          .filter((p) => p.status === 'success' && p.type !== 'refund')
          .reduce((acc, p) => acc + Number(p.amount ?? 0), 0);
        const price = Number(a.price ?? 0);
        if (price - paid > 0.01) {
          result.push({ id: a.id, price, paid, starts_at: a.starts_at });
        }
      }
      setVisits(result);
      setLoading(false);
    })();
  }, [clientId, masterId]);

  if (loading || visits.length === 0) return null;

  const totalDebt = visits.reduce((acc, v) => acc + (v.price - v.paid), 0);

  return (
    <div className="rounded-lg border border-amber-500/60 bg-amber-50 p-4 dark:bg-amber-950/20">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-amber-900 dark:text-amber-200">
            Должен за прошлые визиты: {totalDebt.toFixed(0)} ₴
          </div>
          <div className="mt-2 space-y-1 text-sm text-amber-900/80 dark:text-amber-200/80">
            {visits.slice(0, 3).map((v) => (
              <div key={v.id} className="flex items-center justify-between gap-2">
                <span className="truncate">
                  {new Date(v.starts_at).toLocaleDateString('ru-RU')} · оплачено {v.paid.toFixed(0)} из {v.price.toFixed(0)}
                </span>
                <Link
                  href={`/${locale}/finance/split/${v.id}`}
                  className="shrink-0 rounded-md bg-amber-600 px-2 py-1 text-xs font-medium text-white hover:bg-amber-700"
                >
                  Доплатить
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
