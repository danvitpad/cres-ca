/** --- YAML
 * name: MasterMiniAppProfile
 * description: Mini App мастер-профиль — Fresha-style. Avatar + name + specialization + bio + stats + share/settings.
 *              Без публикаций (Instagram grid удалён). Портфолио — отдельным экраном.
 * created: 2026-04-13
 * updated: 2026-04-25
 * --- */

'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Gear, Star, Share, Image as ImageIcon } from '@phosphor-icons/react';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useTelegram } from '@/components/miniapp/telegram-provider';

interface MasterSelf {
  id: string;
  display_name: string | null;
  specialization: string | null;
  bio: string | null;
  city: string | null;
  rating: number;
  total_reviews: number;
  avatar_url: string | null;
  invite_code: string | null;
}

interface SubInfo {
  tier: string;
  status: string;
  trial_ends_at: string | null;
  current_period_end: string | null;
}

interface ProfileStats {
  appointments: number;
  clients: number;
}

const TIER_LABEL: Record<string, string> = {
  trial: 'Триал',
  starter: 'Старт',
  pro: 'Про',
  business: 'Бизнес',
  free: 'Free',
};

export default function MasterMiniAppProfile() {
  const { haptic } = useTelegram();
  const { userId } = useAuthStore();
  const [master, setMaster] = useState<MasterSelf | null>(null);
  const [profileFullName, setProfileFullName] = useState<string>('');
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null);
  const [sub, setSub] = useState<SubInfo | null>(null);
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const initData = (() => {
        if (typeof window === 'undefined') return null;
        const w = window as { Telegram?: { WebApp?: { initData?: string } } };
        const live = w.Telegram?.WebApp?.initData;
        if (live) return live;
        try {
          const stash = sessionStorage.getItem('cres:tg');
          if (stash) {
            const parsed = JSON.parse(stash) as { initData?: string };
            if (parsed.initData) return parsed.initData;
          }
        } catch { /* ignore */ }
        return null;
      })();
      if (!initData) { setLoading(false); return; }

      const res = await fetch('/api/telegram/m/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData }),
      });
      if (!res.ok) { setLoading(false); return; }
      const json = await res.json();
      if (json.master) setMaster(json.master as MasterSelf);
      if (json.profile?.full_name) setProfileFullName(json.profile.full_name as string);
      if (json.profile?.avatar_url) setProfileAvatar(json.profile.avatar_url as string);
      if (json.subscription) setSub(json.subscription as SubInfo);
      if (json.stats) setStats(json.stats as ProfileStats);
      setLoading(false);
    })();
  }, [userId]);

  if (loading) {
    return (
      <div className="flex min-h-[60dvh] items-center justify-center">
        <Loader2 className="size-5 animate-spin text-white/40" />
      </div>
    );
  }

  if (!master) {
    return (
      <div className="px-5 pt-10 text-center text-[13px] text-white/55">
        Профиль мастера не найден.
      </div>
    );
  }

  const displayName = profileFullName || master.display_name || 'Мастер';
  const avatar = profileAvatar || master.avatar_url;
  // Trial должен побеждать tier: если статус 'trialing', мастер видит «Триал»
  // независимо от того, что лежит в master.subscription_tier (там может быть
  // 'business' оставленный от первоначального промо-бампа).
  const isTrial = sub?.status === 'trialing' || sub?.tier === 'trial';
  const tierLabel = isTrial
    ? 'Триал'
    : sub?.tier ? (TIER_LABEL[sub.tier] ?? sub.tier) : null;

  function shareLink() {
    if (!master?.invite_code) return;
    haptic('light');
    const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/m/${master.invite_code}`;
    const w = window as unknown as { Telegram?: { WebApp?: { openTelegramLink?: (url: string) => void } } };
    if (w.Telegram?.WebApp?.openTelegramLink) {
      w.Telegram.WebApp.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(url)}`);
    } else {
      navigator.clipboard?.writeText(url);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-4 px-5 pt-6 pb-6"
    >
      {/* Header: avatar (clickable to upload) + name + tier badge inline */}
      <div className="flex items-start gap-4">
        <button
          type="button"
          onClick={() => avatarInputRef.current?.click()}
          disabled={avatarBusy}
          className="relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/[0.06] text-3xl font-bold text-white/90 active:scale-[0.98] transition-transform"
          aria-label="Сменить аватар"
        >
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} alt="" className="size-full object-cover" />
          ) : (
            (displayName[0] ?? 'M').toUpperCase()
          )}
          <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/60 py-0.5 text-center text-[9px] font-semibold uppercase tracking-wider opacity-0 transition-opacity group-hover:opacity-100 sm:group-hover:opacity-100">
            {avatarBusy ? '…' : 'Сменить'}
          </span>
        </button>
        <input
          ref={avatarInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setAvatarBusy(true);
            try {
              const supabase = createClient();
              const { data: { user } } = await supabase.auth.getUser();
              if (!user) return;
              if (f.size > 5 * 1024 * 1024) { alert('Файл больше 5 MB'); return; }
              const ext = f.name.split('.').pop() || 'jpg';
              const path = `${user.id}/avatar-${Date.now()}.${ext}`;
              const { error: upErr } = await supabase.storage.from('avatars').upload(path, f, {
                cacheControl: '3600', upsert: false,
              });
              if (upErr) { alert(`Ошибка загрузки: ${upErr.message}`); return; }
              const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
              await supabase.from('profiles').update({ avatar_url: pub.publicUrl }).eq('id', user.id);
              setProfileAvatar(pub.publicUrl);
              haptic('success');
            } finally {
              setAvatarBusy(false);
            }
          }}
        />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[20px] font-bold leading-tight">{displayName}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {master.specialization && (
              <span className="truncate text-[12px] text-white/60">{master.specialization}</span>
            )}
            {tierLabel && (
              <span className="inline-flex items-center rounded-full border border-violet-500/20 bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold text-violet-300">
                {tierLabel}
              </span>
            )}
          </div>
          {master.city && (
            <p className="mt-0.5 truncate text-[11px] text-white/45">{master.city}</p>
          )}
        </div>
        <Link
          href="/telegram/m/settings"
          onClick={() => haptic('light')}
          className="flex size-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/80 active:bg-white/[0.08] transition-colors"
          aria-label="Настройки"
        >
          <Gear size={18} weight="bold" />
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <StatItem value={stats?.appointments ?? 0} label="Работ" />
        <StatItem value={stats?.clients ?? 0} label="Клиентов" />
        <StatItem
          value={master.rating > 0 ? master.rating.toFixed(1) : '—'}
          label={master.total_reviews > 0 ? `${master.total_reviews} отзывов` : 'Рейтинг'}
          icon={master.rating > 0}
        />
      </div>

      {/* Bio */}
      {master.bio && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-[13px] leading-relaxed text-white/75 whitespace-pre-wrap">{master.bio}</p>
        </div>
      )}

      {/* Actions */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={shareLink}
          className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-[13px] font-semibold active:bg-white/[0.08] transition-colors"
        >
          <Share size={16} weight="bold" />
          Поделиться
        </button>
        {/* Portfolio в Mini App пока живёт только в составе публичной страницы.
            Здесь — открываем её и пользователь видит свой портфолио раздел. */}
        {master.invite_code ? (
          <Link
            href={`/m/${master.invite_code}#portfolio`}
            onClick={() => haptic('light')}
            target="_blank"
            className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-[13px] font-semibold active:bg-white/[0.08] transition-colors"
          >
            <ImageIcon size={16} weight="bold" />
            Портфолио
          </Link>
        ) : (
          <button
            type="button"
            disabled
            className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-[13px] font-semibold opacity-50"
          >
            <ImageIcon size={16} weight="bold" />
            Портфолио
          </button>
        )}
      </div>

      {master.invite_code && (
        <Link
          href={`/m/${master.invite_code}`}
          onClick={() => haptic('light')}
          className="block rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center text-[12px] text-white/60 active:bg-white/[0.06] transition-colors"
        >
          Открыть публичную страницу
        </Link>
      )}
    </motion.div>
  );
}

function StatItem({ value, label, icon }: { value: number | string; label: string; icon?: boolean }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3 text-center">
      <div className="flex items-center justify-center gap-1 text-[18px] font-bold">
        {icon && <Star size={14} weight="fill" className="text-amber-400" />}
        <span>{value}</span>
      </div>
      <p className="mt-1 text-[10px] uppercase tracking-wider text-white/45">{label}</p>
    </div>
  );
}
