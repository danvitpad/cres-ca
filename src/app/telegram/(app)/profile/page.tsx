/** --- YAML
 * name: MiniAppProfilePage
 * description: Mini App profile — Fresha-style. Name+subtitle left, avatar right, gradient wallet card,
 *              menu cards (Профиль/Связи/Анкеты/Настройки + Поддержка/Язык), sign out row. Dark theme.
 * created: 2026-04-13
 * updated: 2026-04-24
 * --- */

'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Check,
  ChevronRight,
  X,
  Loader2,
  Settings,
  LogOut,
  User as UserIcon,
  Users,
  FileText,
  HelpCircle,
  Globe,
  Wallet,
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
  const [fullName, setFullName] = useState<string | null>(null);
  const [bio, setBio] = useState<string | null>(null);
  const [slug, setSlug] = useState<string | null>(null);
  const [publicId, setPublicId] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
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

  const [profileLoaded, setProfileLoaded] = useState(false);

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
          setFullName(data.full_name ?? null);
          setBio(data.bio ?? null);
          setSlug(data.slug ?? null);
          setPublicId(data.public_id ?? null);
          setAvatarUrl(data.avatar_url ?? null);
          setFollowersCount(Number(data.followers_count ?? 0));
          setFollowingCount(Number(data.following_count ?? 0));
        }
      }
      setProfileLoaded(true);
    })();
  }, [userId]);

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
      try {
        const w = window as { Telegram?: { WebApp?: { initData?: string } } };
        let initData = w.Telegram?.WebApp?.initData;
        if (!initData) {
          try {
            const stash = sessionStorage.getItem('cres:tg');
            if (stash) initData = (JSON.parse(stash) as { initData?: string }).initData;
          } catch {}
        }
        if (initData) {
          await fetch('/api/telegram/unlink', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ initData }),
          });
        }
      } catch {}
      const supabase = createClient();
      await supabase.auth.signOut();
      clearAuth();
      try {
        sessionStorage.removeItem('cres:tg');
      } catch {}
      window.location.href = '/telegram';
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

  const tgFullName = user ? `${user.first_name}${user.last_name ? ' ' + user.last_name : ''}` : '';
  const displayName = profileLoaded ? (fullName ?? tgFullName ?? 'Гость') : '';
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
        className="space-y-4 px-5 pt-6 pb-6"
      >
        {/* Header: Name + subtitle LEFT, Avatar RIGHT (Fresha layout) */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            {profileLoaded ? (
              <h1 className="truncate text-[24px] font-bold leading-tight">{displayName}</h1>
            ) : (
              <div className="h-7 w-40 animate-pulse rounded-lg bg-white/[0.06]" />
            )}
            <p className="mt-1 text-[13px] text-white/50">Личный профиль</p>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={avatarBusy}
            className="relative flex size-[64px] shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/[0.06] text-2xl font-bold text-white/90 transition-colors active:bg-white/[0.1]"
            aria-label="Изменить аватар"
          >
            {!profileLoaded ? (
              <div className="size-full animate-pulse bg-white/[0.06]" />
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
        </div>

        {/* Wallet card — display only */}
        <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#a855f7] via-[#7c3aed] to-[#ec4899] p-5 text-white shadow-lg shadow-violet-500/20">
          <div className="flex items-center gap-1.5 text-[13px] font-medium text-white/80">
            <Wallet className="size-3.5" />
            Баланс
          </div>
          <p className="mt-1 text-[32px] font-bold leading-none tracking-tight">
            {balance.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₴
          </p>
        </div>

        {/* Main menu card */}
        <ul className="divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
          <MenuRow icon={UserIcon} label="Профиль" onClick={openEdit} />
          <MenuRowLink
            icon={Users}
            label="Контакты"
            sub={followingCount > 0 ? `${followingCount} подписок` : undefined}
            href="/telegram/connections"
            onClick={() => haptic('light')}
          />
          <MenuRowLink icon={FileText} label="Анкеты" href="/telegram/forms" onClick={() => haptic('light')} />
          <MenuRowLink icon={Settings} label="Настройки" href="/telegram/settings" onClick={() => haptic('light')} />
        </ul>

        {/* Secondary menu card */}
        <ul className="divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
          <MenuRowLink icon={HelpCircle} label="Поддержка" href="/telegram/settings/feedback" onClick={() => haptic('light')} />
          <MenuRow icon={Globe} label="Язык" value="Русский" onClick={() => haptic('light')} />
        </ul>

        {/* Sign out row */}
        <ul className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
          <li>
            <button
              onClick={signOut}
              disabled={signingOut}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-rose-300 active:bg-white/[0.03] transition-colors disabled:opacity-60"
            >
              <div className="flex size-9 items-center justify-center rounded-xl border border-rose-500/20 bg-rose-500/10">
                {signingOut ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}
              </div>
              <span className="flex-1 text-sm font-medium">Выйти из аккаунта</span>
            </button>
          </li>
        </ul>

        {bio && (
          <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-white/45 px-1">{bio}</p>
        )}

        {/* Hidden-but-accessible followers/following triggers for deep links */}
        <div className="sr-only">
          <button onClick={() => openList('followers')}>Подписчики: {followersCount}</button>
          <button onClick={() => openList('following')}>Подписки: {followingCount}</button>
        </div>

        <div className="h-4" />
      </motion.div>

      {/* Followers / following bottom sheet */}
      <AnimatePresence>
        {listOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/70"
            onClick={() => setListOpen(false)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              onClick={(e) => e.stopPropagation()}
              className="relative max-h-[80dvh] w-full max-w-md overflow-hidden rounded-t-2xl border-t border-white/10 bg-[#0b0d17]"
              style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}
            >
              <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-white/20" />
              <div className="flex items-center justify-between px-5 py-4">
                <h3 className="text-[15px] font-semibold">
                  {listType === 'followers' ? 'Подписчики' : 'Подписки'}
                </h3>
                <button
                  onClick={() => setListOpen(false)}
                  className="flex size-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] active:bg-white/[0.06] transition-colors"
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
                          className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left active:bg-white/[0.03] transition-colors"
                        >
                          <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/[0.06] text-sm font-bold text-white/90">
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
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/70"
            onClick={() => setEditOpen(false)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-md rounded-t-2xl border-t border-white/10 bg-[#0b0d17] p-5"
              style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-bold">Редактировать профиль</h3>
                <button
                  onClick={() => setEditOpen(false)}
                  className="flex size-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] active:bg-white/[0.06] transition-colors"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
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

                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
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

                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
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
                  <div className="relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] p-3 pl-4 text-xs text-rose-300">
                    <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-rose-500" />
                    {editError}
                  </div>
                )}

                <button
                  onClick={saveEdit}
                  disabled={editBusy}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-4 text-[15px] font-semibold text-black active:bg-white/80 transition-colors disabled:opacity-60"
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

function MenuRow({
  icon: Icon,
  label,
  value,
  sub,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value?: string;
  sub?: string;
  onClick?: () => void;
}) {
  return (
    <li>
      <button
        onClick={onClick}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-white/[0.03] transition-colors"
      >
        <div className="flex size-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03]">
          <Icon className="size-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm">{label}</p>
          {sub && <p className="truncate text-[11px] text-white/40">{sub}</p>}
        </div>
        {value && <span className="text-[13px] text-white/50">{value}</span>}
        <ChevronRight className="size-4 text-white/40" />
      </button>
    </li>
  );
}

function MenuRowLink({
  icon: Icon,
  label,
  sub,
  href,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  sub?: string;
  href: string;
  onClick?: () => void;
}) {
  return (
    <li>
      <Link
        href={href}
        onClick={onClick}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-white/[0.03] transition-colors"
      >
        <div className="flex size-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03]">
          <Icon className="size-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm">{label}</p>
          {sub && <p className="truncate text-[11px] text-white/40">{sub}</p>}
        </div>
        <ChevronRight className="size-4 text-white/40" />
      </Link>
    </li>
  );
}
