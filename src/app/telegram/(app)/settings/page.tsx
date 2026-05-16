/** --- YAML
 * name: MiniAppSettingsPage
 * description: Mini App settings (клиент). Hero с аватаром + Edit profile pill, секции Сповіщення/Зовнішній вигляд/Безпека/Підтримка, danger logout. Тема следует за TG (rule 10 CLAUDE.md). Дизайн перенесён из Open Design client-settings.html.
 * created: 2026-04-14
 * updated: 2026-05-11
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronRight,
  LogOut,
  Globe,
  Shield,
  Bell,
  Loader2,
  KeyRound,
  X,
  Check,
  Send,
  Info,
  Moon,
  Phone,
  Mail,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { useTelegram } from '@/components/miniapp/telegram-provider';
import { showConfirm } from '@/lib/telegram/webapp';
import { mapError } from '@/lib/errors';
import { T, R, TYPE, SHADOW, PAGE_PADDING_X, FONT_BASE, SPRING } from '@/components/miniapp/design';
import { useTrackSheetOpen } from '@/lib/miniapp/use-sheet-open';
import '@/styles/od-client-mini-app.css';
import { useMiniAppLocale } from '@/lib/miniapp/use-locale';
import { useMiniAppTheme } from '@/components/miniapp/theme';

type Lang = 'uk' | 'ru' | 'en';

const I18N: Record<Lang, {
  title: string;
  editProfile: string;
  sectionNotif: string;
  sectionAppearance: string;
  sectionSecurity: string;
  sectionPrivacy: string;
  sectionSupport: string;
  notifAppt: string;
  notifBonus: string;
  notifPromo: string;
  reminders: string; reminderDesc: string;
  language: string;
  darkTheme: string; darkAuto: string;
  haptic: string; hapticHint: string;
  changePassword: string;
  privacy: string; privacyDesc: string;
  writeSupport: string;
  about: string; version: string;
  signOut: string; signOutConfirm: string;
  contactSheet: string; save: string; emailLabel: string; phoneLabel: string;
  changePhone: string; changeEmail: string;
  pwSheet: string; pwNew: string; pwRepeat: string; pwMinLen: string; pwMismatch: string;
  pwNewPlaceholder: string; pwRepeatPlaceholder: string; pwSaved: string;
  emailConfirm: string; close: string;
  notSet: string;
}> = {
  uk: {
    title: 'Налаштування',
    editProfile: 'Редагувати профіль',
    sectionNotif: 'Сповіщення',
    sectionAppearance: 'Зовнішній вигляд',
    sectionSecurity: 'Безпека',
    sectionPrivacy: 'Приватність',
    sectionSupport: 'Підтримка',
    notifAppt: 'Записи та нагадування',
    notifBonus: 'Бонуси та промокоди',
    notifPromo: 'Новини та акції',
    reminders: 'Налаштувати',
    reminderDesc: 'Коли і як часто нагадувати',
    language: 'Мова',
    darkTheme: 'Тема', darkAuto: 'Як у Telegram',
    haptic: 'Вібрація на дотик', hapticHint: 'Легкий відгук при натисканнях',
    changePassword: 'Змінити пароль',
    privacy: 'Приватність', privacyDesc: 'Що бачать майстри та команди',
    writeSupport: 'Написати в підтримку',
    about: 'Про застосунок', version: 'v1.4',
    signOut: 'Вийти з акаунта', signOutConfirm: 'Точно вийти?',
    contactSheet: 'Контактні дані', save: 'Зберегти', emailLabel: 'Email', phoneLabel: 'Телефон',
    changePhone: 'Змінити телефон', changeEmail: 'Змінити пошту',
    pwSheet: 'Змінити пароль', pwNew: 'Новий пароль', pwRepeat: 'Повторіть пароль',
    pwMinLen: 'Пароль має бути не менше 8 символів', pwMismatch: 'Паролі не збігаються',
    pwNewPlaceholder: 'Мінімум 6 символів', pwRepeatPlaceholder: 'Ще раз',
    pwSaved: 'Пароль оновлено',
    emailConfirm: 'Листа з підтвердженням надіслано. Відкрийте його, щоб завершити зміну email.',
    close: 'Закрити', notSet: 'Не вказано',
  },
  ru: {
    title: 'Настройки',
    editProfile: 'Редактировать профиль',
    sectionNotif: 'Уведомления',
    sectionAppearance: 'Внешний вид',
    sectionSecurity: 'Безопасность',
    sectionPrivacy: 'Приватность',
    sectionSupport: 'Поддержка',
    notifAppt: 'Записи и напоминания',
    notifBonus: 'Бонусы и промокоды',
    notifPromo: 'Новости и акции',
    reminders: 'Настроить',
    reminderDesc: 'Когда и как часто напоминать',
    language: 'Язык',
    darkTheme: 'Тема', darkAuto: 'Как в Telegram',
    haptic: 'Вибрация на тапах', hapticHint: 'Лёгкая отдача при нажатиях',
    changePassword: 'Сменить пароль',
    privacy: 'Приватность', privacyDesc: 'Что видят мастера и команды',
    writeSupport: 'Написать в поддержку',
    about: 'О приложении', version: 'v1.4',
    signOut: 'Выйти из аккаунта', signOutConfirm: 'Точно выйти?',
    contactSheet: 'Контактные данные', save: 'Сохранить', emailLabel: 'Email', phoneLabel: 'Телефон',
    changePhone: 'Сменить телефон', changeEmail: 'Сменить почту',
    pwSheet: 'Сменить пароль', pwNew: 'Новый пароль', pwRepeat: 'Повторите пароль',
    pwMinLen: 'Пароль должен быть не короче 8 символов', pwMismatch: 'Пароли не совпадают',
    pwNewPlaceholder: 'Минимум 6 символов', pwRepeatPlaceholder: 'Ещё раз',
    pwSaved: 'Пароль обновлён',
    emailConfirm: 'Письмо с подтверждением отправлено. Откройте его, чтобы завершить смену email.',
    close: 'Закрыть', notSet: 'Не указан',
  },
  en: {
    title: 'Settings',
    editProfile: 'Edit profile',
    sectionNotif: 'Notifications',
    sectionAppearance: 'Appearance',
    sectionSecurity: 'Security',
    sectionPrivacy: 'Privacy',
    sectionSupport: 'Support',
    notifAppt: 'Bookings & reminders',
    notifBonus: 'Bonuses & promo codes',
    notifPromo: 'News & offers',
    reminders: 'Configure',
    reminderDesc: 'When and how often to remind',
    language: 'Language',
    darkTheme: 'Theme', darkAuto: 'Follow Telegram',
    haptic: 'Tap vibration', hapticHint: 'Light haptic response on taps',
    changePassword: 'Change password',
    privacy: 'Privacy', privacyDesc: 'What masters and teams see',
    writeSupport: 'Contact support',
    about: 'About', version: 'v1.4',
    signOut: 'Sign out', signOutConfirm: 'Log out?',
    contactSheet: 'Contact info', save: 'Save', emailLabel: 'Email', phoneLabel: 'Phone',
    changePhone: 'Change phone', changeEmail: 'Change email',
    pwSheet: 'Change password', pwNew: 'New password', pwRepeat: 'Repeat password',
    pwMinLen: 'Password must be at least 8 characters', pwMismatch: 'Passwords do not match',
    pwNewPlaceholder: 'Minimum 6 characters', pwRepeatPlaceholder: 'Once more',
    pwSaved: 'Password updated',
    emailConfirm: 'A confirmation email has been sent. Open it to finish changing your email.',
    close: 'Close', notSet: 'Not set',
  },
};

const LANG_LABEL: Record<Lang, string> = {
  uk: 'Українська',
  ru: 'Русский',
  en: 'English',
};

const SUPPORT_BOT_URL = 'https://t.me/cres_ca_bot?start=support';

export default function MiniAppSettingsPage() {
  const router = useRouter();
  const { haptic } = useTelegram();
  const { userId } = useAuthStore();
  const { theme: resolvedTheme, override: themeOverride, setOverride } = useMiniAppTheme();
  const lang = useMiniAppLocale();
  const t = I18N[lang];
  const [signingOut, setSigningOut] = useState(false);

  // Contact info
  const [email, setEmail] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);

  // Edit contact modal — `contactFocus` подсказывает какое поле автофокусить
  // (когда пришли из ряда «Сменить телефон» или «Сменить почту»).
  const [contactOpen, setContactOpen] = useState(false);
  // Прячем bottom-nav пока открыта любая шторка (контакты или пароль).
  // Объявление после pwOpen ниже — но useTrackSheetOpen прочитает обе.
  // (Объединяем в один вызов после деклараций.)
  const [contactFocus, setContactFocus] = useState<'phone' | 'email'>('phone');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [contactBusy, setContactBusy] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);
  const [emailConfirmSent, setEmailConfirmSent] = useState(false);

  // Password change modal
  const [pwOpen, setPwOpen] = useState(false);
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);

  useTrackSheetOpen(contactOpen || pwOpen);

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
          setEmail(data.email ?? null);
          setPhone(data.phone ?? null);
        }
      }
    })();
  }, [userId]);

  function openContactEdit(focus: 'phone' | 'email' = 'phone') {
    setEditPhone(phone ? phone.replace(/^\+380/, '') : '');
    setEditEmail(email ?? '');
    setContactError(null);
    setEmailConfirmSent(false);
    setContactFocus(focus);
    setContactOpen(true);
    haptic('light');
  }

  async function saveContact() {
    if (contactBusy) return;
    setContactBusy(true);
    setContactError(null);
    try {
      const emailChanged = editEmail.trim().toLowerCase() !== (email ?? '').toLowerCase();
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: editPhone.trim(),
          email: editEmail.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setContactError(mapError(data.error, 'Не удалось сохранить'));
        haptic('error');
        return;
      }
      setPhone(editPhone.trim() ? `+380${editPhone.replace(/\D/g, '').replace(/^380/, '')}` : null);
      if (!emailChanged) setEmail(editEmail.trim() || null);
      haptic('success');
      if (emailChanged && editEmail.trim()) {
        setEmailConfirmSent(true);
      } else {
        setContactOpen(false);
      }
    } catch (e) {
      setContactError(mapError(e instanceof Error ? e.message : 'network_error'));
    } finally {
      setContactBusy(false);
    }
  }

  async function savePassword() {
    if (pwBusy) return;
    setPwError(null);
    if (pwNew.length < 8) {
      setPwError(t.pwMinLen);
      return;
    }
    if (pwNew !== pwConfirm) {
      setPwError(t.pwMismatch);
      return;
    }
    setPwBusy(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pwNew }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPwError(mapError(data.error, 'Не удалось сменить пароль'));
        haptic('error');
        return;
      }
      haptic('success');
      setPwSuccess(true);
      setPwNew('');
      setPwConfirm('');
      setTimeout(() => {
        setPwOpen(false);
        setPwSuccess(false);
      }, 1400);
    } finally {
      setPwBusy(false);
    }
  }

  async function signOut() {
    if (signingOut) return;
    const ok = await showConfirm(t.signOutConfirm);
    if (!ok) return;
    haptic('medium');
    setSigningOut(true);
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
    try { createClient().auth.signOut(); } catch {}
    try { sessionStorage.removeItem('cres:tg'); } catch {}
    window.location.replace('/telegram');
  }

  return (
    <>
      <motion.div
        className="od-client-mini-app"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28 }}
        style={{
          ...FONT_BASE,
          display: 'flex',
          flexDirection: 'column',
          padding: `12px ${PAGE_PADDING_X}px 16px`,
        }}
      >
        {/* Header — title only (back handled by TG/layout) */}
        <h1 style={{ ...TYPE.h2, color: T.text, margin: '8px 4px 16px' }}>{t.title}</h1>


        {/* Единый блок: контакты/пароль/уведомления/приватность/поддержка/о приложении.
            Без подзаголовков — просто строки в одной карточке с разделителями. */}
        <div className="card-block">
          <Row
            icon={<Phone size={16} color="var(--fg-2)" />}
            label={t.changePhone}
            sub={phone ?? t.notSet}
            onClick={() => openContactEdit('phone')}
            trail={<div className="setting-arrow"><ChevronRight size={16} /></div>}
          />
          <Row
            icon={<Mail size={16} color="var(--fg-2)" />}
            label={t.changeEmail}
            sub={email ?? t.notSet}
            onClick={() => openContactEdit('email')}
            trail={<div className="setting-arrow"><ChevronRight size={16} /></div>}
          />
          <Row
            icon={<KeyRound size={16} color="var(--fg-2)" />}
            label={t.changePassword}
            onClick={() => {
              setPwNew(''); setPwConfirm(''); setPwError(null); setPwSuccess(false);
              setPwOpen(true); haptic('light');
            }}
            trail={<div className="setting-arrow"><ChevronRight size={16} /></div>}
          />
          <Row
            icon={<Bell size={16} color="var(--fg-2)" />}
            label={t.sectionNotif}
            onClick={() => { haptic('light'); router.push('/telegram/settings/notifications'); }}
            trail={<div className="setting-arrow"><ChevronRight size={16} /></div>}
          />
          <Row
            icon={<Shield size={16} color="var(--fg-2)" />}
            label={t.privacy}
            onClick={() => { haptic('light'); router.push('/telegram/settings/privacy'); }}
            trail={<div className="setting-arrow"><ChevronRight size={16} /></div>}
          />
          <Link
            href={SUPPORT_BOT_URL}
            target="_blank"
            rel="noreferrer"
            onClick={() => haptic('light')}
            style={{ display: 'block', textDecoration: 'none' }}
          >
            <div className="setting-row">
              <div style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--accent-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Send size={16} color="var(--accent)" strokeWidth={2} />
              </div>
              <span className="setting-label">{t.writeSupport}</span>
              <div className="setting-arrow"><ChevronRight size={16} /></div>
            </div>
          </Link>
          <div className="setting-row" style={{ cursor: 'default' }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Info size={16} color="var(--fg-3)" strokeWidth={2} />
            </div>
            <span className="setting-label">{t.about}</span>
            <span className="setting-value">{t.version}</span>
          </div>
        </div>

        {/* SECTION: Внешний вид — единственный отдельный раздел */}
        <div className="section-label" style={{ marginTop: 20 }}>{t.sectionAppearance}</div>
        <div className="card-block">
          <Row
            icon={<Globe size={16} color="var(--fg-2)" />}
            label={t.language}
            onClick={() => { haptic('light'); router.push('/telegram/settings/language'); }}
            trail={
              <>
                <span className="setting-value">{LANG_LABEL[lang]}</span>
                <div className="setting-arrow"><ChevronRight size={16} /></div>
              </>
            }
          />
          <Row
            icon={<Moon size={16} color="var(--fg-2)" />}
            label={t.darkTheme}
            sub={themeOverride === null
              ? t.darkAuto
              : resolvedTheme === 'dark'
                ? (lang === 'uk' ? 'Темна' : lang === 'en' ? 'Dark' : 'Тёмная')
                : (lang === 'uk' ? 'Світла' : lang === 'en' ? 'Light' : 'Светлая')}
            onClick={() => {
              const next = resolvedTheme === 'dark' ? 'light' : 'dark';
              setOverride(next);
              haptic('selection');
            }}
            trail={<Switch on={resolvedTheme === 'dark'} />}
          />
        </div>

        {/* Logout */}
        <motion.button
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.20, duration: 0.32 }}
          type="button"
          onClick={signOut}
          disabled={signingOut}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            width: '100%',
            padding: 14,
            marginTop: 24,
            borderRadius: 13,
            border: `1.5px solid ${T.dangerSoft}`,
            background: T.dangerSoft,
            color: T.danger,
            fontSize: 14,
            fontWeight: 600,
            cursor: signingOut ? 'wait' : 'pointer',
            fontFamily: 'inherit',
            opacity: signingOut ? 0.6 : 1,
          }}
        >
          {signingOut ? <Loader2 size={17} className="animate-spin" /> : <LogOut size={17} strokeWidth={2.2} />}
          {t.signOut}
        </motion.button>
      </motion.div>

      {/* Contact edit bottom sheet */}
      <AnimatePresence>
        {contactOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 50,
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              background: 'rgba(0,0,0,0.5)',
              backdropFilter: 'blur(4px)',
            }}
            onClick={() => !contactBusy && setContactOpen(false)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={SPRING.default}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: 480,
                borderRadius: `${R.lg}px ${R.lg}px 0 0`,
                background: T.surface,
                padding: `20px ${PAGE_PADDING_X}px`,
                paddingBottom: 'calc(96px + env(safe-area-inset-bottom, 0px))',
              }}
            >
              <SheetHeader title={t.contactSheet} onClose={() => !contactBusy && setContactOpen(false)} closeLabel={t.close} />

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <FieldBox label="Email">
                  <input
                    type="email"
                    autoFocus={contactFocus === 'email'}
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value.slice(0, 120))}
                    placeholder="you@example.com"
                    style={inputStyle}
                  />
                  {emailConfirmSent && (
                    <p style={{ ...TYPE.micro, color: T.success, marginTop: 8 }}>{t.emailConfirm}</p>
                  )}
                </FieldBox>

                <FieldBox label={t.phoneLabel}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, ...TYPE.body }}>
                    <span style={{ color: T.textTertiary }}>+380</span>
                    <input
                      type="tel"
                      inputMode="numeric"
                      autoFocus={contactFocus === 'phone'}
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value.replace(/\D/g, '').slice(0, 9))}
                      placeholder="501234567"
                      style={{ ...inputStyle, marginTop: 0 }}
                    />
                  </div>
                </FieldBox>

                {contactError && <ErrorBox message={contactError} />}

                <button
                  type="button"
                  onClick={saveContact}
                  disabled={contactBusy}
                  style={primaryBtnStyle(contactBusy)}
                >
                  {contactBusy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  {t.save}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Password change bottom sheet */}
      <AnimatePresence>
        {pwOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 50,
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              background: 'rgba(0,0,0,0.5)',
              backdropFilter: 'blur(4px)',
            }}
            onClick={() => !pwBusy && setPwOpen(false)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={SPRING.default}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: 480,
                borderRadius: `${R.lg}px ${R.lg}px 0 0`,
                background: T.surface,
                padding: `20px ${PAGE_PADDING_X}px`,
                paddingBottom: 'calc(96px + env(safe-area-inset-bottom, 0px))',
              }}
            >
              <SheetHeader title={t.pwSheet} onClose={() => !pwBusy && setPwOpen(false)} closeLabel={t.close} />

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <FieldBox label={t.pwNew}>
                  <input
                    type="password"
                    value={pwNew}
                    onChange={(e) => setPwNew(e.target.value.slice(0, 72))}
                    placeholder={t.pwNewPlaceholder}
                    autoComplete="new-password"
                    style={inputStyle}
                  />
                </FieldBox>

                <FieldBox label={t.pwRepeat}>
                  <input
                    type="password"
                    value={pwConfirm}
                    onChange={(e) => setPwConfirm(e.target.value.slice(0, 72))}
                    placeholder={t.pwRepeatPlaceholder}
                    autoComplete="new-password"
                    style={inputStyle}
                  />
                </FieldBox>

                {pwError && <ErrorBox message={pwError} />}
                {pwSuccess && (
                  <div style={{
                    position: 'relative',
                    borderRadius: R.sm,
                    border: `1px solid ${T.successSoft}`,
                    background: T.successSoft,
                    padding: '12px 12px 12px 16px',
                    ...TYPE.caption,
                    color: T.success,
                    overflow: 'hidden',
                  }}>
                    <span style={{ position: 'absolute', left: 0, top: 8, bottom: 8, width: 4, borderRadius: '0 4px 4px 0', background: T.success }} />
                    {t.pwSaved}
                  </div>
                )}

                <button
                  type="button"
                  onClick={savePassword}
                  disabled={pwBusy || pwSuccess}
                  style={primaryBtnStyle(pwBusy || pwSuccess)}
                >
                  {pwBusy ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
                  {t.save}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────

function Row({
  icon,
  label,
  sub,
  trail,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  sub?: string;
  trail?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className="setting-row"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={{ opacity: disabled ? 0.6 : 1, cursor: disabled ? 'default' : 'pointer' }}
    >
      <div style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span className="setting-label">{label}</span>
        {sub && <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 2 }}>{sub}</div>}
      </div>
      {trail}
    </button>
  );
}


function Switch({ on }: { on: boolean }) {
  return (
    <div
      style={{
        width: 44,
        height: 26,
        borderRadius: 13,
        background: on ? T.accent : T.borderSubtle,
        position: 'relative',
        transition: 'background 0.2s',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 3,
          left: on ? 21 : 3,
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
          transition: 'left 0.2s',
        }}
      />
    </div>
  );
}

function SheetHeader({ title, onClose, closeLabel }: { title: string; onClose: () => void; closeLabel: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
      <h3 style={{ ...TYPE.h3, color: T.text, margin: 0 }}>{title}</h3>
      <button
        type="button"
        onClick={onClose}
        style={{
          width: 36, height: 36, borderRadius: '50%',
          border: `1px solid ${T.border}`, background: T.surface,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
        }}
        aria-label={closeLabel}
      >
        <X size={16} color={T.text} />
      </button>
    </div>
  );
}

function FieldBox({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ borderRadius: R.md, border: `1px solid ${T.borderSubtle}`, background: T.bg, padding: 16 }}>
      <label style={{ ...TYPE.micro, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em' }}>{label}</label>
      {children}
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div style={{
      position: 'relative',
      borderRadius: R.sm,
      border: `1px solid ${T.dangerSoft}`,
      background: T.dangerSoft,
      padding: '12px 12px 12px 16px',
      ...TYPE.caption,
      color: T.danger,
      overflow: 'hidden',
    }}>
      <span style={{ position: 'absolute', left: 0, top: 8, bottom: 8, width: 4, borderRadius: '0 4px 4px 0', background: T.danger }} />
      {message}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  marginTop: 4,
  background: 'transparent',
  border: 'none',
  outline: 'none',
  ...TYPE.body,
  color: T.text,
  fontFamily: 'inherit',
};

function primaryBtnStyle(busy: boolean): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    padding: 16,
    borderRadius: R.md,
    border: 'none',
    background: T.accent,
    color: T.accentText,
    fontSize: 15,
    fontWeight: 700,
    cursor: busy ? 'wait' : 'pointer',
    fontFamily: 'inherit',
    opacity: busy ? 0.6 : 1,
  };
}

// Suppress unused-warning suppress
void SHADOW;
