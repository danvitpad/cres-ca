/** --- YAML
 * name: MiniAppBonusesPage
 * description: Mini App wallet/bonuses — balance, referral share, earn tips, invited count. Parity with Web /wallet (Phase 12).
 * created: 2026-04-19
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Copy, Check, Share2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { useTelegram } from '@/components/miniapp/telegram-provider';

export default function MiniAppBonusesPage() {
  const { userId } = useAuthStore();
  const { haptic } = useTelegram();
  const [bonusPoints, setBonusPoints] = useState(0);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [invitedCount, setInvitedCount] = useState(0);
  const [earnedTotal, setEarnedTotal] = useState(0);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const supabase = createClient();
      const { data: profile } = await supabase
        .from('profiles')
        .select('bonus_points, referral_code, public_id')
        .eq('id', userId)
        .maybeSingle();
      setBonusPoints(Number(profile?.bonus_points ?? 0));
      setReferralCode(profile?.referral_code ?? profile?.public_id ?? null);

      const { data: refs } = await supabase
        .from('referrals')
        .select('id, bonus_points')
        .eq('referrer_profile_id', userId);
      const list = refs ?? [];
      setInvitedCount(list.length);
      setEarnedTotal(list.reduce((s, r) => s + Number(r.bonus_points ?? 0), 0));
      setLoading(false);
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
      {/* Share buttons — Invite first (per user order) */}
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
          className="flex w-[56px] items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] active:bg-white/[0.06] transition-colors disabled:opacity-50"
          aria-label="Скопировать ссылку"
        >
          {copied ? <Check className="size-4 text-emerald-300" /> : <Copy className="size-4" />}
        </button>
      </div>

      {/* Balance */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-white/50">Баланс бонусов</p>
            <p className="mt-2 text-5xl font-bold tabular-nums">
              {loading ? '—' : bonusPoints.toFixed(0)}
            </p>
            <p className="mt-1 text-[11px] text-amber-300/80">Программа лояльности обновляется — скоро вернём возможность тратить</p>
          </div>
          <div className="flex size-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03]">
            <Sparkles className="size-6 text-amber-300" />
          </div>
        </div>
      </div>

      {/* Referral stats (only when non-zero) */}
      {invitedCount > 0 && (
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-white/50">Приглашено</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{invitedCount}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-white/50">Заработано</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">
              {earnedTotal.toFixed(0)}
            </p>
          </div>
        </div>
      )}

      <div className="h-4" />
    </motion.div>
  );
}
