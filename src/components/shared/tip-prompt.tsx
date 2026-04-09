/** --- YAML
 * name: TipPrompt
 * description: Post-visit tip prompt with quick percentage buttons and custom amount
 * --- */

'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Heart } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

interface TipPromptProps {
  appointmentId: string;
  masterId: string;
  masterName: string;
  servicePrice: number;
  currency: string;
  onClose: () => void;
}

const TIP_PERCENTS = [5, 10, 15] as const;

export function TipPrompt({
  appointmentId,
  masterId,
  masterName,
  servicePrice,
  currency,
  onClose,
}: TipPromptProps) {
  const t = useTranslations('tips');
  const [selectedPercent, setSelectedPercent] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [sending, setSending] = useState(false);

  const tipAmount = selectedPercent
    ? Math.round(servicePrice * selectedPercent / 100)
    : Number(customAmount) || 0;

  async function handleSend() {
    if (tipAmount <= 0) return;
    setSending(true);

    const supabase = createClient();
    const { error } = await supabase.from('payments').insert({
      appointment_id: appointmentId,
      master_id: masterId,
      amount: tipAmount,
      currency,
      type: 'tip',
      status: 'completed',
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(t('thankYou'));
      onClose();
    }
    setSending(false);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="rounded-[var(--radius-card)] border bg-card p-4 shadow-[var(--shadow-elevated)]"
    >
      <div className="flex items-center gap-2 mb-3">
        <Heart className="h-5 w-5 text-pink-500" />
        <p className="text-sm font-semibold">{t('title', { name: masterName })}</p>
      </div>

      {/* Quick percentage buttons */}
      <div className="flex gap-2 mb-3">
        {TIP_PERCENTS.map((pct) => {
          const amount = Math.round(servicePrice * pct / 100);
          return (
            <button
              key={pct}
              onClick={() => { setSelectedPercent(pct); setCustomAmount(''); }}
              className={cn(
                'flex-1 rounded-[var(--radius-button)] border py-2 text-center text-sm font-medium transition-all',
                selectedPercent === pct
                  ? 'border-[var(--ds-accent)] bg-[var(--ds-accent-soft)] text-[var(--ds-accent)]'
                  : 'hover:bg-muted',
              )}
            >
              <div>{pct}%</div>
              <div className="text-xs text-muted-foreground">{amount} {currency}</div>
            </button>
          );
        })}
      </div>

      {/* Custom amount */}
      <div className="mb-3">
        <input
          type="number"
          min={0}
          placeholder={t('customAmount')}
          value={customAmount}
          onChange={(e) => { setCustomAmount(e.target.value); setSelectedPercent(null); }}
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={onClose}
          className="flex-1 rounded-[var(--radius-button)] border py-2 text-sm text-muted-foreground transition-colors hover:bg-muted"
        >
          {t('skip')}
        </button>
        <button
          onClick={handleSend}
          disabled={tipAmount <= 0 || sending}
          className="flex-1 rounded-[var(--radius-button)] bg-[var(--ds-accent)] py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--ds-accent-hover)] disabled:opacity-50"
        >
          {t('send')} {tipAmount > 0 && `${tipAmount} ${currency}`}
        </button>
      </div>
    </motion.div>
  );
}
