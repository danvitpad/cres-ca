/** --- YAML
 * name: TrialBadge
 * description: Бейдж обратного отсчёта пробного периода для dashboard header. Кликабельный, ведёт на /settings/billing. Скрыт если тариф не trial или trial завершён.
 * created: 2026-04-13
 * updated: 2026-04-13
 * --- */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Clock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';

export function TrialBadge() {
  const t = useTranslations('billing');
  const { userId } = useAuthStore();
  const [daysLeft, setDaysLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    (async () => {
      const { data } = await supabase
        .from('subscriptions')
        .select('tier, trial_ends_at')
        .eq('profile_id', userId)
        .maybeSingle();
      if (data && data.tier === 'trial' && data.trial_ends_at) {
        const ms = new Date(data.trial_ends_at).getTime() - Date.now();
        setDaysLeft(Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24))));
      }
    })();
  }, [userId]);

  if (daysLeft === null) return null;

  const urgent = daysLeft <= 3;

  return (
    <Link
      href="/settings/billing"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        height: 32,
        padding: '0 12px',
        borderRadius: 999,
        fontSize: 13,
        fontWeight: 600,
        textDecoration: 'none',
        backgroundColor: urgent ? '#fef3c7' : '#f0fdfa',
        color: urgent ? '#b45309' : '#115e59',
        border: `1px solid ${urgent ? '#fcd34d' : '#5eead4'}`,
        whiteSpace: 'nowrap',
      }}
    >
      <Clock style={{ width: 14, height: 14 }} />
      {t('trialDaysLeft', { days: daysLeft })}
    </Link>
  );
}
