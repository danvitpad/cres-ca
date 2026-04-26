/** --- YAML
 * name: LoyaltyCreditButton
 * description: Master-side widget in the client card hero. Shows current per-master
 *              loyalty balance for this client and opens an inline form for manual
 *              adjustment (credit or debit) with an optional note. Calls the
 *              master_adjust_loyalty RPC which writes the audit row + updates
 *              loyalty_balances atomically. RLS guarantees only the owning master
 *              can call this.
 * created: 2026-04-26
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Sparkles, Plus, Minus, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface Props {
  masterId: string;
  profileId: string | null;
  /**
   * Optional callback so the parent client card can refetch its summary
   * (e.g. to invalidate any other places that show the bonus balance).
   */
  onChanged?: () => void;
}

export function LoyaltyCreditButton({ masterId, profileId, onChanged }: Props) {
  const [balance, setBalance] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!profileId) return;
    const supabase = createClient();
    supabase
      .from('loyalty_balances')
      .select('balance')
      .eq('master_id', masterId)
      .eq('profile_id', profileId)
      .maybeSingle()
      .then(({ data }) => {
        setBalance(Number((data as { balance?: number } | null)?.balance ?? 0));
      });
  }, [masterId, profileId]);

  if (!profileId) return null;

  async function applyDelta(sign: 1 | -1) {
    const num = Math.abs(Number(amount));
    if (!num || Number.isNaN(num)) {
      toast.error('Введи сумму');
      return;
    }
    if (!profileId) return;
    setBusy(true);
    const supabase = createClient();
    const { data, error } = await supabase.rpc('master_adjust_loyalty', {
      p_master_id: masterId,
      p_profile_id: profileId,
      p_amount: sign * num,
      p_note: note.trim() || null,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const applied = Number(data ?? 0);
    setBalance((b) => Math.max(0, (b ?? 0) + applied));
    setAmount('');
    setNote('');
    setOpen(false);
    toast.success(applied > 0 ? `Начислено ${applied} ₴` : `Списано ${Math.abs(applied)} ₴`);
    onChanged?.();
  }

  return (
    <div className="relative flex-shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted/50 transition-colors"
        title="Начислить или списать бонусы клиента"
      >
        <Sparkles className="h-3.5 w-3.5 text-amber-500" />
        <span className="tabular-nums">{balance ?? '…'}</span>
        <span className="text-muted-foreground">₴ бонусов</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-[280px] rounded-xl border border-border bg-popover p-3 shadow-lg">
          <div className="flex items-start justify-between mb-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Скорректировать баланс
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="p-0.5 rounded hover:bg-muted text-muted-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
          <div className="space-y-2">
            <input
              type="number"
              min={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Сумма (₴)"
              className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus:border-primary"
            />
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Комментарий (необязательно)"
              className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs outline-none focus:border-primary"
              maxLength={140}
            />
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => applyDelta(1)}
                disabled={busy || !amount}
                className="flex-1 inline-flex items-center justify-center gap-1 rounded-md bg-primary px-2 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                <Plus className="h-3 w-3" />
                Начислить
              </button>
              <button
                type="button"
                onClick={() => applyDelta(-1)}
                disabled={busy || !amount}
                className="flex-1 inline-flex items-center justify-center gap-1 rounded-md border border-border bg-background px-2 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-50"
              >
                <Minus className="h-3 w-3" />
                Списать
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground leading-tight">
              Запись попадёт в журнал лояльности с пометкой «manual_adjustment».
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
