/** --- YAML
 * name: MiniAppBonusesPage
 * description: Mini App wallet/bonuses — total balance + per-master breakdown (unified loyalty system).
 *              Each master is a separate balance card; client knows points are usable only at that master.
 * created: 2026-04-19
 * updated: 2026-04-26
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Copy, Check, Share2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { useTelegram } from '@/components/miniapp/telegram-provider';
import { HelpHint } from '@/components/shared/help-hint';

interface MasterBalance {
  master_id: string;
  balance: number;
  master_name: string | null;
  master_avatar: string | null;
}

export default function MiniAppBonusesPage() {
  const { userId } = useAuthStore();
  const { haptic } = useTelegram();
  const [totalBalance, setTotalBalance] = useState(0);
  const [perMaster, setPerMaster] = useState<MasterBalance[]>([]);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [invitedCount, setInvitedCount] = useState(0);
  const [earnedTotal, setEarnedTotal] = useState(0);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const supabase = createClient();

      // Per-master loyalty balances (unified system)
      const { data: balances } = await supabase
        .from('loyalty_balances')
        .select('master_id, balance, masters(display_name, profile_id, profiles:profiles!masters_profile_id_fkey(full_name, avatar_url))')
        .eq('profile_id', userId)
        .gt('balance', 0);
      const list = (balances ?? []) as unknown as Array<{
        master_id: string;
        balance: number;
        masters: {
          display_name: string | null;
          profiles: { full_name: string | null; avatar_url: string | null } | null;
        } | null;
      }>;
      const masters: MasterBalance[] = list.map((b) => ({
        master_id: b.master_id,
        balance: Number(b.balance),
        master_name: b.masters?.display_name ?? b.masters?.profiles?.full_name ?? null,
        master_avatar: b.masters?.profiles?.avatar_url ?? null,
      }));
      setPerMaster(masters);
      setTotalBalance(masters.reduce((s, m) => s + m.balance, 0));

      // Referral code (independent flow)
      const { data: profile } = await supabase
        .from('profiles')
        .select('referral_code, public_id')
        .eq('id', userId)
        .maybeSingle();
      setReferralCode(profile?.referral_code ?? profile?.public_id ?? null);

      const { data: refs } = await supabase
        .from('referrals')
        .select('id, bonus_points')
        .eq('referrer_profile_id', userId);
      const refList = refs ?? [];
      setInvitedCount(refList.length);
      setEarnedTotal(refList.reduce((s, r) => s + Number(r.bonus_points ?? 0), 0));
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
          className="flex w-[56px] items-center justify-center rounded-2xl border border-neutral-200 bg-white active:bg-neutral-50 transition-colors disabled:opacity-50"
          aria-label="Скопировать ссылку"
        >
          {copied ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
        </button>
      </div>

      {/* Total balance */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Всего бонусов</p>
              <HelpHint title="Бонусы лояльности — как это работает" size={12}>
                <p><b>Один кошелёк, не два.</b> Это <b>не настоящие деньги</b> — это баллы лояльности. Их нельзя вывести, перевести другу, обменять на ₴. Только применить как скидку на следующий визит.</p>
                <p><b>Откуда баллы:</b> мастер сам настраивает программу — «5% от чека после визита». Сделал стрижку за 600 ₴ → +30 баллов на твой счёт у этого мастера.</p>
                <p><b>1 балл = 1 ₴ скидки.</b> Это просто правило конверсии при оплате — не вторая валюта.</p>
                <p><b>Привязка к мастеру.</b> Накопил 50 баллов у Маши — потратить можно только у Маши, не у Ивана.</p>
                <p><b>Сколько можно списать за визит.</b> Мастер ограничивает — обычно не больше 50% от чека. То есть на услугу 600 ₴ можно применить максимум 300 баллов, остаток — деньгами. Это защищает мастера от случая «пришёл с 1000 баллов на услугу за 100 ₴ → ушёл бесплатно».</p>
                <p><b>Цена не упадёт ниже расходников.</b> Если у мастера в услуге заполнены материалы (шампунь, лак, перчатки) — бонусы не смогут опустить финальную цену ниже их себестоимости. Иначе мастер бы работал в минус.</p>
                <p><b>Промокод vs бонусы.</b> При записи можно применить только одно — что выгоднее. Второе сохраняется на следующий раз.</p>
                <p><b>Пригласи друга.</b> Личная ссылка — кнопка выше. Друг сделает первую запись и придёт → тебе упадёт реферальный бонус (мастер сам настраивает сумму).</p>
                <p><b>Срок жизни.</b> Баллы живут 6 месяцев (мастер может поменять). За 7 дней до сгорания придёт напоминание.</p>
              </HelpHint>
            </div>
            <p className="mt-2 text-5xl font-bold tabular-nums">
              {loading ? '—' : totalBalance.toFixed(0)}
            </p>
            <p className="mt-1 text-[11px] text-neutral-600">1 балл = 1 ₴ скидки у мастера, который начислил</p>
          </div>
          <div className="flex size-12 items-center justify-center rounded-2xl border border-neutral-200 bg-white">
            <Sparkles className="size-6 text-amber-600" />
          </div>
        </div>
      </div>

      {/* Per-master breakdown */}
      {perMaster.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500 px-1">Разбивка по мастерам</p>
          {perMaster.map((m) => (
            <div
              key={m.master_id}
              className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-3"
            >
              <div className="flex size-10 items-center justify-center rounded-full bg-white/[0.05] text-[12px] font-semibold uppercase">
                {m.master_avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.master_avatar} alt="" className="size-10 rounded-full object-cover" />
                ) : (
                  (m.master_name ?? '?').charAt(0)
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{m.master_name ?? 'Мастер'}</p>
                <p className="text-[11px] text-neutral-500">баланс действует только у этого мастера</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold tabular-nums">{m.balance.toFixed(0)}</p>
                <p className="text-[10px] text-neutral-400">баллов</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && totalBalance === 0 && (
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 text-center">
          <p className="text-sm text-neutral-600">У тебя пока нет бонусов</p>
          <p className="text-[11px] text-neutral-400 mt-1">
            Бонусы начисляются автоматически после визита, если у мастера включена программа лояльности
          </p>
        </div>
      )}

      {/* Referral stats (only when non-zero) */}
      {invitedCount > 0 && (
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl border border-neutral-200 bg-white p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Приглашено</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{invitedCount}</p>
          </div>
          <div className="rounded-2xl border border-neutral-200 bg-white p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Заработано</p>
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
