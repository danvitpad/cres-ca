/** --- YAML
 * name: Referral Dashboard
 * description: Мой реф-код, ссылка на /ref/[code], текущий бонусный баланс, последние 20 транзакций по бонусам,
 *              число приглашённых (из referrals). Шер в Telegram/WhatsApp/email/copy.
 * created: 2026-04-19
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Gift, Copy, Check, Send, MessageCircle, Mail, Users, Sparkles } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface BonusTx {
  id: string;
  kind: string;
  amount: number;
  balance_after: number | null;
  note: string | null;
  created_at: string;
}

interface MeResponse {
  referral_code: string | null;
  link: string | null;
  bonus_balance: number;
  full_name: string | null;
  referrals_count: number;
  recent_transactions: BonusTx[];
}

const KIND_LABEL: Record<string, string> = {
  referral_signup: 'Бонус за приглашение',
  referral_welcome: 'Приветственный бонус',
  booking_discount: 'Скидка на запись',
  subscription_discount: 'Скидка на подписку',
  profile_boost: 'Буст профиля',
  commission: 'Комиссия с подписки',
  adjustment: 'Корректировка',
  expired: 'Истёк срок',
};

export default function ReferralPage() {
  const [data, setData] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/referral/me');
      if (res.ok) {
        const j = await res.json();
        setData(j);
      }
      setLoading(false);
    })();
  }, []);

  function copyLink() {
    if (!data?.link) return;
    navigator.clipboard.writeText(data.link);
    setCopied(true);
    toast.success('Ссылка скопирована');
    setTimeout(() => setCopied(false), 1800);
  }

  function shareTelegram() {
    if (!data?.link) return;
    const text = encodeURIComponent(`Приглашаю тебя в CRES-CA — получим оба бонус: ${data.link}`);
    window.open(`https://t.me/share/url?url=${encodeURIComponent(data.link)}&text=${text}`, '_blank');
  }

  function shareWhatsApp() {
    if (!data?.link) return;
    const text = encodeURIComponent(`Приглашаю тебя в CRES-CA — получим оба бонус: ${data.link}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  }

  function shareEmail() {
    if (!data?.link) return;
    const subject = encodeURIComponent('Приглашение в CRES-CA');
    const body = encodeURIComponent(`Привет!\n\nПриглашаю тебя в CRES-CA — универсальный сервис для записей.\nПерейди по ссылке, зарегистрируйся — оба получим бонусы: ${data.link}\n`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }

  function formatDate(iso: string) {
    try {
      return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return iso;
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-60 w-full rounded-2xl" />
      </div>
    );
  }

  if (!data?.link) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-8 text-center text-sm text-muted-foreground">
        Реферальный код ещё не сгенерирован. Обновите страницу или выйдите и зайдите снова.
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 pb-12">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Реферальная программа</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Поделитесь ссылкой — каждый новый пользователь приносит бонусы вам обоим.
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <Sparkles className="size-3.5 text-primary" />
              Ваш бонусный баланс
            </div>
            <div className="mt-2 text-3xl font-bold text-primary">
              {data.bonus_balance.toLocaleString()}{' '}
              <span className="text-base font-medium text-muted-foreground">бонусов</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Пригласили</div>
            <div className="mt-1 inline-flex items-center gap-1 text-2xl font-bold">
              <Users className="size-5 text-primary" />
              {data.referrals_count}
            </div>
          </div>
        </div>
      </motion.div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
          <Gift className="size-4 text-primary" />
          Ваша ссылка
        </h2>
        <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5">
          <code className="flex-1 truncate text-sm">{data.link}</code>
          <button
            onClick={copyLink}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Скопировать"
          >
            {copied ? <Check className="size-4 text-emerald-500" /> : <Copy className="size-4" />}
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={shareTelegram}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-primary hover:border-primary/30"
          >
            <Send className="size-4" />
            Telegram
          </button>
          <button
            onClick={shareWhatsApp}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-emerald-600 hover:border-emerald-500/30"
          >
            <MessageCircle className="size-4" />
            WhatsApp
          </button>
          <button
            onClick={shareEmail}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:border-foreground/30"
          >
            <Mail className="size-4" />
            Email
          </button>
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-base font-semibold">История бонусов</h2>
        {data.recent_transactions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
            Транзакций пока нет
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Дата</th>
                  <th className="px-4 py-3 text-left font-medium">Тип</th>
                  <th className="px-4 py-3 text-right font-medium">Сумма</th>
                  <th className="px-4 py-3 text-right font-medium">Баланс</th>
                </tr>
              </thead>
              <tbody>
                {data.recent_transactions.map((t) => (
                  <tr key={t.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(t.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{KIND_LABEL[t.kind] ?? t.kind}</div>
                      {t.note && <div className="mt-0.5 text-xs text-muted-foreground">{t.note}</div>}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-semibold ${
                        t.amount > 0 ? 'text-emerald-600' : 'text-destructive'
                      }`}
                    >
                      {t.amount > 0 ? '+' : ''}
                      {t.amount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {t.balance_after?.toLocaleString() ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
