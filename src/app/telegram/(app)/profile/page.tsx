/** --- YAML
 * name: MiniAppProfilePage
 * description: Mini App клиента — Fresha-premium 2026. Светлая тема, gradient
 *              wallet-card, чистые menu-list карточки. Бизнес-логика (avatar
 *              upload / edit modal / followers list / sign out) сохранена.
 * created: 2026-04-13
 * updated: 2026-04-26
 * --- */

'use client';

import { useEffect, useRef, useState } from 'react';
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
  MessageCircle,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { useTelegram } from '@/components/miniapp/telegram-provider';
import { MiniAppAvatarCropSheet } from '@/components/miniapp/avatar-crop-sheet';
import { mapError } from '@/lib/errors';
import { getInitData } from '@/lib/telegram/webapp';
import {
  MobilePage,
  PageHeader,
  MenuList,
  AvatarCircle,
  type MenuItem,
} from '@/components/miniapp/shells';
import { T, R, TYPE, PAGE_PADDING_X, SHADOW } from '@/components/miniapp/design';
import { useMiniAppLocale } from '@/lib/miniapp/use-locale';

type Lang = 'uk' | 'ru' | 'en';

const I18N: Record<Lang, {
  subtitle: string;
  menuProfile: string; menuContacts: string; menuSettings: string; menuSupport: string;
  logout: string; loggingOut: string;
  editTitle: string; save: string;
  fieldFirstName: string; fieldLastName: string; fieldEmail: string; fieldPhone: string;
  fieldSlug: string; fieldBio: string;
  slugHint: string; bioCount: string;
  emailReadonlyHint: string;
  sectionPersonal: string; sectionContact: string; sectionPublic: string;
  followers: string; following: string;
  masterBadge: string; empty: string; user: string;
  close: string; avatarLabel: string;
  saveError: string; avatarTitle: string; guest: string;
}> = {
  uk: {
    subtitle: 'Особистий профіль',
    menuProfile: 'Профіль', menuContacts: 'Контакти', menuSettings: 'Налаштування', menuSupport: 'Підтримка',
    logout: 'Вийти', loggingOut: 'Виходимо...',
    editTitle: 'Редагувати профіль', save: 'Зберегти',
    fieldFirstName: 'Ім\'я', fieldLastName: 'Прізвище',
    fieldEmail: 'Email', fieldPhone: 'Телефон',
    fieldSlug: 'Ім\'я посилання (slug)', fieldBio: 'Про себе',
    slugHint: '3–32 символи: латиниця, цифри, крапка, дефіс, підкреслення',
    emailReadonlyHint: 'Email прив\'язаний через Telegram — змінити можна тільки у веб-кабінеті',
    sectionPersonal: 'Особисті дані',
    sectionContact: 'Контакти',
    sectionPublic: 'Публічна сторінка',
    saveError: 'Не вдалось зберегти', avatarTitle: 'Аватар', guest: 'Гість',
    bioCount: '/280',
    followers: 'Підписники', following: 'Обрані',
    masterBadge: ' · Майстер', empty: 'Порожньо', user: 'Користувач',
    close: 'Закрити', avatarLabel: 'Змінити аватар',
  },
  ru: {
    subtitle: 'Личный профиль',
    menuProfile: 'Профиль', menuContacts: 'Контакты', menuSettings: 'Настройки', menuSupport: 'Поддержка',
    logout: 'Выйти', loggingOut: 'Выходим...',
    editTitle: 'Редактировать профиль', save: 'Сохранить',
    fieldFirstName: 'Имя', fieldLastName: 'Фамилия',
    fieldEmail: 'Email', fieldPhone: 'Телефон',
    fieldSlug: 'Имя ссылки (slug)', fieldBio: 'О себе',
    slugHint: '3–32 символа: латиница, цифры, точка, дефис, подчёркивание',
    emailReadonlyHint: 'Email привязан через Telegram — поменять можно только в веб-кабинете',
    sectionPersonal: 'Личные данные',
    sectionContact: 'Контакты',
    sectionPublic: 'Публичная страница',
    saveError: 'Не удалось сохранить', avatarTitle: 'Аватар', guest: 'Гость',
    bioCount: '/280',
    followers: 'Подписчики', following: 'Избранное',
    masterBadge: ' · Мастер', empty: 'Пусто', user: 'Пользователь',
    close: 'Закрыть', avatarLabel: 'Изменить аватар',
  },
  en: {
    subtitle: 'Personal profile',
    menuProfile: 'Profile', menuContacts: 'Contacts', menuSettings: 'Settings', menuSupport: 'Support',
    logout: 'Sign out', loggingOut: 'Signing out...',
    editTitle: 'Edit profile', save: 'Save',
    fieldFirstName: 'First name', fieldLastName: 'Last name',
    fieldEmail: 'Email', fieldPhone: 'Phone',
    fieldSlug: 'Link name (slug)', fieldBio: 'About',
    slugHint: '3–32 chars: latin letters, numbers, dot, dash, underscore',
    emailReadonlyHint: 'Email is linked via Telegram — change it from the web app',
    sectionPersonal: 'Personal',
    sectionContact: 'Contact',
    sectionPublic: 'Public page',
    bioCount: '/280',
    followers: 'Followers', following: 'Saved',
    masterBadge: ' · Master', empty: 'Empty', user: 'User',
    close: 'Close', avatarLabel: 'Change avatar',
    saveError: 'Failed to save', avatarTitle: 'Avatar', guest: 'Guest',
  },
};

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
  const lang = useMiniAppLocale();
  const t = I18N[lang];
  // balance removed — loyalty/bonuses temporarily hidden
  const [fullName, setFullName] = useState<string | null>(null);
  const [bio, setBio] = useState<string | null>(null);
  const [slug, setSlug] = useState<string | null>(null);
  const [, setPublicId] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [followingCount, setFollowingCount] = useState(0);
  const [signingOut, setSigningOut] = useState(false);

  // Follow list modal
  const [listOpen, setListOpen] = useState(false);
  const [listType] = useState<'followers' | 'following'>('following');
  const [listLoading, setListLoading] = useState(false);
  const [listEntries, setListEntries] = useState<FollowListEntry[]>([]);

  // Avatar upload
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);

  // Profile contact data — отдельно от full_name, чтобы дать клиенту
  // редактировать почту/телефон. У TG-юзеров email обычно auto-generated
  // (например `tg-12345@cres-ca.com`), такие маркируем readonly.
  const [email, setEmail] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);

  // Edit profile modal state — first/last разделены, чтобы клиент мог
  // править имя и фамилию по отдельности (потом склеиваем в full_name).
  const [editOpen, setEditOpen] = useState(false);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
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
          setFullName(data.full_name ?? null);
          setBio(data.bio ?? null);
          setSlug(data.slug ?? null);
          setPublicId(data.public_id ?? null);
          setAvatarUrl(data.avatar_url ?? null);
          setEmail(data.email ?? null);
          setPhone(data.phone ?? null);
          setFollowingCount(Number(data.following_count ?? 0));
        }
      }
      setProfileLoaded(true);
    })();
  }, [userId]);

  function openEdit() {
    // Разбиваем full_name на first/last по первому пробелу. Если ничего
    // нет — пробуем TG данные пользователя (он точно есть в Mini App).
    const source = fullName || tgFullName || '';
    const trimmed = source.trim();
    const spaceIdx = trimmed.indexOf(' ');
    const first = spaceIdx === -1 ? trimmed : trimmed.slice(0, spaceIdx);
    const last = spaceIdx === -1 ? '' : trimmed.slice(spaceIdx + 1);
    setEditFirstName(first);
    setEditLastName(last);
    setEditEmail(email ?? '');
    setEditPhone(phone ?? '');
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
      // В Mini App нет Supabase cookie-сессии — авторизуемся через
      // Telegram initData (header X-TG-Init-Data). resolveUserId на сервере
      // вытащит user_id по telegram_id из profiles.
      const initData = getInitData();
      const composedFullName = `${editFirstName.trim()} ${editLastName.trim()}`.trim();
      const phoneClean = editPhone.trim() || null;
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(initData ? { 'X-TG-Init-Data': initData } : {}),
        },
        body: JSON.stringify({
          fullName: composedFullName || null,
          bio: editBio.trim() || null,
          slug: editSlug.trim() || null,
          phone: phoneClean,
          // email отправляем только если поменялся И не выглядит как
          // TG auto-generated адрес — менять auto-email не даём (см. UI).
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setEditError(mapError(data.error, t.saveError));
        haptic('error');
        return;
      }
      setFullName(composedFullName || null);
      setBio(editBio.trim() || null);
      setSlug(editSlug.trim() || null);
      setPhone(phoneClean);
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

  function onAvatarFile(file: File) {
    if (!file.type.startsWith('image/')) return;
    if (file.size > 8 * 1024 * 1024) { haptic('error'); return; }
    setCropSrc(URL.createObjectURL(file));
  }

  async function onAvatarCropped(blob: Blob) {
    if (!userId || avatarBusy) return;
    setAvatarBusy(true);
    try {
      // Mini App-юзер аутентифицирован через Telegram initData — у него нет
      // Supabase cookie-сессии, поэтому прямая загрузка в storage падает на
      // RLS. Шлём через /api/profile/avatar — там service-role.
      const initData = getInitData();
      const form = new FormData();
      form.append('file', blob, `avatar-${Date.now()}.webp`);
      const res = await fetch('/api/profile/avatar', {
        method: 'POST',
        headers: {
          ...(initData ? { 'X-TG-Init-Data': initData } : {}),
        },
        body: form,
      });
      if (!res.ok) {
        haptic('error');
        return;
      }
      const data = await res.json().catch(() => ({} as { avatarUrl?: string }));
      if (data?.avatarUrl) {
        setAvatarUrl(data.avatarUrl);
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

  const tgFullName = user ? `${user.first_name}${user.last_name ? ' ' + user.last_name : ''}` : '';
  const displayName = profileLoaded ? (fullName ?? tgFullName ?? t.guest) : '';

  // Auto-open edit modal when navigated from settings with ?edit=true
  useEffect(() => {
    if (profileLoaded && searchParams.get('edit') === 'true') {
      openEdit();
      router.replace('/telegram/profile', { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileLoaded]);

  const mainMenu: MenuItem[] = [
    {
      key: 'profile',
      icon: <UserIcon size={22} strokeWidth={1.8} />,
      label: t.menuProfile,
      onClick: openEdit,
      rightSlot: <ChevronRight size={20} color={T.textTertiary} />,
    },
    {
      key: 'contacts',
      icon: <Users size={22} strokeWidth={1.8} />,
      label: t.menuContacts,
      href: '/telegram/connections',
      rightSlot: (
        <>
          {followingCount > 0 && (
            <span style={{ ...TYPE.caption, fontWeight: 600 }}>{followingCount}</span>
          )}
          <ChevronRight size={20} color={T.textTertiary} />
        </>
      ),
    },
    {
      key: 'settings',
      icon: <Settings size={22} strokeWidth={1.8} />,
      label: t.menuSettings,
      href: '/telegram/settings',
      rightSlot: <ChevronRight size={20} color={T.textTertiary} />,
    },
  ];

  const supportMenu: MenuItem[] = [
    {
      key: 'support',
      icon: <MessageCircle size={22} strokeWidth={1.8} />,
      label: t.menuSupport,
      onClick: () => window.open('https://t.me/crescacom_bot?start=support', '_blank'),
      rightSlot: <ChevronRight size={20} color={T.textTertiary} />,
    },
  ];

  const logoutMenu: MenuItem[] = [
    {
      key: 'logout',
      icon: <LogOut size={22} strokeWidth={1.8} />,
      label: signingOut ? t.loggingOut : t.logout,
      onClick: signOut,
      danger: true,
    },
  ];

  return (
    <MobilePage>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        style={{ display: 'flex', flexDirection: 'column', gap: 24 }}
      >
        <PageHeader
          title={displayName || ' '}
          subtitle={t.subtitle}
          right={
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={avatarBusy}
              style={{
                position: 'relative',
                width: 64,
                height: 64,
                borderRadius: '50%',
                background: 'transparent',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                WebkitTapHighlightColor: 'transparent',
              }}
              aria-label={t.avatarLabel}
            >
              <AvatarCircle url={avatarUrl} name={displayName} size={64} />
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
                  <Loader2 size={20} color="#fff" className="animate-spin" />
                </span>
              )}
            </button>
          }
        />

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onAvatarFile(f);
            e.target.value = '';
          }}
        />
        <MiniAppAvatarCropSheet
          src={cropSrc}
          title={t.avatarTitle}
          onClose={() => { if (cropSrc) URL.revokeObjectURL(cropSrc); setCropSrc(null); }}
          onCropped={onAvatarCropped}
        />

        {/* GradientHeroCard (wallet balance) — hidden: loyalty/bonuses temporarily disabled */}

        <MenuList items={mainMenu} />
        <MenuList items={supportMenu} />
        <MenuList items={logoutMenu} />

        <div style={{ height: 8 }} />
      </motion.div>

      {/* Edit profile bottom sheet */}
      <AnimatePresence>
        {editOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setEditOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 60,
              background: 'rgba(10,10,12,0.5)',
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
            }}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: 460,
                background: T.surface,
                borderRadius: `${R.lg}px ${R.lg}px 0 0`,
                padding: `20px ${PAGE_PADDING_X}px`,
                paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
                boxShadow: SHADOW.elevated,
                // dvh = dynamic viewport height: автоматически ужимается когда
                // клавиатура открыта (в отличие от vh, который остаётся
                // фиксированным). Это значит когда юзер начинает печатать,
                // sheet физически меньше → кнопка «Сохранить» внизу
                // остаётся в видимой части, и юзер просто скроллит к ней.
                maxHeight: '90dvh',
                overflowY: 'auto',
                overscrollBehavior: 'contain',
              }}
            >
              <div
                style={{
                  margin: '0 auto 16px',
                  width: 40,
                  height: 4,
                  borderRadius: 999,
                  background: T.border,
                }}
              />
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 16,
                }}
              >
                <h3 style={{ ...TYPE.h3, color: T.text, margin: 0 }}>{t.editTitle}</h3>
                <button
                  type="button"
                  onClick={() => setEditOpen(false)}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: T.bgSubtle,
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                  aria-label={t.close}
                >
                  <X size={18} color={T.textSecondary} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* ── Личные данные ── */}
                <SectionGroup label={t.sectionPersonal}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <FieldBox label={t.fieldFirstName}>
                      <input
                        value={editFirstName}
                        onChange={(e) => setEditFirstName(e.target.value.slice(0, 60))}
                        placeholder={t.fieldFirstName}
                        autoComplete="given-name"
                        style={inputStyle}
                      />
                    </FieldBox>
                    <FieldBox label={t.fieldLastName}>
                      <input
                        value={editLastName}
                        onChange={(e) => setEditLastName(e.target.value.slice(0, 60))}
                        placeholder={t.fieldLastName}
                        autoComplete="family-name"
                        style={inputStyle}
                      />
                    </FieldBox>
                  </div>
                </SectionGroup>

                {/* Email + Телефон редактируются в Налаштування (Контактные
                    данные). В Профілі оставлены только публичные поля. */}

                {/* ── Публичная страница ── */}
                <SectionGroup label={t.sectionPublic}>
                  <FieldBox label={t.fieldSlug}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ color: T.textTertiary }}>@</span>
                      <input
                        value={editSlug}
                        onChange={(e) =>
                          setEditSlug(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 32))
                        }
                        placeholder="username"
                        style={inputStyle}
                      />
                    </div>
                    <p style={{ ...TYPE.micro, marginTop: 6 }}>
                      {t.slugHint}
                    </p>
                  </FieldBox>

                  <FieldBox label={t.fieldBio}>
                    <textarea
                      value={editBio}
                      onChange={(e) => setEditBio(e.target.value.slice(0, 280))}
                      placeholder={t.fieldBio}
                      rows={3}
                      style={{ ...inputStyle, resize: 'none' as const }}
                    />
                    <p style={{ ...TYPE.micro, marginTop: 6, textAlign: 'right' }}>
                      {editBio.length}{t.bioCount}
                    </p>
                  </FieldBox>
                </SectionGroup>

                {editError && (
                  <div
                    style={{
                      padding: '12px 14px',
                      borderRadius: R.md,
                      background: T.dangerSoft,
                      color: T.danger,
                      fontSize: 13,
                    }}
                  >
                    {editError}
                  </div>
                )}

                {/* Кнопка «Сохранить» — всегда внизу sheet body, под полями
                    ввода. Sheet сам сжимается через 90dvh когда клавиатура
                    открыта; пользователь скроллит вниз пальцем, видит
                    кнопку, нажимает. Не плавающая, не fixed — обычный
                    inline-элемент в конце прокручиваемого контента. */}
                <button
                  type="button"
                  onClick={saveEdit}
                  disabled={editBusy}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    width: '100%',
                    padding: '16px 24px',
                    borderRadius: R.pill,
                    border: 'none',
                    background: T.text,
                    color: T.bg,
                    fontSize: 16,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    opacity: editBusy ? 0.6 : 1,
                  }}
                >
                  {editBusy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  {t.save}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Followers/following sheet (kept for compatibility, but trigger removed
          from main UI — followers count itself is now hidden, focus on Избранное) */}
      <AnimatePresence>
        {listOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setListOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 60,
              background: 'rgba(10,10,12,0.5)',
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
            }}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: 460,
                maxHeight: '80dvh',
                background: T.surface,
                borderRadius: `${R.lg}px ${R.lg}px 0 0`,
                paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  margin: '12px auto',
                  width: 40,
                  height: 4,
                  borderRadius: 999,
                  background: T.border,
                }}
              />
              <h3 style={{ ...TYPE.h3, color: T.text, margin: 0, padding: `0 ${PAGE_PADDING_X}px 12px` }}>
                {listType === 'followers' ? t.followers : t.following}
              </h3>
              <div style={{ maxHeight: '60dvh', overflowY: 'auto', padding: `0 ${PAGE_PADDING_X}px 16px` }}>
                {listLoading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
                    <Loader2 size={20} className="animate-spin" color={T.textTertiary} />
                  </div>
                ) : listEntries.length === 0 ? (
                  <p style={{ ...TYPE.caption, textAlign: 'center', padding: '32px 0' }}>
                    {t.empty}
                  </p>
                ) : (
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {listEntries.map((e) => (
                      <li key={e.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setListOpen(false);
                            if (e.public_id) window.location.href = `/telegram/u/${e.public_id}`;
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            width: '100%',
                            padding: '10px 0',
                            background: 'transparent',
                            border: 'none',
                            textAlign: 'left',
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                          }}
                        >
                          <AvatarCircle url={e.avatar_url} name={e.full_name ?? '?'} size={44} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ ...TYPE.bodyStrong, color: T.text, margin: 0 }}>
                              {e.full_name ?? t.user}
                            </p>
                            <p style={{ ...TYPE.micro }}>
                              {e.slug ? `@${e.slug}` : e.public_id ?? ''}
                              {e.role === 'master' && t.masterBadge}
                            </p>
                          </div>
                          <ChevronRight size={18} color={T.textTertiary} />
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
    </MobilePage>
  );
}

function FieldBox({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: T.surfaceElevated,
        border: `1px solid ${T.borderSubtle}`,
        borderRadius: R.md,
        padding: 14,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: T.textTertiary,
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

/** Группа полей с заголовком сверху — визуально разделяет редактор на
 *  «Личное / Контакты / Публичка». */
function SectionGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div
        style={{
          ...TYPE.micro,
          color: T.textTertiary,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          paddingLeft: 4,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

/** Общий стиль для всех input/textarea внутри FieldBox. */
const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'transparent',
  border: 'none',
  outline: 'none',
  ...TYPE.body,
  color: T.text,
  padding: 0,
  fontFamily: 'inherit',
};
