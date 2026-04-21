/** --- YAML
 * name: MasterMiniAppSettings/Billing
 * description: Mobile plan overview. Read-only summary + upgrade CTA that opens web page (Stripe/payment UI too heavy for WebView).
 * created: 2026-04-20
 * --- */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Crown, Clock, ArrowSquareOut, Check } from '@phosphor-icons/react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { SettingsShell } from '@/components/miniapp/settings-shell';

interface SubRow {
  tier: string;
  status: string;
  trial_ends_at: string | null;
  current_period_end: string | null;
}

const TIER_LABEL: Record<string, string> = {
  trial: 'Триал',
  starter: 'Старт',
  pro: 'Про',
  business: 'Бизнес',
};

const TIER_COLOR: Record<string, string> = {
  trial: 'from-violet-500/25 to-violet-500/5',
  starter: 'from-sky-500/25 to-sky-500/5',
  pro: 'from-amber-500/25 to-amber-500/5',
  business: 'from-rose-500/25 to-rose-500/5',
};

const FEATURES: Record<string, string[]> = {
  trial: ['Все функции PRO', 'На 14 дней', 'Без карты'],
  starter: ['До 30 клиентов', 'Календарь + финансы', 'Email-напоминания'],
  pro: ['Безлимит клиентов', 'Голосовой AI', 'Заказы поставщикам', 'Отчёты'],
  business: ['Всё из PRO', 'Salon/Team режим', 'Несколько мастеров'],
};

export default function MiniAppBillingPage() {
  const { userId } = useAuthStore();
  const [sub, setSub] = useState<SubRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('subscriptions')
        .select('tier, status, trial_ends_at, current_period_end')
        .eq('profile_id', userId)
        .maybeSingle();
      setSub(data as SubRow | null);
      setLoading(false);
    })();
  }, [userId]);

  const tier = sub?.tier ?? 'trial';
  const endsAt = tier === 'trial' ? sub?.trial_ends_at : sub?.current_period_end;
  const daysLeft = endsAt
    ? Math.max(0, Math.ceil((new Date(endsAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
    : null;

  return (
    <SettingsShell title="Тариф и платежи">
      {loading ? (
        <div className="h-32 w-full animate-pulse rounded-2xl bg-white/[0.04]" />
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className={`relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br ${TIER_COLOR[tier] ?? TIER_COLOR.trial} p-5`}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/60">Текущий тариф</p>
              <p className="mt-1 text-2xl font-bold tracking-tight">{TIER_LABEL[tier] ?? tier}</p>
            </div>
            <div className="flex size-11 items-center justify-center rounded-xl border border-white/10 bg-white/10">
              <Crown size={22} weight="fill" className="text-amber-300" />
            </div>
          </div>
          {daysLeft !== null && (
            <div className="mt-4 flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[11px] text-white/80 w-fit">
              <Clock size={12} weight="bold" />
              {tier === 'trial'
                ? `Триал: осталось ${daysLeft} дн.`
                : `Продлится через ${daysLeft} дн.`}
            </div>
          )}
        </motion.div>
      )}

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-white/50 mb-2">Что входит</p>
        <ul className="space-y-2">
          {(FEATURES[tier] ?? FEATURES.trial).map((f, i) => (
            <li key={i} className="flex items-start gap-2 text-[13px] text-white/85">
              <Check size={14} weight="bold" className="mt-0.5 shrink-0 text-emerald-300" />
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </div>

      <Link
        href="/ru/settings/billing"
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-violet-500/30 bg-violet-500/15 py-3.5 text-[14px] font-semibold text-violet-100 active:bg-violet-500/25 transition-colors"
      >
        {tier === 'trial' ? 'Выбрать тариф' : 'Управление подпиской'}
        <ArrowSquareOut size={14} weight="bold" />
      </Link>
      <p className="text-center text-[11px] text-white/40 -mt-2">
        Откроется веб-версия для оплаты — Telegram не поддерживает платёжные формы в Mini App.
      </p>
    </SettingsShell>
  );
}
