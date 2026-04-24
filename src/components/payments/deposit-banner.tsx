/** --- YAML
 * name: Deposit banner
 * description: Shown to client when a booking requires a deposit. One-click to start LiqPay checkout.
 * created: 2026-04-24
 * --- */

'use client';

import { useState } from 'react';
import { Lock, ExternalLink, Loader2, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

interface DepositBannerProps {
  appointmentId: string;
  amount: number;
  currency: string;
  reason: 'service' | 'gray_list' | null;
}

export function DepositBanner({ appointmentId, amount, currency, reason }: DepositBannerProps) {
  const [busy, setBusy] = useState(false);

  const pay = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/payments/deposit/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId }),
      });
      const data = (await res.json().catch(() => ({}))) as { checkoutUrl?: string; error?: string };
      if (res.ok && data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        toast.error(data.error ?? 'Ошибка');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
      <div className="flex items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-full bg-amber-500/15 text-amber-500">
          {reason === 'gray_list' ? <ShieldAlert className="size-5" /> : <Lock className="size-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">Нужна предоплата</h3>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">
            {reason === 'gray_list'
              ? 'У вас были пропуски визитов, поэтому для подтверждения записи нужна предоплата.'
              : 'Мастер просит предоплату для этой услуги. Деньги замораживаются на платформе и переходят мастеру после визита.'}
          </p>
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={pay}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <ExternalLink className="size-4" />}
              Оплатить {amount} {currency}
            </button>
            <span className="text-[11px] text-muted-foreground">Оплата через LiqPay</span>
          </div>
        </div>
      </div>
    </div>
  );
}
