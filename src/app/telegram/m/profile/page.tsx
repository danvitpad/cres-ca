/** --- YAML
 * name: MasterMiniAppProfile
 * description: Mini App мастер-профиль — Fresha-premium 2026 (light theme).
 *              Avatar + name + specialization + tier badge + stats grid + bio.
 *              Actions row: Поделиться + Портфолио. Public-page link внизу.
 * created: 2026-04-13
 * updated: 2026-04-26
 * --- */

'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { motion } from 'framer-motion';
import { Settings, Star, Share2, Image as ImageIcon, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useTelegram } from '@/components/miniapp/telegram-provider';
import { MobilePage, AvatarCircle } from '@/components/miniapp/shells';
import { T, R, TYPE, SHADOW, PAGE_PADDING_X } from '@/components/miniapp/design';
import { ImageCropDialog } from '@/components/ui/image-crop-dialog';

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
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  async function uploadCroppedAvatar(blob: Blob) {
    setAvatarBusy(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const path = `${user.id}/avatar-${Date.now()}.webp`;
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, blob, {
        contentType: blob.type, cacheControl: '3600', upsert: false,
      });
      if (upErr) { alert(`Ошибка загрузки: ${upErr.message}`); return; }
      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
      await supabase.from('profiles').update({ avatar_url: pub.publicUrl }).eq('id', user.id);
      setProfileAvatar(pub.publicUrl);
      haptic('success');
    } finally {
      setAvatarBusy(false);
    }
  }

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
      <MobilePage>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60dvh' }}>
          <Loader2 size={24} className="animate-spin" color={T.textTertiary} />
        </div>
      </MobilePage>
    );
  }

  if (!master) {
    return (
      <MobilePage>
        <div style={{ padding: '40px 20px', textAlign: 'center' }}>
          <p style={{ ...TYPE.body, color: T.textSecondary }}>Профиль мастера не найден.</p>
        </div>
      </MobilePage>
    );
  }

  const displayName = profileFullName || master.display_name || 'Мастер';
  const avatar = profileAvatar || master.avatar_url;
  const isTrial = sub?.status === 'trialing' || sub?.tier === 'trial';
  const tierLabel = isTrial ? 'Триал' : sub?.tier ? TIER_LABEL[sub.tier] ?? sub.tier : null;

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
    <MobilePage>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
      >
        {/* Hero: avatar + name + tier + settings */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: `28px ${PAGE_PADDING_X}px 0` }}>
          <button
            type="button"
            onClick={() => avatarInputRef.current?.click()}
            disabled={avatarBusy}
            style={{
              position: 'relative',
              width: 80,
              height: 80,
              flexShrink: 0,
              padding: 0,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              borderRadius: '50%',
            }}
            aria-label="Сменить аватар"
          >
            <AvatarCircle url={avatar} name={displayName} size={80} />
            {avatarBusy && (
              <span
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '50%',
                  background: 'rgba(0,0,0,0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Loader2 size={20} className="animate-spin" color="#fff" />
              </span>
            )}
          </button>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              if (!f.type.startsWith('image/')) return;
              if (f.size > 8 * 1024 * 1024) { alert('Файл больше 8 MB'); return; }
              setCropSrc(URL.createObjectURL(f));
              e.target.value = '';
            }}
          />
          <ImageCropDialog
            open={!!cropSrc}
            src={cropSrc}
            onClose={() => { if (cropSrc) URL.revokeObjectURL(cropSrc); setCropSrc(null); }}
            onCropped={uploadCroppedAvatar}
            title="Аватар"
            aspect={1}
            shape="round"
            outputSize={512}
          />
          <div style={{ flex: 1, minWidth: 0, paddingTop: 4 }}>
            <h1
              style={{
                ...TYPE.h2,
                color: T.text,
                margin: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontSize: 22,
              }}
            >
              {displayName}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
              {master.specialization && (
                <span
                  style={{
                    ...TYPE.caption,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: 180,
                  }}
                >
                  {master.specialization}
                </span>
              )}
              {tierLabel && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '2px 8px',
                    borderRadius: 999,
                    background: T.accentSoft,
                    color: T.accent,
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  {tierLabel}
                </span>
              )}
            </div>
            {master.city && (
              <p style={{ ...TYPE.micro, marginTop: 4 }}>{master.city}</p>
            )}
          </div>
          <Link
            href="/telegram/m/settings"
            onClick={() => haptic('light')}
            style={{
              flexShrink: 0,
              width: 44,
              height: 44,
              borderRadius: '50%',
              border: `1px solid ${T.border}`,
              background: T.surface,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: T.text,
              textDecoration: 'none',
            }}
            aria-label="Настройки"
          >
            <Settings size={20} strokeWidth={2} />
          </Link>
        </div>

        {/* Stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, padding: `0 ${PAGE_PADDING_X}px` }}>
          <StatItem value={stats?.appointments ?? 0} label="Работ" />
          <StatItem value={stats?.clients ?? 0} label="Клиентов" />
          <StatItem
            value={master.rating > 0 ? master.rating.toFixed(1) : '—'}
            label={master.total_reviews > 0 ? `${master.total_reviews} отзывов` : 'Рейтинг'}
            withStar={master.rating > 0}
          />
        </div>

        {/* Bio */}
        {master.bio && (
          <div
            style={{
              margin: `0 ${PAGE_PADDING_X}px`,
              padding: 16,
              background: T.surface,
              border: `1px solid ${T.borderSubtle}`,
              borderRadius: R.md,
              boxShadow: SHADOW.card,
            }}
          >
            <p style={{ ...TYPE.body, color: T.text, whiteSpace: 'pre-wrap', margin: 0 }}>
              {master.bio}
            </p>
          </div>
        )}

        {/* Actions row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, padding: `0 ${PAGE_PADDING_X}px` }}>
          <button
            type="button"
            onClick={shareLink}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '14px 16px',
              borderRadius: R.md,
              border: `1px solid ${T.border}`,
              background: T.surface,
              color: T.text,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
              boxShadow: SHADOW.card,
            }}
          >
            <Share2 size={16} strokeWidth={2.2} />
            Поделиться
          </button>
          {master.invite_code ? (
            <Link
              href={`/m/${master.invite_code}?owner=1#portfolio`}
              onClick={() => haptic('light')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '14px 16px',
                borderRadius: R.md,
                border: `1px solid ${T.border}`,
                background: T.surface,
                color: T.text,
                fontSize: 14,
                fontWeight: 600,
                textDecoration: 'none',
                boxShadow: SHADOW.card,
              }}
            >
              <ImageIcon size={16} strokeWidth={2.2} />
              Портфолио
            </Link>
          ) : (
            <button
              type="button"
              disabled
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '14px 16px',
                borderRadius: R.md,
                border: `1px solid ${T.border}`,
                background: T.surface,
                color: T.textTertiary,
                fontSize: 14,
                fontWeight: 600,
                opacity: 0.5,
                cursor: 'not-allowed',
                fontFamily: 'inherit',
              }}
            >
              <ImageIcon size={16} strokeWidth={2.2} />
              Портфолио
            </button>
          )}
        </div>

        {master.invite_code && (
          <Link
            href={`/m/${master.invite_code}?owner=1`}
            onClick={() => haptic('light')}
            style={{
              margin: `0 ${PAGE_PADDING_X}px`,
              padding: 14,
              borderRadius: R.md,
              border: `1px solid ${T.borderSubtle}`,
              background: T.surface,
              textAlign: 'center',
              ...TYPE.caption,
              color: T.textSecondary,
              textDecoration: 'none',
            }}
          >
            Открыть публичную страницу
          </Link>
        )}
      </motion.div>
    </MobilePage>
  );
}

function StatItem({ value, label, withStar }: { value: number | string; label: string; withStar?: boolean }) {
  return (
    <div
      style={{
        background: T.surface,
        border: `1px solid ${T.borderSubtle}`,
        borderRadius: R.md,
        padding: 14,
        textAlign: 'center',
        boxShadow: SHADOW.card,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          fontSize: 20,
          fontWeight: 800,
          color: T.text,
          letterSpacing: '-0.01em',
        }}
      >
        {withStar && <Star size={16} fill="#f59e0b" color="#f59e0b" />}
        <span>{value}</span>
      </div>
      <p
        style={{
          marginTop: 4,
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: T.textTertiary,
        }}
      >
        {label}
      </p>
    </div>
  );
}
