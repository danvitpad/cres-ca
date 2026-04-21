/** --- YAML
 * name: MasterMiniAppProfile
 * description: Instagram-style master profile — gear top-right → /telegram/m/settings, avatar + personal name (profile.full_name first, never salon brand), specialization, subscription tier one-liner, stats row, portfolio grid 3-col with (+) upload slot. Redesigned 2026-04-19.
 * created: 2026-04-13
 * updated: 2026-04-19
 * --- */

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Gear, Plus, Check, X, Star } from '@phosphor-icons/react';
import { Loader2 } from 'lucide-react';
import { mapError } from '@/lib/errors';
import { createClient } from '@/lib/supabase/client';
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

interface PostRow {
  id: string;
  image_url: string;
  caption: string | null;
  created_at: string;
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
};

export default function MasterMiniAppProfile() {
  const { haptic } = useTelegram();
  const { userId } = useAuthStore();
  const [master, setMaster] = useState<MasterSelf | null>(null);
  const [profileFullName, setProfileFullName] = useState<string>('');
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null);
  const [sub, setSub] = useState<SubInfo | null>(null);
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewPost, setPreviewPost] = useState<PostRow | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadCaption, setUploadCaption] = useState('');
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadDone, setUploadDone] = useState(false);

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
      if (Array.isArray(json.posts)) setPosts(json.posts as PostRow[]);
      setLoading(false);
    })();
  }, [userId]);

  function onPickFile(file: File) {
    setUploadFile(file);
    setUploadPreview(URL.createObjectURL(file));
    setUploadCaption('');
    setUploadError(null);
    setUploadDone(false);
    setUploadOpen(true);
  }

  async function publishPost() {
    if (!userId || !uploadFile || uploadBusy) return;
    setUploadBusy(true);
    setUploadError(null);
    try {
      const supabase = createClient();
      const ext = (uploadFile.name.split('.').pop() ?? 'jpg').toLowerCase();
      const path = `${userId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('posts')
        .upload(path, uploadFile, { cacheControl: '3600', upsert: false });
      if (upErr) {
        setUploadError(mapError('insert_failed', 'Не удалось загрузить фото'));
        haptic('error');
        return;
      }
      const { data: urlData } = supabase.storage.from('posts').getPublicUrl(path);
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: urlData.publicUrl, caption: uploadCaption.trim() || null }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setUploadError(mapError(j.error, 'Не удалось опубликовать'));
        haptic('error');
        return;
      }
      haptic('success');
      setUploadDone(true);
      setTimeout(() => {
        setUploadOpen(false);
        setUploadFile(null);
        setUploadPreview(null);
        setUploadCaption('');
        setUploadDone(false);
        if (j.post) {
          setPosts((prev) => [j.post as PostRow, ...prev]);
        }
      }, 900);
    } catch {
      setUploadError(mapError('network_error'));
    } finally {
      setUploadBusy(false);
    }
  }

  const displayName = useMemo(() => {
    return profileFullName || master?.display_name || 'Мастер';
  }, [profileFullName, master?.display_name]);

  const avatarUrl = profileAvatar || master?.avatar_url;
  const tierLabel = sub ? (TIER_LABEL[sub.tier] ?? sub.tier) : null;

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-white/40" />
      </div>
    );
  }

  if (!master) {
    return <p className="px-5 pt-10 text-center text-sm text-white/60">Профиль мастера не найден</p>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="relative pt-4 pb-10"
    >
      {/* Top-right gear */}
      <div className="absolute right-5 top-4 z-10">
        <Link
          href="/telegram/m/settings"
          onClick={() => haptic('light')}
          className="flex size-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] active:bg-white/[0.06] transition-colors"
          aria-label="Настройки"
        >
          <Gear size={20} weight="regular" className="text-white/70" />
        </Link>
      </div>

      {/* Identity */}
      <div className="flex flex-col items-center gap-2 px-5 pt-2">
        <div className="flex size-24 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/[0.06] text-3xl font-bold text-white/90">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt={displayName} className="size-full object-cover" />
          ) : (
            displayName[0]?.toUpperCase() ?? 'М'
          )}
        </div>
        <h1 className="mt-1 text-lg font-bold text-center">{displayName}</h1>
        {master.specialization && (
          <p className="text-[12px] text-white/60 text-center">{master.specialization}</p>
        )}
        {tierLabel && (
          <p className="text-[11px] uppercase tracking-wider text-white/40">Тариф · {tierLabel}</p>
        )}
      </div>

      {/* Stats row */}
      <div className="mx-5 mt-5 grid grid-cols-3 divide-x divide-white/10 rounded-2xl border border-white/10 bg-white/[0.03] py-3">
        <StatItem value={stats?.appointments ?? 0} label="Работ" />
        <StatItem value={stats?.clients ?? 0} label="Клиентов" />
        <StatItem
          value={master.rating > 0 ? master.rating.toFixed(1) : '—'}
          label={master.total_reviews > 0 ? `${master.total_reviews} отзывов` : 'Рейтинг'}
          icon={master.rating > 0}
        />
      </div>

      {/* Publications grid */}
      <div className="mt-6 px-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Публикации</h2>
          <span className="text-[11px] text-white/40">{posts.length}</span>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-1">
          {/* First tile: upload */}
          <button
            onClick={() => {
              haptic('light');
              fileInputRef.current?.click();
            }}
            className="flex aspect-square items-center justify-center rounded-sm border border-dashed border-white/15 bg-white/[0.03] text-violet-300 active:bg-white/[0.06] transition-colors"
            aria-label="Добавить публикацию"
          >
            <Plus size={28} weight="bold" />
          </button>

          {posts.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => { haptic('light'); setPreviewPost(p); }}
              className="relative aspect-square overflow-hidden rounded-sm bg-white/[0.03] active:opacity-80 transition-opacity"
              aria-label="Открыть публикацию"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.image_url} alt={p.caption ?? ''} className="size-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>

        {posts.length === 0 && (
          <p className="mt-4 text-center text-[11px] text-white/50">
            Первая публикация — вход в ленту клиентов.
          </p>
        )}
      </div>

      {/* Post preview lightbox */}
      <AnimatePresence>
        {previewPost && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPreviewPost(null)}
            className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-sm"
            style={{ paddingTop: 'max(16px, env(safe-area-inset-top))', paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
          >
            <div className="flex shrink-0 items-center justify-between px-5 pb-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-white/50">Публикация</div>
              <button
                onClick={() => setPreviewPost(null)}
                className="flex size-9 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-white active:bg-white/[0.12] transition-colors"
                aria-label="Закрыть"
              >
                ✕
              </button>
            </div>
            <div
              className="flex min-h-0 flex-1 items-center justify-center px-4"
              onClick={(e) => e.stopPropagation()}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewPost.image_url}
                alt={previewPost.caption ?? ''}
                className="h-auto max-h-full w-auto max-w-full rounded-xl object-contain"
                style={{ maxHeight: 'calc(100dvh - 200px)' }}
              />
            </div>
            <div
              className="shrink-0 px-6 pt-3"
              onClick={(e) => e.stopPropagation()}
            >
              {previewPost.caption ? (
                <p className="text-center text-[13px] leading-relaxed text-white/85 whitespace-pre-wrap">
                  {previewPost.caption}
                </p>
              ) : (
                <p className="text-center text-[12px] text-white/40 italic">
                  Без подписи
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPickFile(f);
          e.target.value = '';
        }}
      />

      <AnimatePresence>
        {uploadOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm"
            onClick={() => !uploadBusy && setUploadOpen(false)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-md rounded-t-[32px] border-t border-white/10 bg-[#1a1b1e] p-5"
              style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-bold">Новая публикация</h3>
                <button
                  onClick={() => !uploadBusy && setUploadOpen(false)}
                  className="flex size-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] active:bg-white/[0.06] transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {uploadPreview && (
                <div className="mb-4 aspect-[4/5] overflow-hidden rounded-2xl bg-black">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={uploadPreview} alt="preview" className="size-full object-cover" />
                </div>
              )}

              <textarea
                value={uploadCaption}
                onChange={(e) => setUploadCaption(e.target.value.slice(0, 2000))}
                placeholder="Подпись (необязательно)"
                rows={3}
                className="w-full resize-none rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm outline-none placeholder:text-white/30 focus:border-white/20"
              />

              {uploadError && (
                <div className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">
                  {uploadError}
                </div>
              )}

              <button
                onClick={publishPost}
                disabled={uploadBusy || !uploadFile}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-4 text-[15px] font-semibold text-black active:bg-white/80 transition-colors disabled:opacity-60"
              >
                {uploadBusy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : uploadDone ? (
                  <Check size={16} className="text-emerald-600" />
                ) : (
                  <Plus size={16} />
                )}
                {uploadDone ? 'Опубликовано' : 'Опубликовать'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function StatItem({
  value,
  label,
  icon,
}: {
  value: number | string;
  label: string;
  icon?: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center">
      <div className="flex items-center gap-1 text-lg font-bold tabular-nums">
        {icon && <Star size={12} weight="fill" className="text-amber-300" />}
        {value}
      </div>
      <p className="mt-0.5 text-[10px] uppercase tracking-wide text-white/40">{label}</p>
    </div>
  );
}
