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
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Settings, Star, Share2, ExternalLink, Loader2, Pencil, X, Globe } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useTelegram } from '@/components/miniapp/telegram-provider';
import { MobilePage, AvatarCircle } from '@/components/miniapp/shells';
import { T, R, TYPE, SHADOW, PAGE_PADDING_X } from '@/components/miniapp/design';
import { MiniAppAvatarCropSheet } from '@/components/miniapp/avatar-crop-sheet';
import { getInitData as getInitDataLib } from '@/lib/telegram/webapp';
import { useMiniAppLocale, type MiniAppLang } from '@/lib/miniapp/use-locale';

const I18N: Record<MiniAppLang, {
  notFound: string; defaultName: string;
  trial: string; tierStarter: string; tierPro: string; tierBusiness: string; tierFree: string;
  changeAvatar: string; settings: string; editName: string;
  statsWorks: string; statsClients: string; statsRating: string; statsReviews: (n: number) => string;
  share: string; myPage: string;
  avatarTitle: string;
  fileTooLarge: string;
  nameSheetTitle: string; firstName: string; lastName: string; saving: string; saveBtn: string;
  firstNamePh: string; lastNamePh: string;
  close: string;
  publicPageTitle: string; publicPageHint: string; publicPageEdit: string;
}> = {
  uk: {
    notFound: 'Профіль майстра не знайдено.', defaultName: 'Майстер',
    trial: 'Тріал', tierStarter: 'Старт', tierPro: 'Про', tierBusiness: 'Бізнес', tierFree: 'Free',
    changeAvatar: 'Змінити аватар', settings: 'Налаштування', editName: 'Змінити імʼя',
    statsWorks: 'Робіт', statsClients: 'Клієнтів', statsRating: 'Рейтинг',
    statsReviews: (n) => `${n} відгуків`,
    share: 'Поділитись', myPage: 'Моя сторінка',
    avatarTitle: 'Аватар',
    fileTooLarge: 'Файл більший за 8 МБ',
    nameSheetTitle: 'Імʼя та прізвище', firstName: 'Імʼя', lastName: 'Прізвище',
    saving: 'Зберігаємо…', saveBtn: 'Зберегти',
    firstNamePh: 'Даніїл', lastNamePh: 'Падалко',
    close: 'Закрити',
    publicPageTitle: 'Моя публічна сторінка',
    publicPageHint: 'Як тебе бачать клієнти. Відкрий — і редагуй прямо там.',
    publicPageEdit: 'Відкрити та редагувати',
  },
  ru: {
    notFound: 'Профиль мастера не найден.', defaultName: 'Мастер',
    trial: 'Триал', tierStarter: 'Старт', tierPro: 'Про', tierBusiness: 'Бизнес', tierFree: 'Free',
    changeAvatar: 'Сменить аватар', settings: 'Настройки', editName: 'Изменить имя',
    statsWorks: 'Работ', statsClients: 'Клиентов', statsRating: 'Рейтинг',
    statsReviews: (n) => `${n} отзывов`,
    share: 'Поделиться', myPage: 'Моя страница',
    avatarTitle: 'Аватар',
    fileTooLarge: 'Файл больше 8 МБ',
    nameSheetTitle: 'Имя и фамилия', firstName: 'Имя', lastName: 'Фамилия',
    saving: 'Сохраняем…', saveBtn: 'Сохранить',
    firstNamePh: 'Даниил', lastNamePh: 'Падалко',
    close: 'Закрыть',
    publicPageTitle: 'Моя публичная страница',
    publicPageHint: 'Как тебя видят клиенты. Открой — и редактируй прямо там.',
    publicPageEdit: 'Открыть и редактировать',
  },
  en: {
    notFound: 'Master profile not found.', defaultName: 'Master',
    trial: 'Trial', tierStarter: 'Starter', tierPro: 'Pro', tierBusiness: 'Business', tierFree: 'Free',
    changeAvatar: 'Change avatar', settings: 'Settings', editName: 'Edit name',
    statsWorks: 'Visits', statsClients: 'Clients', statsRating: 'Rating',
    statsReviews: (n) => `${n} reviews`,
    share: 'Share', myPage: 'My page',
    avatarTitle: 'Avatar',
    fileTooLarge: 'File over 8 MB',
    nameSheetTitle: 'First & last name', firstName: 'First name', lastName: 'Last name',
    saving: 'Saving…', saveBtn: 'Save',
    firstNamePh: 'Daniel', lastNamePh: 'Padalko',
    close: 'Close',
    publicPageTitle: 'My public page',
    publicPageHint: 'How clients see you. Open — and edit right there.',
    publicPageEdit: 'Open and edit',
  },
};

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

function tierLabelFor(tier: string | null | undefined, t: typeof I18N['ru']): string | null {
  if (!tier) return null;
  switch (tier) {
    case 'trial':    return t.trial;
    case 'starter':  return t.tierStarter;
    case 'pro':      return t.tierPro;
    case 'business': return t.tierBusiness;
    case 'free':     return t.tierFree;
    default:         return tier;
  }
}

export default function MasterMiniAppProfile() {
  const { haptic } = useTelegram();
  const router = useRouter();
  const { userId } = useAuthStore();
  const lang = useMiniAppLocale();
  const t = I18N[lang];
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
    // Идём через тот же endpoint что и клиент (/api/profile/avatar) — service-role +
    // валидация initData. Раньше был прямой `supabase.storage.upload + profiles.update`
    // через cookie session, но в Mini App мастера часто нет cookie session (заходит
    // только через TG initData) → upload падал на RLS. Теперь — паритет с клиентом.
    setAvatarBusy(true);
    try {
      const initData = getInitDataLib();
      const form = new FormData();
      form.append('file', blob, `avatar-${Date.now()}.webp`);
      const res = await fetch('/api/profile/avatar', {
        method: 'POST',
        headers: { ...(initData ? { 'X-TG-Init-Data': initData } : {}) },
        body: form,
      });
      if (!res.ok) { haptic('error'); return; }
      const data = await res.json().catch(() => ({} as { avatarUrl?: string }));
      if (data?.avatarUrl) {
        setProfileAvatar(data.avatarUrl);
        haptic('success');
      } else {
        haptic('error');
      }
    } catch {
      haptic('error');
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
      // initData необязателен — API принимает и cookie session (browser users)
      const res = await fetch('/api/telegram/m/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: initData ?? null }),
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
          <p style={{ ...TYPE.body, color: T.textSecondary }}>{t.notFound}</p>
        </div>
      </MobilePage>
    );
  }

  const displayName = profileFullName || master.display_name || t.defaultName;
  const avatar = profileAvatar || master.avatar_url;
  const isTrial = sub?.status === 'trialing' || sub?.tier === 'trial';
  const tierLabel = isTrial ? t.trial : tierLabelFor(sub?.tier, t);

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
        {/* Close button — full-screen profile lives outside tab nav, нужен явный возврат */}
        <div style={{ padding: `12px ${PAGE_PADDING_X}px 0` }}>
          <button
            type="button"
            onClick={() => { haptic('light'); router.back(); }}
            aria-label={t.close}
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              border: `1px solid ${T.border}`,
              background: T.surface,
              color: T.text,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              padding: 0,
              boxShadow: SHADOW.card,
            }}
          >
            <X size={18} strokeWidth={2.4} />
          </button>
        </div>

        {/* Hero: avatar + name + tier */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: `4px ${PAGE_PADDING_X}px 0` }}>
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
            aria-label={t.changeAvatar}
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
              if (f.size > 8 * 1024 * 1024) { alert(t.fileTooLarge); return; }
              setCropSrc(URL.createObjectURL(f));
              e.target.value = '';
            }}
          />
          <MiniAppAvatarCropSheet
            src={cropSrc}
            title={t.avatarTitle}
            onClose={() => { if (cropSrc) URL.revokeObjectURL(cropSrc); setCropSrc(null); }}
            onCropped={uploadCroppedAvatar}
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
                aria-label={t.editName}
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
        </div>

        {/* Stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, padding: `0 ${PAGE_PADDING_X}px` }}>
          <StatItem value={stats?.appointments ?? 0} label={t.statsWorks} />
          <StatItem value={stats?.clients ?? 0} label={t.statsClients} />
          <StatItem
            value={master.rating > 0 ? master.rating.toFixed(1) : '—'}
            label={master.total_reviews > 0 ? t.statsReviews(master.total_reviews) : t.statsRating}
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

        {/* Моя публичная страница — отдельный заметный блок: иконка + описание + 2 действия */}
        <div
          style={{
            margin: `0 ${PAGE_PADDING_X}px`,
            padding: 16,
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
            <span
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: T.accentSoft,
                color: T.accent,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Globe size={20} strokeWidth={2.2} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: T.text, margin: 0 }}>{t.publicPageTitle}</p>
              <p style={{ fontSize: 12, color: T.textTertiary, margin: '2px 0 0' }}>{t.publicPageHint}</p>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
            <button
              type="button"
              onClick={shareLink}
              disabled={!master.invite_code}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '12px 16px',
                borderRadius: R.pill,
                border: `1px solid ${T.border}`,
                background: T.surface,
                color: master.invite_code ? T.text : T.textTertiary,
                fontSize: 13,
                fontWeight: 600,
                cursor: master.invite_code ? 'pointer' : 'not-allowed',
                fontFamily: 'inherit',
                opacity: master.invite_code ? 1 : 0.5,
              }}
            >
              <Share2 size={15} strokeWidth={2.2} />
              {t.share}
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
                  padding: '12px 16px',
                  borderRadius: R.pill,
                  border: 'none',
                  background: T.text,
                  color: T.bg,
                  fontSize: 13,
                  fontWeight: 700,
                  textDecoration: 'none',
                }}
              >
                <ExternalLink size={15} strokeWidth={2.2} />
                {t.publicPageEdit}
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
                  padding: '12px 16px',
                  borderRadius: R.pill,
                  border: 'none',
                  background: T.bgSubtle,
                  color: T.textTertiary,
                  fontSize: 13,
                  fontWeight: 700,
                  opacity: 0.6,
                  cursor: 'not-allowed',
                  fontFamily: 'inherit',
                }}
              >
                <ExternalLink size={15} strokeWidth={2.2} />
                {t.publicPageEdit}
              </button>
            )}
          </div>
        </div>

        {/* Настройки — карточка-ссылка */}
        <Link
          href="/telegram/m/settings"
          onClick={() => haptic('light')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            margin: `0 ${PAGE_PADDING_X}px`,
            padding: '14px 16px',
            background: T.surface,
            border: `1px solid ${T.borderSubtle}`,
            borderRadius: R.md,
            boxShadow: SHADOW.card,
            textDecoration: 'none',
            color: T.text,
          }}
        >
          <span
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: T.accentSoft,
              color: T.accent,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Settings size={18} strokeWidth={2.2} />
          </span>
          <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{t.settings}</span>
        </Link>
      </motion.div>

      {nameEditOpen && (
        <NameEditSheet
          t={t}
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
  t, initialFirstName, initialLastName, saving, onClose, onSave,
}: {
  t: typeof I18N['ru'];
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
          <h2 style={{ ...TYPE.h3, color: T.text, margin: 0 }}>{t.nameSheetTitle}</h2>
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
            <p style={{ ...TYPE.caption, color: T.textSecondary, margin: '0 0 4px 4px' }}>{t.firstName}</p>
            <input
              autoFocus
              value={fn}
              onChange={(e) => setFn(e.target.value)}
              placeholder={t.firstNamePh}
              style={{ width: '100%', padding: '12px 14px', borderRadius: R.md, border: `1px solid ${T.border}`, background: T.surfaceElevated, fontSize: 14, color: T.text, fontFamily: 'inherit', outline: 'none' }}
            />
          </div>
          <div>
            <p style={{ ...TYPE.caption, color: T.textSecondary, margin: '0 0 4px 4px' }}>{t.lastName}</p>
            <input
              value={ln}
              onChange={(e) => setLn(e.target.value)}
              placeholder={t.lastNamePh}
              style={{ width: '100%', padding: '12px 14px', borderRadius: R.md, border: `1px solid ${T.border}`, background: T.surfaceElevated, fontSize: 14, color: T.text, fontFamily: 'inherit', outline: 'none' }}
            />
          </div>
          <button
            type="button"
            onClick={() => onSave(fn.trim(), ln.trim())}
            disabled={saving || !fn.trim()}
            style={{ marginTop: 6, padding: '14px 16px', borderRadius: R.pill, border: 'none', background: T.text, color: T.bg, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: saving || !fn.trim() ? 0.6 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            {saving && <Loader2 size={14} className="animate-spin" />} {saving ? t.saving : t.saveBtn}
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
