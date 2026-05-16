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
  Users,
  MessageCircle,
  Pencil,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { useTelegram } from '@/components/miniapp/telegram-provider';
import { MiniAppAvatarCropSheet } from '@/components/miniapp/avatar-crop-sheet';
import { mapError } from '@/lib/errors';
import { getInitData, showConfirm } from '@/lib/telegram/webapp';
import {
  MobilePage,
  AvatarCircle,
} from '@/components/miniapp/shells';
import { T, R, TYPE, PAGE_PADDING_X, SHADOW } from '@/components/miniapp/design';
import '@/styles/od-client-mini-app.css';
import { useMiniAppLocale } from '@/lib/miniapp/use-locale';

type Lang = 'uk' | 'ru' | 'en';

const I18N: Record<Lang, {
  labelName: string; labelPhone: string; labelEmail: string; notSet: string;
  myMasters: string; menuSettings: string; menuSupport: string;
  logout: string; loggingOut: string; logoutConfirm: string;
  editTitle: string; save: string;
  fieldFirstName: string; fieldLastName: string; fieldEmail: string; fieldPhone: string;
  fieldDob: string; fieldSlug: string; fieldBio: string;
  slugHint: string; bioCount: string;
  emailReadonlyHint: string;
  sectionPersonal: string; sectionContact: string; sectionPublic: string;
  followers: string; following: string;
  masterBadge: string; empty: string; user: string;
  close: string; avatarLabel: string;
  saveError: string; avatarTitle: string; guest: string;
}> = {
  uk: {
    labelName: 'Імʼя', labelPhone: 'Телефон', labelEmail: 'Email', notSet: 'Не вказано',
    myMasters: 'Мої майстри', menuSettings: 'Налаштування', menuSupport: 'Підтримка',
    logout: 'Вийти', loggingOut: 'Виходимо...', logoutConfirm: 'Точно вийти?',
    editTitle: 'Редагувати профіль', save: 'Зберегти',
    fieldFirstName: 'Ім\'я', fieldLastName: 'Прізвище',
    fieldEmail: 'Email', fieldPhone: 'Телефон',
    fieldDob: 'Дата народження', fieldSlug: 'Ім\'я посилання (slug)', fieldBio: 'Про себе',
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
    labelName: 'Имя', labelPhone: 'Телефон', labelEmail: 'Email', notSet: 'Не указано',
    myMasters: 'Мои мастера', menuSettings: 'Настройки', menuSupport: 'Поддержка',
    logout: 'Выйти', loggingOut: 'Выходим...', logoutConfirm: 'Точно выйти?',
    editTitle: 'Редактировать профиль', save: 'Сохранить',
    fieldFirstName: 'Имя', fieldLastName: 'Фамилия',
    fieldEmail: 'Email', fieldPhone: 'Телефон',
    fieldDob: 'Дата рождения', fieldSlug: 'Имя ссылки (slug)', fieldBio: 'О себе',
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
    labelName: 'Name', labelPhone: 'Phone', labelEmail: 'Email', notSet: 'Not set',
    myMasters: 'My masters', menuSettings: 'Settings', menuSupport: 'Support',
    logout: 'Sign out', loggingOut: 'Signing out...', logoutConfirm: 'Log out?',
    editTitle: 'Edit profile', save: 'Save',
    fieldFirstName: 'First name', fieldLastName: 'Last name',
    fieldEmail: 'Email', fieldPhone: 'Phone',
    fieldDob: 'Date of birth', fieldSlug: 'Link name (slug)', fieldBio: 'About',
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
  const [dob, setDob] = useState<string | null>(null);

  // Edit profile modal state — first/last разделены, чтобы клиент мог
  // править имя и фамилию по отдельности (потом склеиваем в full_name).
  const [editOpen, setEditOpen] = useState(false);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editSlug, setEditSlug] = useState('');
  const [editDob, setEditDob] = useState('');
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
          setDob(data.date_of_birth ?? null);
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
    setEditDob(dob ?? '');
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
          dob: editDob.trim() || null,
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
      setDob(editDob.trim() || null);
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
    const ok = await showConfirm(t.logoutConfirm);
    if (!ok) return;
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

  const userInitials = (displayName || '').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <MobilePage className="od-client-mini-app">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Hero — gradient cobalt-soft → surface, аватар по центру + name + phone + stats row.
            QR-кнопка справа вверху открывает QR-код профиля (TODO в будущей задаче). */}
        <div
          style={{
            background: 'linear-gradient(150deg,var(--accent-2),var(--surface))',
            padding: '28px 20px 20px',
            textAlign: 'center',
            position: 'relative',
          }}
        >
          <div style={{ position: 'absolute', top: 14, right: 14 }}>
            <button
              type="button"
              className="btn-icon"
              onClick={openEdit}
              aria-label="Edit"
            >
              <Pencil size={14} />
            </button>
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={avatarBusy}
            style={{
              position: 'relative',
              width: 72,
              height: 72,
              borderRadius: '50%',
              background: 'transparent',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              margin: '0 auto 12px',
              display: 'block',
              WebkitTapHighlightColor: 'transparent',
            }}
            aria-label={t.avatarLabel}
          >
            {avatarUrl
              ? (
                <div className="avatar av-xl">
                  <img src={avatarUrl} alt="" />
                </div>
              )
              : (
                <div className="avatar av-xl">{userInitials || '👤'}</div>
              )
            }
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
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--fg)', letterSpacing: '-0.01em' }}>
            {displayName || t.guest}
          </div>
          {phone && (
            <div style={{ fontSize: 14, color: 'var(--fg-2)', marginTop: 4 }}>
              {phone}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 16 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent)' }}>0</div>
              <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>{lang === 'en' ? 'visits' : lang === 'uk' ? 'відвідувань' : 'посещений'}</div>
            </div>
            <div style={{ width: 1, background: 'var(--border)' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent)' }}>{followingCount}</div>
              <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>{lang === 'en' ? 'masters' : lang === 'uk' ? 'майстри' : 'мастера'}</div>
            </div>
            <div style={{ width: 1, background: 'var(--border)' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent)' }}>₴0</div>
              <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>{lang === 'en' ? 'spent' : lang === 'uk' ? 'витрачено' : 'потрачено'}</div>
            </div>
          </div>
          {/* Личные данные — три row под hero (Имя/Телефон/Email тап = edit) */}
        </div>

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


        {/* Меню — pmenu-item стиль эталона: иконка квадратная цветная + label + arrow */}
        <div className="card-block">
          <button
            type="button"
            className="pmenu-item"
            onClick={() => { haptic('selection'); router.push('/telegram/connections'); }}
          >
            <div className="pmenu-icon" style={{ background: 'var(--accent-2)', color: 'var(--accent)' }}>
              <Users size={20} strokeWidth={1.8} />
            </div>
            <span className="pmenu-label">{t.myMasters}</span>
            {followingCount > 0 && (
              <span style={{ fontSize: 13, color: 'var(--fg-3)', marginRight: 6 }}>
                {followingCount}
              </span>
            )}
            <span className="pmenu-arrow"><ChevronRight size={16} /></span>
          </button>
          <button
            type="button"
            className="pmenu-item"
            onClick={() => { haptic('selection'); router.push('/telegram/settings'); }}
          >
            <div className="pmenu-icon" style={{ background: 'var(--accent-2)', color: 'var(--accent)' }}>
              <Settings size={20} strokeWidth={1.8} />
            </div>
            <span className="pmenu-label">{t.menuSettings}</span>
            <span className="pmenu-arrow"><ChevronRight size={16} /></span>
          </button>
          <button
            type="button"
            className="pmenu-item"
            onClick={() => { haptic('selection'); window.open('https://t.me/crescacom_bot?start=support', '_blank'); }}
          >
            <div className="pmenu-icon" style={{ background: 'var(--accent-2)', color: 'var(--accent)' }}>
              <MessageCircle size={20} strokeWidth={1.8} />
            </div>
            <span className="pmenu-label">{t.menuSupport}</span>
            <span className="pmenu-arrow"><ChevronRight size={16} /></span>
          </button>
          <button
            type="button"
            className="pmenu-item"
            onClick={signOut}
            disabled={signingOut}
          >
            <div className="pmenu-icon" style={{ background: 'rgba(239,68,68,0.10)', color: '#ef4444' }}>
              <LogOut size={20} strokeWidth={1.8} />
            </div>
            <span className="pmenu-label" style={{ color: '#ef4444' }}>
              {signingOut ? t.loggingOut : t.logout}
            </span>
          </button>
        </div>


        <div style={{ height: 12 }} />
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
                boxShadow: SHADOW.elevated,
                maxHeight: 'calc(100dvh - max(var(--tg-content-top, 0px), 12px))',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              {/* Шапка — ВИЩЕ СКРОЛУ, завжди видима */}
              <div style={{ flexShrink: 0, padding: `20px ${PAGE_PADDING_X}px 0` }}>
                <div style={{ margin: '0 auto 14px', width: 40, height: 4, borderRadius: 999, background: T.border }} />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 14 }}>
                  <h3 style={{ ...TYPE.h3, color: T.text, margin: 0 }}>{t.editTitle}</h3>
                  <button
                    type="button"
                    onClick={() => setEditOpen(false)}
                    style={{
                      width: 36, height: 36, borderRadius: '50%',
                      background: T.bgSubtle, border: 'none',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                    }}
                    aria-label={t.close}
                  >
                    <X size={18} color={T.textSecondary} />
                  </button>
                </div>
              </div>

              {/* Прокручуваний вміст */}
              <div
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  overscrollBehavior: 'contain',
                  padding: `0 ${PAGE_PADDING_X}px`,
                  paddingBottom: 'calc(32px + env(safe-area-inset-bottom, 0px))',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingTop: 4, paddingBottom: 16 }}>
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
                    <FieldBox label={t.fieldDob}>
                      <input
                        type="date"
                        value={editDob}
                        onChange={(e) => setEditDob(e.target.value)}
                        style={inputStyle}
                      />
                    </FieldBox>
                    <FieldBox label={t.fieldPhone}>
                      <input
                        type="tel"
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value.slice(0, 20))}
                        placeholder="+380..."
                        autoComplete="tel"
                        style={inputStyle}
                      />
                    </FieldBox>
                  </SectionGroup>

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
                      <p style={{ ...TYPE.micro, marginTop: 6 }}>{t.slugHint}</p>
                    </FieldBox>
                    <FieldBox label={t.fieldBio}>
                      <textarea
                        value={editBio}
                        onChange={(e) => setEditBio(e.target.value.slice(0, 280))}
                        placeholder={t.fieldBio}
                        rows={3}
                        style={{ ...inputStyle, resize: 'none' as const }}
                      />
                      <p style={{ ...TYPE.micro, marginTop: 6, textAlign: 'right' }}>{editBio.length}{t.bioCount}</p>
                    </FieldBox>
                  </SectionGroup>

                  {editError && (
                    <div style={{ padding: '12px 14px', borderRadius: R.md, background: T.dangerSoft, color: T.danger, fontSize: 13 }}>
                      {editError}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={saveEdit}
                    disabled={editBusy}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      width: '100%', padding: '16px 24px', borderRadius: R.pill, border: 'none',
                      background: T.accent, color: '#fff', fontSize: 16, fontWeight: 600,
                      cursor: 'pointer', fontFamily: 'inherit', opacity: editBusy ? 0.6 : 1,
                    }}
                  >
                    {editBusy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                    {t.save}
                  </button>
                </div>
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
                paddingBottom: 'calc(96px + env(safe-area-inset-bottom, 0px))',
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
        padding: '10px 14px 12px',
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 500,
          color: T.textTertiary,
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

/** Группа полей с заголовком сверху — визуально разделяет редактор. */
function SectionGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: T.textSecondary,
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
  fontSize: 15,
  lineHeight: '1.4',
  color: T.text,
  padding: 0,
  fontFamily: 'inherit',
};
