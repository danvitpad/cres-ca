/** --- YAML
 * name: Payment return page
 * description: LiqPay redirects here after checkout. Displays current intent status from our DB
 *              (state may still be pending if callback hasn't arrived yet — we poll once).
 * created: 2026-04-24
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

interface IntentState {
  id: string;
  status: 'pending' | 'held' | 'released' | 'captured' | 'refunded' | 'failed' | 'expired';
  amount: number;
  currency: string;
  appointment_id: string | null;
}

export default function PaymentReturnPage() {
  const sp = useSearchParams();
  const router = useRouter();
  const intentId = sp?.get('i');
  const [state, setState] = useState<IntentState | null>(null);
  const [polling, setPolling] = useState(true);

  useEffect(() => {
    if (!intentId) return;
    let tries = 0;
    let cancelled = false;

    const poll = async () => {
      while (!cancelled && tries < 10) {
        try {
          const res = await fetch(`/api/payments/deposit/${intentId}/status`);
          if (res.ok) {
            const d = (await res.json()) as IntentState;
            setState(d);
            if (d.status === 'held' || d.status === 'failed' || d.status === 'expired') {
              setPolling(false);
              return;
            }
          }
        } catch {
          /* noop */
        }
        tries++;
        await new Promise((r) => setTimeout(r, 2000));
      }
      setPolling(false);
    };

    poll();
    return () => {
      cancelled = true;
    };
  }, [intentId]);

  if (!intentId) {
    return <Centered><p>Нет идентификатора платежа.</p></Centered>;
  }

  if (polling || !state) {
    return (
      <Centered>
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="mt-3 text-sm text-muted-foreground">Проверяем статус оплаты…</p>
      </Centered>
    );
  }

  if (state.status === 'held' || state.status === 'released') {
    return (
      <Centered>
        <div className="mb-4 grid size-16 place-items-center rounded-full bg-emerald-500/10">
          <CheckCircle2 className="size-10 text-emerald-500" />
        </div>
        <h1 className="text-2xl font-bold">Оплата прошла</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Предоплата {state.amount} {state.currency} зафиксирована. Запись подтверждена.
        </p>
        <button
          onClick={() => router.push('/history')}
          className="mt-6 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          К моим записям
        </button>
      </Centered>
    );
  }

  return (
    <Centered>
      <div className="mb-4 grid size-16 place-items-center rounded-full bg-rose-500/10">
        <AlertCircle className="size-10 text-rose-500" />
      </div>
      <h1 className="text-2xl font-bold">Оплата не прошла</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Статус: {state.status}. Попробуй ещё раз или свяжись с мастером.
      </p>
      <button
        onClick={() => router.back()}
        className="mt-6 rounded-full border border-border bg-background px-5 py-2.5 text-sm font-medium"
      >
        Назад
      </button>
    </Centered>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center p-6 text-center">
      {children}
    </div>
  );
}
