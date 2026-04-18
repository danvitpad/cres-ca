/** --- YAML
 * name: MasterMiniAppProfile
 * description: Master Mini App self profile — avatar, rating, bio, specialization, city, QR card, billing tier, invite link, logout. Flat cards (Phase 7.4).
 * created: 2026-04-13
 * updated: 2026-04-18
 * --- */

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Star,
  MapPin,
  QrCode,
  Share2,
  CreditCard,
  LogOut,
  Loader2,
  ChevronRight,
  Copy,
  Check,
  Plus,
  ImagePlus,
  X,
} from 'lucide-react';
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

interface SubInfo {
  tier: string;
  status: string;
  trial_ends_at: string | null;
  current_period_end: string | null;
}

export default function MasterMiniAppProfile() {
  const { haptic } = useTelegram();
  const { userId, clearAuth } = useAuthStore();
  const [master, setMaster] = useState<MasterSelf | null>(null);
  const [fullName, setFullName] = useState<string>('');
  const [sub, setSub] = useState<SubInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);

  // Post upload state
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
      if (json.profile?.full_name) setFullName(json.profile.full_name as string);
      if (json.subscription) setSub(json.subscription as SubInfo);
      setLoading(false);
    })();
  }, [userId]);

  const profileUrl = useMemo(() => {
    if (typeof window === 'undefined' || !master) return '';
    return `${window.location.origin}/ru/book?master=${master.id}`;
  }, [master]);

  const qrUrl = useMemo(() => {
    if (!profileUrl) return '';
    return `https://api.qrserver.com/v1/create-qr-code/?size=320x320&bgcolor=0a0a0a&color=ffffff&margin=8&data=${encodeURIComponent(profileUrl)}`;
  }, [profileUrl]);

  async function copyLink() {
    if (!profileUrl) return;
    try {
      await navigator.clipboard.writeText(profileUrl);
      haptic('success');
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      haptic('error');
    }
  }

  function shareLink() {
    if (!profileUrl) return;
    haptic('selection');
    const text = `Запишитесь ко мне онлайн: ${profileUrl}`;
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      navigator.share({ text, url: profileUrl }).catch(() => {});
    } else {
      copyLink();
    }
  }

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
      }, 900);
    } catch {
      setUploadError(mapError('network_error'));
    } finally {
      setUploadBusy(false);
    }
  }

  function tierAccent(tier: string): { strip: string; text: string } {
    const map: Record<string, { strip: string; text: string }> = {
      trial: { strip: 'bg-amber-500', text: 'text-amber-300' },
      starter: { strip: 'bg-slate-500', text: 'text-slate-300' },
      pro: { strip: 'bg-violet-500', text: 'text-violet-300' },
      business: { strip: 'bg-emerald-500', text: 'text-emerald-300' },
    };
    return map[tier] ?? map.trial;
  }

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

  const displayName = master.display_name || fullName || 'Мастер';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-5 px-5 pt-6 pb-10"
    >
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">Профиль</p>
      </div>

      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/[0.06] text-2xl font-bold text-white/90">
          {master.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={master.avatar_url} alt={displayName} className="size-full object-cover" />
          ) : (
            displayName[0]?.toUpperCase() ?? 'М'
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold">{displayName}</h1>
          {master.specialization && (
            <p className="mt-0.5 truncate text-[12px] text-white/60">{master.specialization}</p>
          )}
          <div className="mt-2 flex items-center gap-3 text-[11px] text-white/70">
            {master.rating > 0 && (
              <div className="flex items-center gap-1">
                <Star className="size-3 fill-amber-400 text-amber-400" />
                <span className="font-semibold">{Number(master.rating).toFixed(1)}</span>
                <span className="text-white/40">({master.total_reviews})</span>
              </div>
            )}
            {master.city && (
              <div className="flex items-center gap-1">
                <MapPin className="size-3" />
                <span>{master.city}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* New post CTA */}
      <button
        onClick={() => {
          haptic('light');
          fileInputRef.current?.click();
        }}
        className="relative flex w-full items-center gap-3 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-4 pl-5 text-left active:bg-white/[0.06] transition-colors"
      >
        <span className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-violet-500" />
        <div className="flex size-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-violet-300">
          <Plus className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold">Новая публикация</p>
          <p className="text-[11px] text-white/50">Покажите работы в ленте клиентов</p>
        </div>
        <ImagePlus className="size-4 text-white/40" />
      </button>
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

      {/* Subscription */}
      {sub && (() => {
        const accent = tierAccent(sub.tier);
        return (
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-4 pl-5">
            <span className={`absolute inset-y-3 left-0 w-1 rounded-r-full ${accent.strip}`} />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-white/40">Тариф</p>
                <p className={`mt-1 text-sm font-bold uppercase ${accent.text}`}>{sub.tier}</p>
              </div>
              <CreditCard className="size-5 text-white/40" />
            </div>
            {sub.tier === 'trial' && sub.trial_ends_at && (
              <p className="mt-2 text-[11px] text-white/60">
                До {new Date(sub.trial_ends_at).toLocaleDateString('ru')} · осталось{' '}
                {Math.max(0, Math.ceil((new Date(sub.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))} дн.
              </p>
            )}
            {sub.tier !== 'trial' && sub.current_period_end && (
              <p className="mt-2 text-[11px] text-white/60">Следующий платёж {new Date(sub.current_period_end).toLocaleDateString('ru')}</p>
            )}
          </div>
        );
      })()}

      {/* QR / Share */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Моя ссылка</p>
            <p className="mt-0.5 truncate text-[11px] text-white/50">{profileUrl}</p>
          </div>
          <button
            onClick={() => {
              haptic('light');
              setQrOpen((v) => !v);
            }}
            className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] active:bg-white/[0.06] transition-colors"
          >
            <QrCode className="size-4" />
          </button>
        </div>
        {qrOpen && qrUrl && (
          <div className="mt-4 flex flex-col items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrUrl} alt="QR" className="size-56 rounded-2xl bg-neutral-950 p-2" />
            <p className="text-[11px] text-white/50">Наведи камеру — клиент попадёт прямо на бронирование</p>
          </div>
        )}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            onClick={copyLink}
            className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] py-2.5 text-[12px] font-semibold active:bg-white/[0.06] transition-colors"
          >
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {copied ? 'Скопировано' : 'Копировать'}
          </button>
          <button
            onClick={shareLink}
            className="flex items-center justify-center gap-2 rounded-xl bg-white py-2.5 text-[12px] font-semibold text-black active:bg-white/80 transition-colors"
          >
            <Share2 className="size-3.5" /> Поделиться
          </button>
        </div>
      </div>

      {/* Menu */}
      <ul className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] divide-y divide-white/10">
        <li>
          <Link
            href="/ru/settings"
            onClick={() => haptic('light')}
            className="flex items-center justify-between px-4 py-4 active:bg-white/[0.06] transition-colors"
          >
            <span className="text-[13px] font-semibold">Настройки и услуги</span>
            <ChevronRight className="size-4 text-white/30" />
          </Link>
        </li>
        <li>
          <Link
            href="/ru/settings/billing"
            onClick={() => haptic('light')}
            className="flex items-center justify-between px-4 py-4 active:bg-white/[0.06] transition-colors"
          >
            <span className="text-[13px] font-semibold">Тариф и платежи</span>
            <ChevronRight className="size-4 text-white/30" />
          </Link>
        </li>
        <li>
          <Link
            href="/telegram/m/stats"
            onClick={() => haptic('light')}
            className="flex items-center justify-between px-4 py-4 active:bg-white/[0.06] transition-colors"
          >
            <span className="text-[13px] font-semibold">Статистика</span>
            <ChevronRight className="size-4 text-white/30" />
          </Link>
        </li>
      </ul>

      <button
        onClick={async () => {
          haptic('warning');
          const supabase = createClient();
          await supabase.auth.signOut();
          clearAuth();
          window.location.href = '/telegram';
        }}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] py-3 text-[12px] font-semibold text-white/60 active:bg-white/[0.06] transition-colors"
      >
        <LogOut className="size-3.5" /> Выйти
      </button>

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
              className="relative w-full max-w-md rounded-t-[32px] border-t border-white/10 bg-[#2f3437] p-5"
              style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-bold">Новая публикация</h3>
                <button
                  onClick={() => !uploadBusy && setUploadOpen(false)}
                  className="flex size-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] active:bg-white/[0.06] transition-colors"
                >
                  <X className="size-4" />
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
                  <Check className="size-4 text-emerald-600" />
                ) : (
                  <ImagePlus className="size-4" />
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
