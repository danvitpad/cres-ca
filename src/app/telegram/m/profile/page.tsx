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
import { Settings, Star, Share2, ExternalLink, Loader2, Users, LogOut, Pencil, X } from 'lucide-react';
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

interface TeamMembership {
  in_team: boolean;
  salon_id?: string;
  salon_name?: string | null;
  salon_logo_url?: string | null;
  role?: string;
  is_owner?: boolean;
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
  const [profileFirstName, setProfileFirstName] = useState<string>('');
  const [profileLastName, setProfileLastName] = useState<string>('');
  const [nameEditOpen, setNameEditOpen] = useState(false);
  const [nameSaving, setNameSaving] = useState(false);
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null);
  const [sub, setSub] = useState<SubInfo | null>(null);
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const [team, setTeam] = useState<TeamMembership | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [leaveConfirm, setLeaveConfirm] = useState(false);
  const [leaveKeepWithSalon, setLeaveKeepWithSalon] = useState(false);

  function getInitData(): string | null {
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
  }

  async function loadTeam() {
    const initData = getInitData();
    if (!initData) return;
    try {
      const res = await fetch('/api/telegram/m/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData, action: 'status' }),
      });
      if (!res.ok) return;
      const json = (await res.json()) as TeamMembership;
      setTeam(json);
    } catch { /* ignore */ }
  }

  async function leaveTeam() {
    if (!team?.salon_id) return;
    const initData = getInitData();
    if (!initData) return;
    setLeaving(true);
    try {
      const res = await fetch('/api/telegram/m/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData, action: 'leave', salonId: team.salon_id, keepWithSalon: leaveKeepWithSalon }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert((json as { message?: string }).message ?? 'Не удалось выйти из команды.');
        return;
      }
      haptic('success');
      setTeam({ in_team: false });
      setLeaveConfirm(false);
    } finally {
      setLeaving(false);
    }
  }

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
      // Prefer first_name + last_name (правильный порядок имени).
      // Fallback на full_name только если первые отдельно не заполнены.
      if (json.profile) {
        const fn = (json.profile.first_name as string | null) ?? '';
        const ln = (json.profile.last_name as string | null) ?? '';
        const composed = [fn, ln].filter(Boolean).join(' ').trim();
        const fallback = (json.profile.full_name as string | null) ?? '';
        setProfileFullName(composed || fallback);
        setProfileFirstName(fn);
        setProfileLastName(ln);
      }
      if (json.profile?.avatar_url) setProfileAvatar(json.profile.avatar_url as string);
      if (json.subscription) setSub(json.subscription as SubInfo);
      if (json.stats) setStats(json.stats as ProfileStats);
      setLoading(false);
      // Загружаем статус членства параллельно — не блокирует первый рендер.
      loadTeam();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
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
              <button
                type="button"
                onClick={() => { haptic('selection'); setNameEditOpen(true); }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: T.textTertiary,
                  flexShrink: 0,
                }}
                aria-label="Изменить имя"
              >
                <Pencil size={14} />
              </button>
            </div>
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

        {/* Команда — членство в салоне (если есть) */}
        {team?.in_team && team.salon_id && (
          <div
            style={{
              margin: `0 ${PAGE_PADDING_X}px`,
              padding: 14,
              background: T.surface,
              border: `1px solid ${T.borderSubtle}`,
              borderRadius: R.md,
              boxShadow: SHADOW.card,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  background: T.accentSoft,
                  color: T.accent,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  overflow: 'hidden',
                }}
              >
                {team.salon_logo_url ? (
                  <img src={team.salon_logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <Users size={20} strokeWidth={2.2} />
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ ...TYPE.micro, color: T.textTertiary }}>В КОМАНДЕ</div>
                <div style={{ ...TYPE.body, color: T.text, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {team.salon_name ?? 'Команда'}
                </div>
              </div>
            </div>
            {!team.is_owner && team.role !== 'admin' ? (
              leaveConfirm ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ fontSize: 13, color: T.textSecondary }}>
                    Что сделать с твоими будущими записями?
                  </div>
                  <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: 10, border: `1px solid ${T.border}`, borderRadius: R.md, cursor: 'pointer' }}>
                    <input type="radio" checked={!leaveKeepWithSalon} onChange={() => setLeaveKeepWithSalon(false)} style={{ marginTop: 3 }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>Записи переходят со мной</div>
                      <div style={{ fontSize: 11, color: T.textSecondary, marginTop: 2 }}>Перейдут в твой соло-календарь</div>
                    </div>
                  </label>
                  <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: 10, border: `1px solid ${T.border}`, borderRadius: R.md, cursor: 'pointer' }}>
                    <input type="radio" checked={leaveKeepWithSalon} onChange={() => setLeaveKeepWithSalon(true)} style={{ marginTop: 3 }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>Остаются у салона</div>
                      <div style={{ fontSize: 11, color: T.textSecondary, marginTop: 2 }}>Будут отменены, клиенты выберут другого мастера</div>
                    </div>
                  </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setLeaveConfirm(false)}
                    disabled={leaving}
                    style={{
                      flex: 1,
                      padding: '12px 14px',
                      borderRadius: R.md,
                      border: `1px solid ${T.border}`,
                      background: T.surface,
                      color: T.text,
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    Остаться
                  </button>
                  <button
                    type="button"
                    onClick={leaveTeam}
                    disabled={leaving}
                    style={{
                      flex: 1,
                      padding: '12px 14px',
                      borderRadius: R.md,
                      border: 'none',
                      background: '#dc2626',
                      color: '#fff',
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                  >
                    {leaving ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
                    Выйти
                  </button>
                </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => { haptic('light'); setLeaveConfirm(true); }}
                  style={{
                    padding: '10px 14px',
                    borderRadius: R.md,
                    border: `1px solid ${T.border}`,
                    background: 'transparent',
                    color: T.textSecondary,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  <LogOut size={14} strokeWidth={2.2} />
                  Покинуть команду
                </button>
              )
            ) : (
              <p style={{ ...TYPE.micro, margin: 0 }}>
                Вы {team.is_owner ? 'владелец' : 'админ'} команды. Чтобы выйти — передайте роль другому или закройте команду.
              </p>
            )}
          </div>
        )}

        {/* Actions row — share + open public page (single button, ?from=profile so the page can offer back nav) */}
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
              href={`/m/${master.invite_code}?owner=1&from=profile`}
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
              <ExternalLink size={16} strokeWidth={2.2} />
              Моя страница
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
              <ExternalLink size={16} strokeWidth={2.2} />
              Моя страница
            </button>
          )}
        </div>
      </motion.div>

      {nameEditOpen && (
        <NameEditSheet
          initialFirstName={profileFirstName}
          initialLastName={profileLastName}
          saving={nameSaving}
          onClose={() => setNameEditOpen(false)}
          onSave={async (fn, ln) => {
            const initData = (typeof window !== 'undefined' ? (window as { Telegram?: { WebApp?: { initData?: string } } }).Telegram?.WebApp?.initData : null) ?? '';
            if (!initData) return;
            setNameSaving(true);
            try {
              const res = await fetch('/api/telegram/m/profile', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ initData, first_name: fn, last_name: ln }),
              });
              if (res.ok) {
                setProfileFirstName(fn);
                setProfileLastName(ln);
                setProfileFullName([fn, ln].filter(Boolean).join(' '));
                setNameEditOpen(false);
              }
            } finally {
              setNameSaving(false);
            }
          }}
        />
      )}
    </MobilePage>
  );
}

function NameEditSheet({
  initialFirstName, initialLastName, saving, onClose, onSave,
}: {
  initialFirstName: string;
  initialLastName: string;
  saving: boolean;
  onClose: () => void;
  onSave: (firstName: string, lastName: string) => void;
}) {
  const [fn, setFn] = useState(initialFirstName);
  const [ln, setLn] = useState(initialLastName);

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', background: T.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 32, boxShadow: SHADOW.elevated }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ ...TYPE.h3, color: T.text, margin: 0 }}>Имя и фамилия</h2>
          <button
            type="button"
            onClick={onClose}
            style={{ background: T.bgSubtle, border: 'none', width: 32, height: 32, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <X size={16} color={T.text} />
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <p style={{ ...TYPE.caption, color: T.textSecondary, margin: '0 0 4px 4px' }}>Имя</p>
            <input
              autoFocus
              value={fn}
              onChange={(e) => setFn(e.target.value)}
              placeholder="Даниил"
              style={{ width: '100%', padding: '12px 14px', borderRadius: R.md, border: `1px solid ${T.border}`, background: T.surfaceElevated, fontSize: 14, color: T.text, fontFamily: 'inherit', outline: 'none' }}
            />
          </div>
          <div>
            <p style={{ ...TYPE.caption, color: T.textSecondary, margin: '0 0 4px 4px' }}>Фамилия</p>
            <input
              value={ln}
              onChange={(e) => setLn(e.target.value)}
              placeholder="Падалко"
              style={{ width: '100%', padding: '12px 14px', borderRadius: R.md, border: `1px solid ${T.border}`, background: T.surfaceElevated, fontSize: 14, color: T.text, fontFamily: 'inherit', outline: 'none' }}
            />
          </div>
          <button
            type="button"
            onClick={() => onSave(fn.trim(), ln.trim())}
            disabled={saving || !fn.trim()}
            style={{ marginTop: 6, padding: '14px 16px', borderRadius: R.pill, border: 'none', background: T.text, color: T.bg, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: saving || !fn.trim() ? 0.6 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            {saving && <Loader2 size={14} className="animate-spin" />} Сохранить
          </button>
        </div>
      </div>
    </div>
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
