/** --- YAML
 * name: MiniAppProfilePage
 * description: Mini App profile — Instagram-style. Name + CRES-ID link at top, avatar + stats, Edit/Share, balance, referral, minimal menu. Pairing moved out, posts grid removed, logout in settings.
 * created: 2026-04-13
 * updated: 2026-04-14
 * --- */

'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Sparkles,
  UserPlus,
  Copy,
  Check,
  ChevronRight,
  X,
  Loader2,
  Settings,
  Share2,
  LogOut,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { useTelegram } from '@/components/miniapp/telegram-provider';
import { mapError } from '@/lib/errors';

interface FollowListEntry {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  public_id: string | null;
  slug: string | null;
  role: string | null;
}

export default function MiniAppProfilePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, haptic } = useTelegram();
  const { userId, clearAuth } = useAuthStore();
  const [balance, setBalance] = useState(0);
  const [bonusPoints, setBonusPoints] = useState(0);
  const [fullName, setFullName] = useState<string | null>(null);
  const [bio, setBio] = useState<string | null>(null);
  const [slug, setSlug] = useState<string | null>(null);
  const [publicId, setPublicId] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [copiedRef, setCopiedRef] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  // Follow list modal
  const [listOpen, setListOpen] = useState(false);
  const [listType, setListType] = useState<'followers' | 'following'>('followers');
  const [listLoading, setListLoading] = useState(false);
  const [listEntries, setListEntries] = useState<FollowListEntry[]>([]);

  // Avatar upload
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);

  // Edit profile modal state
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editSlug, setEditSlug] = useState('');
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const stash = sessionStorage.getItem('cres:tg');
      const initData = stash ? JSON.parse(stash).initData : null;
      if (initData) {
        const res = await fetch('/api/telegram/me', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ initData }),
        });
        if (res.ok) {
          const { profile: data } = await res.json();
          setBalance(Number(data.bonus_balance ?? 0));
          setBonusPoints(Number(data.bonus_points ?? 0));
          setFullName(data.full_name ?? null);
          setBio(data.bio ?? null);
          setSlug(data.slug ?? null);
          setPublicId(data.public_id ?? null);
          setAvatarUrl(data.avatar_url ?? null);
          setPhone(data.phone ?? null);
          setEmail(data.email ?? null);
          setFollowersCount(Number(data.followers_count ?? 0));
          setFollowingCount(Number(data.following_count ?? 0));
        }
      }
      setProfileLoaded(true);
    })();
  }, [userId]);

  function copyReferral() {
    if (!publicId) return;
    const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;
    const link = botUsername
      ? `https://t.me/${botUsername}?startapp=u_${publicId}`
      : `${window.location.origin}/u/${publicId}`;
    navigator.clipboard.writeText(link);
    haptic('success');
    setCopiedRef(true);
    setTimeout(() => setCopiedRef(false), 2000);
  }

  function openEdit() {
    setEditName(fullName ?? '');
    setEditBio(bio ?? '');
    setEditSlug(slug ?? '');
    setEditError(null);
    setEditOpen(true);
    haptic('light');
  }

  async function saveEdit() {
    if (editBusy) return;
    setEditBusy(true);
    setEditError(null);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: editName.trim() || null,
          bio: editBio.trim() || null,
          slug: editSlug.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setEditError(mapError(data.error, 'Не удалось сохранить'));
        haptic('error');
        return;
      }
      setFullName(editName.trim() || null);
      setBio(editBio.trim() || null);
      setSlug(editSlug.trim() || null);
      haptic('success');
      setEditOpen(false);
    } catch (e) {
      setEditError(mapError(e instanceof Error ? e.message : 'network_error'));
    } finally {
      setEditBusy(false);
    }
  }

  async function signOut() {
    if (signingOut) return;
    haptic('medium');
    setSigningOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      clearAuth();
      try {
        sessionStorage.removeItem('cres:tg');
      } catch {}
      router.replace('/telegram');
    } catch {
      setSigningOut(false);
    }
  }

  async function openList(type: 'followers' | 'following') {
    if (!userId) return;
    haptic('light');
    setListType(type);
    setListOpen(true);
    setListLoading(true);
    setListEntries([]);
    try {
      const res = await fetch(`/api/follow/list?profileId=${userId}&type=${type}`);
      const data = await res.json();
      if (res.ok) setListEntries(data.list ?? []);
    } finally {
      setListLoading(false);
    }
  }

  async function onAvatarFile(file: File) {
    if (!userId || avatarBusy) return;
    setAvatarBusy(true);
    try {
      const supabase = createClient();
      const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase();
      const path = `${userId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(path, file, { cacheControl: '3600', upsert: true });
      if (upErr) {
        haptic('error');
        return;
      }
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
      const newUrl = urlData.publicUrl;
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatarUrl: newUrl }),
      });
      if (res.ok) {
        setAvatarUrl(newUrl);
        haptic('success');
      } else {
        haptic('error');
      }
    } finally {
      setAvatarBusy(false);
    }
  }

  function shareProfile() {
    if (!publicId) return;
    haptic('light');
    const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? 'cres_ca_bot';
    const link = `https://t.me/${botUsername}?startapp=u_${publicId}`;
    const text = `${fullName ?? 'Мой профиль'} — CRES-CA`;
    const tg = window.Telegram?.WebApp;
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(
        `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`,
      );
    } else if (navigator.share) {
      navigator.share({ title: text, url: link }).catch(() => {});
    } else {
      navigator.clipboard.writeText(link);
    }
  }

  const [profileLoaded, setProfileLoaded] = useState(false);
  const tgFullName = user ? `${user.first_name}${user.last_name ? ' ' + user.last_name : ''}` : '';
  // Don't show Telegram name until DB loads — prevents flash of wrong name
  const displayName = profileLoaded ? (fullName ?? tgFullName ?? 'Гость') : '';
  // Only use Telegram avatar if DB full_name is empty or exactly matches Telegram name
  const showTgPhoto = profileLoaded && !!user?.photo_url && (!fullName || fullName.trim() === tgFullName.trim());

  // Auto-open edit modal when navigated from settings with ?edit=true
  useEffect(() => {
    if (profileLoaded && searchParams.get('edit') === 'true') {
      openEdit();
      router.replace('/telegram/profile', { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileLoaded]);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="space-y-5 px-5 pt-6"
      >
        {/* Telegram-style: Avatar left, Name + ID right */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={avatarBusy}
            className="relative flex size-[72px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-violet-500 to-rose-500 text-2xl font-bold active:scale-95 transition-transform"
            aria-label="Изменить аватар"
          >
            {!profileLoaded ? (
              <div className="size-full animate-pulse bg-white/10" />
            ) : avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" className="size-full object-cover" />
            ) : showTgPhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user!.photo_url!} alt="" className="size-full object-cover" />
            ) : (
              (displayName[0] ?? 'U').toUpperCase()
            )}
            {avatarBusy && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                <Loader2 className="size-5 animate-spin" />
              </div>
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onAvatarFile(f);
              e.target.value = '';
            }}
          />

          <div className="min-w-0 flex-1">
            {profileLoaded ? (
              <h1 className="truncate text-[20px] font-bold leading-tight">{displayName}</h1>
            ) : (
              <div className="h-6 w-36 animate-pulse rounded-lg bg-white/10" />
            )}
            {profileLoaded && publicId && (
              <button
                onClick={() => {
                  const id = slug ?? publicId.toLowerCase();
                  navigator.clipboard.writeText(`cres-id//${id}`);
                  haptic('success');
                }}
                className="mt-0.5 truncate font-mono text-[12px] text-white/35 active:text-white/50 transition-colors"
              >
                cres-id//{slug ?? publicId.toLowerCase()}
              </button>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="flex gap-4">
          <Stat value={followersCount} label="подписчиков" onClick={() => openList('followers')} />
          <Stat value={followingCount} label="подписок" onClick={() => openList('following')} />
        </div>

        {bio && (
          <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-white/70">{bio}</p>
        )}

        {/* Edit + Share */}
        <div className="flex gap-2">
          <button
            onClick={openEdit}
            className="flex-1 rounded-lg border border-white/10 bg-white/5 py-2 text-[13px] font-semibold active:scale-[0.98] transition-transform"
          >
            Редактировать
          </button>
          <button
            onClick={shareProfile}
            disabled={!publicId}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 py-2 text-[13px] font-semibold active:scale-[0.98] transition-transform disabled:opacity-50"
          >
            <Share2 className="size-3.5" /> Поделиться
          </button>
        </div>

        {/* Balance — compact when zero */}
        {balance > 0 || bonusPoints > 0 ? (
          <div className="relative overflow-hidden rounded-[28px] bg-[#2f3437] p-6">
            <motion.div
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 40, ease: 'linear', repeat: Infinity }}
              className="pointer-events-none absolute -inset-[40%] opacity-70"
              style={{
                background:
                  'conic-gradient(from 90deg at 50% 50%, #6d28d9 0%, #db2777 25%, #f59e0b 50%, #6d28d9 75%, #6d28d9 100%)',
                filter: 'blur(60px)',
              }}
            />
            <div className="absolute inset-0 bg-[#2f3437]/55" />
            <div className="relative flex items-start justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-white/60">Баланс</p>
                <p className="mt-1 text-3xl font-bold">
                  {balance.toFixed(0)} <span className="text-lg text-white/60">₴</span>
                </p>
                {bonusPoints > 0 && (
                  <p className="mt-2 text-[11px] text-white/60">+{bonusPoints} бонусных очков</p>
                )}
              </div>
              <div className="flex size-11 items-center justify-center rounded-2xl bg-white/10 backdrop-blur">
                <Sparkles className="size-5" />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-white/5">
              <Sparkles className="size-4 text-white/60" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold">Баланс пуст</p>
              <p className="text-[11px] text-white/45">Сделайте первую запись, чтобы получить бонусы</p>
            </div>
          </div>
        )}

        {/* Referral card */}
        <button
          onClick={copyReferral}
          className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-gradient-to-br from-emerald-500/15 to-emerald-500/5 p-4 text-left active:scale-[0.98] transition-transform"
        >
          <div className="flex size-11 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-300">
            <UserPlus className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Пригласить друга</p>
            <p className="text-[11px] text-white/50">Вы получите бонус за каждую первую запись</p>
          </div>
          <div className="flex size-8 items-center justify-center rounded-lg bg-white/10">
            {copiedRef ? <Check className="size-4 text-emerald-300" /> : <Copy className="size-4" />}
          </div>
        </button>

        {/* Quick links */}
        <ul className="divide-y divide-white/5 rounded-2xl border border-white/10 bg-white/5">
          <MenuItemLink icon={Settings} label="Настройки" href="/telegram/settings" onClick={() => haptic('light')} />
        </ul>

        {/* Sign out */}
        <button
          onClick={signOut}
          disabled={signingOut}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-500/25 bg-rose-500/5 py-3.5 text-[13px] font-semibold text-rose-200/90 active:scale-[0.98] transition-transform disabled:opacity-60"
        >
          {signingOut ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}
          Выйти из аккаунта
        </button>

        <div className="h-4" />
      </motion.div>

      {/* Followers / following bottom sheet */}
      <AnimatePresence>
        {listOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm"
            onClick={() => setListOpen(false)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              onClick={(e) => e.stopPropagation()}
              className="relative max-h-[80dvh] w-full max-w-md overflow-hidden rounded-t-[32px] border-t border-white/10 bg-[#2f3437]"
              style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}
            >
              <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-white/20" />
              <div className="flex items-center justify-between px-5 py-4">
                <h3 className="text-[15px] font-semibold">
                  {listType === 'followers' ? 'Подписчики' : 'Подписки'}
                </h3>
                <button
                  onClick={() => setListOpen(false)}
                  className="flex size-9 items-center justify-center rounded-full bg-white/5"
                >
                  <X className="size-4" />
                </button>
              </div>
              <div className="max-h-[60dvh] overflow-y-auto px-3 pb-4">
                {listLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="size-5 animate-spin text-white/40" />
                  </div>
                ) : listEntries.length === 0 ? (
                  <div className="py-12 text-center text-[12px] text-white/40">
                    {listType === 'followers'
                      ? 'У вас пока нет подписчиков'
                      : 'Вы пока ни на кого не подписаны'}
                  </div>
                ) : (
                  <ul className="space-y-1">
                    {listEntries.map((e) => (
                      <li key={e.id}>
                        <button
                          onClick={() => {
                            setListOpen(false);
                            if (e.public_id) {
                              window.location.href = `/telegram/u/${e.public_id}`;
                            }
                          }}
                          className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left active:bg-white/5"
                        >
                          <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-violet-500/60 to-rose-500/60 text-sm font-bold">
                            {e.avatar_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={e.avatar_url} alt="" className="size-full object-cover" />
                            ) : (
                              (e.full_name?.[0] ?? 'U').toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[14px] font-semibold">
                              {e.full_name ?? 'Пользователь'}
                            </p>
                            <p className="truncate text-[11px] text-white/45">
                              {e.slug ? `@${e.slug}` : e.public_id ?? ''}
                              {e.role === 'master' && ' · Мастер'}
                              {e.role === 'salon_admin' && ' · Салон'}
                            </p>
                          </div>
                          <ChevronRight className="size-4 text-white/30" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit profile modal */}
      <AnimatePresence>
        {editOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm"
            onClick={() => setEditOpen(false)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-md rounded-t-[32px] border-t border-white/10 bg-[#2f3437] p-5"
              style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-bold">Редактировать профиль</h3>
                <button
                  onClick={() => setEditOpen(false)}
                  className="flex size-9 items-center justify-center rounded-full bg-white/5"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
                    Имя
                  </label>
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value.slice(0, 80))}
                    placeholder="Как вас зовут"
                    className="mt-1 w-full bg-transparent text-base outline-none placeholder:text-white/30"
                  />
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
                    Имя ссылки (slug)
                  </label>
                  <div className="mt-1 flex items-center gap-1 font-mono text-base">
                    <span className="text-white/30">@</span>
                    <input
                      value={editSlug}
                      onChange={(e) =>
                        setEditSlug(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 32))
                      }
                      placeholder="username"
                      className="w-full bg-transparent outline-none placeholder:text-white/30"
                    />
                  </div>
                  <p className="mt-1 text-[10px] text-white/35">
                    3–32 символа: латиница, цифры, точка, дефис, подчёркивание
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
                    О себе
                  </label>
                  <textarea
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value.slice(0, 280))}
                    placeholder="Пара слов о вас"
                    rows={4}
                    className="mt-1 w-full resize-none bg-transparent text-sm outline-none placeholder:text-white/30"
                  />
                  <p className="mt-1 text-right text-[10px] text-white/35">{editBio.length}/280</p>
                </div>

                {editError && (
                  <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">
                    {editError}
                  </div>
                )}

                <button
                  onClick={saveEdit}
                  disabled={editBusy}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-4 text-[15px] font-semibold text-black active:scale-[0.98] transition-transform disabled:opacity-60"
                >
                  {editBusy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                  Сохранить
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </>
  );
}

function Stat({
  value,
  label,
  onClick,
}: {
  value: number;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center rounded-xl px-1 py-1 active:scale-95 transition-transform"
    >
      <span className="text-lg font-bold">{formatCount(value)}</span>
      <span className="text-[10px] text-white/50">{label}</span>
    </button>
  );
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return n.toString();
}

function MenuItemLink({
  icon: Icon,
  label,
  href,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href: string;
  onClick?: () => void;
}) {
  return (
    <li>
      <Link href={href} onClick={onClick} className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
        <div className="flex size-9 items-center justify-center rounded-xl bg-white/5">
          <Icon className="size-4" />
        </div>
        <span className="flex-1 text-sm">{label}</span>
        <ChevronRight className="size-4 text-white/40" />
      </Link>
    </li>
  );
}
