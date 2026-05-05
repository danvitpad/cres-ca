/** --- YAML
 * name: MiniAppBonusesPage
 * description: Mini App wallet/bonuses — referral invite only.
 *              Balance + loyalty sections temporarily hidden.
 * created: 2026-04-19
 * updated: 2026-05-05
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Copy, Check, Share2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { useTelegram } from '@/components/miniapp/telegram-provider';

export default function MiniAppBonusesPage() {
  const { userId } = useAuthStore();
  const { haptic } = useTelegram();
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const supabase = createClient();
      const { data: profile } = await supabase
        .from('profiles')
        .select('referral_code, public_id')
        .eq('id', userId)
        .maybeSingle();
      setReferralCode(profile?.referral_code ?? profile?.public_id ?? null);
    })();
  }, [userId]);

  function buildLink() {
    const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;
    if (botUsername && referralCode) return `https://t.me/${botUsername}?startapp=r_${referralCode}`;
    if (typeof window !== 'undefined' && referralCode) return `${window.location.origin}/ref/${referralCode}`;
    return '';
  }

  function copyReferral() {
    const link = buildLink();
    if (!link) return;
    navigator.clipboard.writeText(link);
    haptic('success');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function shareReferral() {
    const link = buildLink();
    if (!link) return;
    haptic('light');
    const text = 'Присоединяйся к CRES-CA — получи бонус на первую запись';
    const tg = window.Telegram?.WebApp;
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(
        `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`,
      );
    } else if (navigator.share) {
      navigator.share({ title: 'CRES-CA', url: link, text }).catch(() => {});
    } else {
      copyReferral();
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-5 px-5 pt-6"
    >
      {/* Referral invite buttons */}
      <div className="flex gap-2">
        <button
          onClick={shareReferral}
          disabled={!referralCode}
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-white py-3.5 text-[14px] font-semibold text-black active:bg-white/80 transition-colors disabled:opacity-50"
        >
          <Share2 className="size-4" />
          Пригласить друга
        </button>
        <button
          onClick={copyReferral}
          disabled={!referralCode}
          className="flex w-[56px] items-center justify-center rounded-2xl border border-neutral-200 bg-white active:bg-neutral-50 transition-colors disabled:opacity-50"
          aria-label="Скопировать ссылку"
        >
          {copied ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
        </button>
      </div>

      {/* Balance, loyalty breakdown, stats — HIDDEN: temporarily disabled */}

      <div className="h-4" />
    </motion.div>
  );
}
