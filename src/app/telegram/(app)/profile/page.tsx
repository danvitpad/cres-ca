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
import { ImageCropDialog } from '@/components/ui/image-crop-dialog';
import { mapError } from '@/lib/errors';
import {
  MobilePage,
  PageHeader,
  GradientHeroCard,
  MenuList,
  AvatarCircle,
  type MenuItem,
} from '@/components/miniapp/shells';
import { T, R, TYPE, PAGE_PADDING_X, SHADOW } from '@/components/miniapp/design';

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
          setFollowingCount(Number(data.following_count ?? 0));
        }
      }
      setProfileLoaded(true);
    })();
  }, [userId]);

  function openEdit() {
    setEditName(fullName || tgFullName || '');
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

  function onAvatarFile(file: File) {
    if (!file.type.startsWith('image/')) return;
    if (file.size > 8 * 1024 * 1024) { haptic('error'); return; }
    setCropSrc(URL.createObjectURL(file));
  }

  async function onAvatarCropped(blob: Blob) {
    if (!userId || avatarBusy) return;
    setAvatarBusy(true);
    try {
      const supabase = createClient();
      const path = `${userId}/${Date.now()}.webp`;
      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(path, blob, { contentType: blob.type, cacheControl: '3600', upsert: true });
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

  // Auto-open edit modal when navigated from settings with ?edit=true
  useEffect(() => {
    if (profileLoaded && searchParams.get('edit') === 'true') {
      openEdit();
      router.replace('/telegram/profile', { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileLoaded]);

  const balanceFmt = balance.toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const mainMenu: MenuItem[] = [
    {
      key: 'profile',
      icon: <UserIcon size={22} strokeWidth={1.8} />,
      label: 'Профиль',
      onClick: openEdit,
      rightSlot: <ChevronRight size={20} color={T.textTertiary} />,
    },
    {
      key: 'contacts',
      icon: <Users size={22} strokeWidth={1.8} />,
      label: 'Контакты',
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
      label: 'Настройки',
      href: '/telegram/settings',
      rightSlot: <ChevronRight size={20} color={T.textTertiary} />,
    },
  ];

  const supportMenu: MenuItem[] = [
    {
      key: 'support',
      icon: <MessageCircle size={22} strokeWidth={1.8} />,
      label: 'Поддержка',
      onClick: () => window.open('https://t.me/cres_ca_bot?start=support', '_blank'),
      rightSlot: <ChevronRight size={20} color={T.textTertiary} />,
    },
  ];

  const logoutMenu: MenuItem[] = [
    {
      key: 'logout',
      icon: <LogOut size={22} strokeWidth={1.8} />,
      label: signingOut ? 'Выходим...' : 'Выйти',
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
          subtitle="Личный профиль"
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
              aria-label="Изменить аватар"
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
        <ImageCropDialog
          open={!!cropSrc}
          src={cropSrc}
          onClose={() => { if (cropSrc) URL.revokeObjectURL(cropSrc); setCropSrc(null); }}
          onCropped={onAvatarCropped}
          title="Аватар"
          aspect={1}
          shape="round"
          outputSize={512}
        />

        <GradientHeroCard
          label="Баланс кошелька"
          value={`${balanceFmt} ₴`}
          cta="Открыть кошелёк"
          onCta={() => router.push('/telegram/bonuses')}
        />

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
                <h3 style={{ ...TYPE.h3, color: T.text, margin: 0 }}>Редактировать профиль</h3>
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
                  aria-label="Закрыть"
                >
                  <X size={18} color={T.textSecondary} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <FieldBox label="Имя">
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value.slice(0, 80))}
                    placeholder="Как вас зовут"
                    style={{
                      width: '100%',
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      ...TYPE.body,
                      color: T.text,
                      padding: 0,
                    }}
                  />
                </FieldBox>

                <FieldBox label="Имя ссылки (slug)">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ color: T.textTertiary }}>@</span>
                    <input
                      value={editSlug}
                      onChange={(e) =>
                        setEditSlug(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 32))
                      }
                      placeholder="username"
                      style={{
                        width: '100%',
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                        ...TYPE.body,
                        color: T.text,
                        padding: 0,
                        fontFamily: 'inherit',
                      }}
                    />
                  </div>
                  <p style={{ ...TYPE.micro, marginTop: 6 }}>
                    3–32 символа: латиница, цифры, точка, дефис, подчёркивание
                  </p>
                </FieldBox>

                <FieldBox label="О себе">
                  <textarea
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value.slice(0, 280))}
                    placeholder="Пара слов о вас"
                    rows={4}
                    style={{
                      width: '100%',
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      resize: 'none',
                      ...TYPE.body,
                      color: T.text,
                      padding: 0,
                      fontFamily: 'inherit',
                    }}
                  />
                  <p style={{ ...TYPE.micro, marginTop: 6, textAlign: 'right' }}>
                    {editBio.length}/280
                  </p>
                </FieldBox>

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
                  Сохранить
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
                {listType === 'followers' ? 'Подписчики' : 'Избранное'}
              </h3>
              <div style={{ maxHeight: '60dvh', overflowY: 'auto', padding: `0 ${PAGE_PADDING_X}px 16px` }}>
                {listLoading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
                    <Loader2 size={20} className="animate-spin" color={T.textTertiary} />
                  </div>
                ) : listEntries.length === 0 ? (
                  <p style={{ ...TYPE.caption, textAlign: 'center', padding: '32px 0' }}>
                    Пусто
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
                              {e.full_name ?? 'Пользователь'}
                            </p>
                            <p style={{ ...TYPE.micro }}>
                              {e.slug ? `@${e.slug}` : e.public_id ?? ''}
                              {e.role === 'master' && ' · Мастер'}
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
