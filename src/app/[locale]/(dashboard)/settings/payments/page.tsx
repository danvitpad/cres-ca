/** --- YAML
 * name: Payments settings
 * description: Master enables / disables platform escrow, sets payout provider + account.
 * created: 2026-04-24
 * --- */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Landmark, ShieldCheck, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { humanizeError } from '@/lib/format/error';

export default function PaymentsSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [provider, setProvider] = useState<'liqpay' | 'hutko' | 'monobank'>('liqpay');
  const [account, setAccount] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [requireAfter, setRequireAfter] = useState<number>(2);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: m } = await supabase
        .from('masters')
        .select('escrow_enabled, payout_provider, payout_account, payout_display_name, require_deposit_after_no_show')
        .eq('profile_id', user.id)
        .maybeSingle();
      if (m) {
        setEnabled(!!m.escrow_enabled);
        setProvider((m.payout_provider as 'liqpay' | 'hutko' | 'monobank') ?? 'liqpay');
        setAccount(m.payout_account ?? '');
        setDisplayName(m.payout_display_name ?? '');
        setRequireAfter(m.require_deposit_after_no_show ?? 2);
      }
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase
        .from('masters')
        .update({
          escrow_enabled: enabled,
          payout_provider: provider,
          payout_account: account.trim() || null,
          payout_display_name: displayName.trim() || null,
          require_deposit_after_no_show: requireAfter,
        })
        .eq('profile_id', user.id);
      if (error) {
        toast.error(humanizeError(error));
      } else {
        toast.success('Сохранено');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-10">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6 pb-12">
      <Link href="/settings" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" />
        Настройки
      </Link>

      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Landmark className="size-6 text-primary" />
          Платежи и предоплаты
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Включи платформенное эскроу — клиенты будут оставлять предоплату, которая замораживается на платформе и переходит тебе после визита.
          При no-show деньги останутся у тебя.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="mt-0.5 size-4 accent-primary"
          />
          <div>
            <p className="text-sm font-semibold">Включить эскроу</p>
            <p className="text-[12.5px] text-muted-foreground">
              Клиент видит запрос предоплаты при бронировании услуг, где это требуется. Комиссия платформы — 1.5% с каждого успешно завершённого визита.
            </p>
          </div>
        </label>

        <div className="pt-2">
          <label className="text-sm font-medium">Автопредоплата после N пропусков</label>
          <p className="text-[12px] text-muted-foreground">
            Если клиент пропустил {requireAfter} визит(а) — для новых записей у него автоматически потребуется предоплата.
          </p>
          <input
            type="number"
            min={1}
            max={10}
            value={requireAfter}
            onChange={(e) => setRequireAfter(Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
            className="mt-1.5 w-24 rounded-xl border border-border bg-background p-2 text-sm outline-none focus:border-primary"
          />
        </div>

        <div className="pt-2">
          <label className="text-sm font-medium">Провайдер выплат</label>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as 'liqpay' | 'hutko' | 'monobank')}
            className="mt-1.5 w-full rounded-xl border border-border bg-background p-2 text-sm outline-none focus:border-primary"
          >
            <option value="liqpay">LiqPay</option>
            <option value="monobank">Monobank</option>
            <option value="hutko">Hutko</option>
          </select>
        </div>

        <div>
          <label className="text-sm font-medium">Счёт / карта для выплат</label>
          <input
            type="text"
            value={account}
            onChange={(e) => setAccount(e.target.value)}
            placeholder="UA75 6..."
            className="mt-1.5 w-full rounded-xl border border-border bg-background p-2 text-sm outline-none focus:border-primary"
          />
          <p className="mt-1 text-[11px] text-muted-foreground">IBAN / номер карты / e-wallet. Видно только тебе и суперадмину.</p>
        </div>

        <div>
          <label className="text-sm font-medium">Имя в чеках</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="ФОП Иванов И. или название салона"
            className="mt-1.5 w-full rounded-xl border border-border bg-background p-2 text-sm outline-none focus:border-primary"
          />
        </div>

        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
          Сохранить
        </button>
      </div>

      <div className="rounded-2xl border border-dashed border-border bg-muted/10 p-5 text-[12px] text-muted-foreground">
        <p className="mb-1 font-medium text-foreground">Как работает эскроу:</p>
        <ol className="list-decimal space-y-1 pl-4">
          <li>Клиент записывается → видит кнопку «Оплатить предоплату».</li>
          <li>Оплачивает через LiqPay → деньги замораживаются на платформе.</li>
          <li>Визит состоялся → через 24ч деньги автоматом уходят на твой счёт (минус 1.5% комиссии).</li>
          <li>No-show → вся сумма твоя.</li>
          <li>Отмена за 24+ часа → возврат клиенту.</li>
        </ol>
      </div>
    </div>
  );
}
