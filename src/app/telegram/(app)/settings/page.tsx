/** --- YAML
 * name: MiniAppSettingsPage
 * description: Mini App settings — email, phone, password, language, privacy, help, sign out.
 *   Premium design using miniapp design tokens. Matches Fresha-style.
 * created: 2026-04-14
 * updated: 2026-04-29
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  LogOut,
  Globe,
  Shield,
  Heart,
  Bell,
  Moon,
  Loader2,
  Mail,
  Phone as PhoneIcon,
  KeyRound,
  X,
  Check,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { useTelegram } from '@/components/miniapp/telegram-provider';
import { mapError } from '@/lib/errors';
import { T, R, TYPE, SHADOW, PAGE_PADDING_X, FONT_BASE, SPRING } from '@/components/miniapp/design';
import { useMiniAppTheme } from '@/components/miniapp/theme';
import { useMiniAppLocale } from '@/lib/miniapp/use-locale';

type Lang = 'uk' | 'ru' | 'en';

const I18N: Record<Lang, {
  title: string; back: string;
  emailLabel: string; phoneLabel: string; notSet: string;
  changePassword: string; reminders: string; reminderDesc: string;
  darkTheme: string; darkManual: string; darkAuto: string;
  language: string; langOptions: string;
  privacy: string; privacyDesc: string;
  feedback: string; feedbackDesc: string;
  helpTitle: string; helpDesc: string; helpLink: string;
  accountTitle: string; accountDesc: string;
  signOut: string; signingOut: string;
  contactSheet: string; save: string;
  pwSheet: string; pwNew: string; pwRepeat: string; pwMinLen: string; pwMismatch: string;
  pwNewPlaceholder: string; pwRepeatPlaceholder: string; pwSaved: string;
  emailConfirm: string;
  close: string;
}> = {
  uk: {
    title: 'Налаштування', back: 'Назад',
    emailLabel: 'Email', phoneLabel: 'Телефон', notSet: 'Не вказано',
    changePassword: 'Змінити пароль', reminders: 'Нагадування', reminderDesc: 'Коли і як часто нагадувати про візит',
    darkTheme: 'Темна тема', darkManual: 'Вручну', darkAuto: 'Як у Telegram',
    language: 'Мова', langOptions: 'Українська · Русский · English',
    privacy: 'Приватність', privacyDesc: 'Що бачать майстри та команди',
    feedback: 'Зворотній зв\'язок', feedbackDesc: 'Напишіть або запишіть голосом',
    helpTitle: 'Потрібна допомога?', helpDesc: 'Напишіть у', helpLink: 'Telegram-бот',
    accountTitle: 'Дії з обліковим записом', accountDesc: 'Експорт даних та видалення облікового запису доступні у веб-версії:',
    signOut: 'Вийти з акаунту', signingOut: 'Виходимо...',
    contactSheet: 'Контактні дані', save: 'Зберегти',
    pwSheet: 'Змінити пароль', pwNew: 'Новий пароль', pwRepeat: 'Повторіть пароль',
    pwMinLen: 'Пароль має бути не менше 8 символів', pwMismatch: 'Паролі не збігаються',
    pwNewPlaceholder: 'Мінімум 6 символів', pwRepeatPlaceholder: 'Ще раз',
    pwSaved: 'Пароль оновлено',
    emailConfirm: 'Листа з підтвердженням надіслано. Відкрийте його, щоб завершити зміну email.',
    close: 'Закрити',
  },
  ru: {
    title: 'Настройки', back: 'Назад',
    emailLabel: 'Email', phoneLabel: 'Телефон', notSet: 'Не указан',
    changePassword: 'Сменить пароль', reminders: 'Напоминания', reminderDesc: 'Когда и как часто напоминать о визите',
    darkTheme: 'Тёмная тема', darkManual: 'Вручную', darkAuto: 'Как в Telegram',
    language: 'Язык', langOptions: 'Українська · Русский · English',
    privacy: 'Приватность', privacyDesc: 'Что видят мастера и команды',
    feedback: 'Обратная связь', feedbackDesc: 'Напишите или запишите голосом',
    helpTitle: 'Нужна помощь?', helpDesc: 'Напишите в', helpLink: 'Telegram-бот',
    accountTitle: 'Действия с учётной записью', accountDesc: 'Экспорт данных и удаление учётной записи доступны в веб-версии:',
    signOut: 'Выйти из аккаунта', signingOut: 'Выходим...',
    contactSheet: 'Контактные данные', save: 'Сохранить',
    pwSheet: 'Сменить пароль', pwNew: 'Новый пароль', pwRepeat: 'Повторите пароль',
    pwMinLen: 'Пароль должен быть не короче 8 символов', pwMismatch: 'Пароли не совпадают',
    pwNewPlaceholder: 'Минимум 6 символов', pwRepeatPlaceholder: 'Ещё раз',
    pwSaved: 'Пароль обновлён',
    emailConfirm: 'Письмо с подтверждением отправлено. Откройте его, чтобы завершить смену email.',
    close: 'Закрыть',
  },
  en: {
    title: 'Settings', back: 'Back',
    emailLabel: 'Email', phoneLabel: 'Phone', notSet: 'Not set',
    changePassword: 'Change password', reminders: 'Reminders', reminderDesc: 'When and how often to remind about appointments',
    darkTheme: 'Dark theme', darkManual: 'Manual', darkAuto: 'Follow Telegram',
    language: 'Language', langOptions: 'Українська · Русский · English',
    privacy: 'Privacy', privacyDesc: 'What masters and teams see',
    feedback: 'Feedback', feedbackDesc: 'Write or record a voice message',
    helpTitle: 'Need help?', helpDesc: 'Message us in', helpLink: 'Telegram bot',
    accountTitle: 'Account actions', accountDesc: 'Data export and account deletion are available in the web version:',
    signOut: 'Sign out', signingOut: 'Signing out...',
    contactSheet: 'Contact info', save: 'Save',
    pwSheet: 'Change password', pwNew: 'New password', pwRepeat: 'Repeat password',
    pwMinLen: 'Password must be at least 8 characters', pwMismatch: 'Passwords do not match',
    pwNewPlaceholder: 'Minimum 6 characters', pwRepeatPlaceholder: 'Once more',
    pwSaved: 'Password updated',
    emailConfirm: 'A confirmation email has been sent. Open it to finish changing your email.',
    close: 'Close',
  },
};

export default function MiniAppSettingsPage() {
  const router = useRouter();
  const { haptic } = useTelegram();
  const { userId } = useAuthStore();
  const { theme, override, setOverride } = useMiniAppTheme();
  const lang = useMiniAppLocale();
  const t = I18N[lang];
  const [signingOut, setSigningOut] = useState(false);

  // Contact info
  const [email, setEmail] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);

  // Edit contact modal
  const [contactOpen, setContactOpen] = useState(false);
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [contactBusy, setContactBusy] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);
  const [emailConfirmSent, setEmailConfirmSent] = useState(false);

  // Password change
  const [pwOpen, setPwOpen] = useState(false);
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);

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

  function openContactEdit() {
    setEditPhone(phone ? phone.replace(/^\+380/, '') : '');
    setEditEmail(email ?? '');
    setContactError(null);
    setEmailConfirmSent(false);
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

  const iconBox: React.CSSProperties = {
    width: 36,
    height: 36,
    borderRadius: R.sm,
    border: `1px solid ${T.borderSubtle}`,
    background: T.surface,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  };

  const cardStyle: React.CSSProperties = {
    borderRadius: R.lg,
    border: `1px solid ${T.borderSubtle}`,
    background: T.surface,
    boxShadow: SHADOW.card,
    overflow: 'hidden',
  };

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '14px 16px',
    background: 'transparent',
    border: 'none',
    width: '100%',
    textAlign: 'left',
    cursor: 'pointer',
    fontFamily: 'inherit',
    color: T.text,
    textDecoration: 'none',
  };

  const divider: React.CSSProperties = {
    height: 1,
    background: T.borderSubtle,
    margin: '0 16px',
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        style={{
          ...FONT_BASE,
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
          padding: `16px ${PAGE_PADDING_X}px 16px`,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => router.back()}
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              border: `1px solid ${T.border}`,
              background: T.surface,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
            aria-label="Назад"
          >
            <ChevronLeft size={20} color={T.text} />
          </button>
          <h1 style={{ ...TYPE.h2, color: T.text, margin: 0 }}>{t.title}</h1>
        </div>

        {/* Contact info */}
        <div style={cardStyle}>
          <button type="button" onClick={openContactEdit} style={rowStyle}>
            <div style={iconBox}><Mail size={16} color={T.text} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ ...TYPE.bodyStrong, color: T.text, margin: 0 }}>{t.emailLabel}</p>
              <p style={{ ...TYPE.caption, margin: 0, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email ?? t.notSet}</p>
            </div>
            <ChevronRight size={16} color={T.textTertiary} />
          </button>
          <div style={divider} />
          <button type="button" onClick={openContactEdit} style={rowStyle}>
            <div style={iconBox}><PhoneIcon size={16} color={T.text} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ ...TYPE.bodyStrong, color: T.text, margin: 0 }}>{t.phoneLabel}</p>
              <p style={{ ...TYPE.caption, margin: 0, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{phone ?? t.notSet}</p>
            </div>
            <ChevronRight size={16} color={T.textTertiary} />
          </button>
          <div style={divider} />
          <button
            type="button"
            onClick={() => {
              setPwNew('');
              setPwConfirm('');
              setPwError(null);
              setPwSuccess(false);
              setPwOpen(true);
              haptic('light');
            }}
            style={rowStyle}
          >
            <div style={iconBox}><KeyRound size={16} color={T.text} /></div>
            <div style={{ flex: 1 }}>
              <p style={{ ...TYPE.bodyStrong, color: T.text, margin: 0 }}>{t.changePassword}</p>
            </div>
            <ChevronRight size={16} color={T.textTertiary} />
          </button>
        </div>

        {/* General */}
        <div style={cardStyle}>
          <Link href="/telegram/settings/notifications" onClick={() => haptic('light')} style={rowStyle}>
            <div style={iconBox}>
              <Bell size={16} color={T.text} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ ...TYPE.bodyStrong, color: T.text, margin: 0 }}>{t.reminders}</p>
              <p style={{ ...TYPE.caption, margin: 0, marginTop: 1 }}>{t.reminderDesc}</p>
            </div>
            <ChevronRight size={16} color={T.textTertiary} />
          </Link>
          <div style={divider} />
          {/* Theme toggle */}
          <button
            type="button"
            onClick={() => { haptic('light'); setOverride(theme === 'dark' ? 'light' : 'dark'); }}
            style={{ ...rowStyle, justifyContent: 'flex-start' }}
          >
            <div style={iconBox}><Moon size={16} color={T.text} /></div>
            <div style={{ flex: 1 }}>
              <p style={{ ...TYPE.bodyStrong, color: T.text, margin: 0 }}>{t.darkTheme}</p>
              <p style={{ ...TYPE.caption, margin: 0, marginTop: 1 }}>
                {override ? t.darkManual : t.darkAuto}
              </p>
            </div>
            <ToggleSwitch on={theme === 'dark'} />
          </button>
          <div style={divider} />
          <Link href="/telegram/settings/language" onClick={() => haptic('light')} style={rowStyle}>
            <div style={iconBox}><Globe size={16} color={T.text} /></div>
            <div style={{ flex: 1 }}>
              <p style={{ ...TYPE.bodyStrong, color: T.text, margin: 0 }}>{t.language}</p>
              <p style={{ ...TYPE.caption, margin: 0, marginTop: 1 }}>{t.langOptions}</p>
            </div>
            <ChevronRight size={16} color={T.textTertiary} />
          </Link>
          <div style={divider} />
          <Link href="/telegram/settings/privacy" onClick={() => haptic('light')} style={rowStyle}>
            <div style={iconBox}><Shield size={16} color={T.text} /></div>
            <div style={{ flex: 1 }}>
              <p style={{ ...TYPE.bodyStrong, color: T.text, margin: 0 }}>{t.privacy}</p>
              <p style={{ ...TYPE.caption, margin: 0, marginTop: 1 }}>{t.privacyDesc}</p>
            </div>
            <ChevronRight size={16} color={T.textTertiary} />
          </Link>
          <div style={divider} />
          <Link href="/telegram/settings/feedback" onClick={() => haptic('light')} style={rowStyle}>
            <div style={{ ...iconBox, borderColor: 'rgba(244,63,94,0.2)', background: 'rgba(244,63,94,0.08)' }}>
              <Heart size={16} color="#f43f5e" />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ ...TYPE.bodyStrong, color: T.text, margin: 0 }}>{t.feedback}</p>
              <p style={{ ...TYPE.caption, margin: 0, marginTop: 1 }}>{t.feedbackDesc}</p>
            </div>
            <ChevronRight size={16} color={T.textTertiary} />
          </Link>
        </div>

        {/* Support note */}
        <div
          style={{
            background: T.surface,
            border: `1px solid ${T.borderSubtle}`,
            borderRadius: R.lg,
            padding: '14px 16px',
            fontSize: 13,
            lineHeight: 1.6,
            color: T.textSecondary,
            boxShadow: SHADOW.card,
          }}
        >
          <p style={{ ...TYPE.bodyStrong, color: T.text, margin: 0, marginBottom: 4 }}>{t.helpTitle}</p>
          {t.helpDesc}{' '}
          <a
            href="https://t.me/crescacom_bot"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: T.accent, fontWeight: 600, textDecoration: 'none' }}
          >
            {t.helpLink}
          </a>.
        </div>

        {/* Web-only actions notice */}
        <div
          style={{
            background: T.surface,
            border: `1px solid ${T.borderSubtle}`,
            borderRadius: R.lg,
            padding: '14px 16px',
            fontSize: 13,
            lineHeight: 1.5,
            color: T.textSecondary,
            boxShadow: SHADOW.card,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 4 }}>
            {t.accountTitle}
          </div>
          {t.accountDesc}&nbsp;
          <a
            href="https://cres-ca.com/ru/account-settings"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: T.accent, fontWeight: 500, textDecoration: 'none' }}
          >
            cres-ca.com
          </a>
        </div>

        {/* Sign out */}
        <button
          type="button"
          onClick={signOut}
          disabled={signingOut}
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            width: '100%',
            padding: '16px',
            borderRadius: R.lg,
            border: `1px solid ${T.borderSubtle}`,
            background: T.surface,
            boxShadow: SHADOW.card,
            color: T.danger,
            fontSize: 14,
            fontWeight: 700,
            cursor: signingOut ? 'wait' : 'pointer',
            fontFamily: 'inherit',
            opacity: signingOut ? 0.6 : 1,
            overflow: 'hidden',
          }}
        >
          <span style={{ position: 'absolute', left: 0, top: 8, bottom: 8, width: 4, borderRadius: '0 4px 4px 0', background: T.danger }} />
          {signingOut ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={16} />}
          {signingOut ? t.signingOut : t.signOut}
        </button>
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
                paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h3 style={{ ...TYPE.h3, color: T.text, margin: 0 }}>{t.contactSheet}</h3>
                <button
                  type="button"
                  onClick={() => !contactBusy && setContactOpen(false)}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    border: `1px solid ${T.border}`,
                    background: T.surface,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                  aria-label={t.close}
                >
                  <X size={16} color={T.text} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ borderRadius: R.md, border: `1px solid ${T.borderSubtle}`, background: T.bg, padding: 16 }}>
                  <label style={{ ...TYPE.micro, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em' }}>Email</label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value.slice(0, 120))}
                    placeholder="you@example.com"
                    style={{
                      display: 'block',
                      width: '100%',
                      marginTop: 4,
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      ...TYPE.body,
                      color: T.text,
                      fontFamily: 'inherit',
                    }}
                  />
                  {emailConfirmSent && (
                    <p style={{ ...TYPE.micro, color: T.success, marginTop: 8 }}>
                      {t.emailConfirm}
                    </p>
                  )}
                </div>

                <div style={{ borderRadius: R.md, border: `1px solid ${T.borderSubtle}`, background: T.bg, padding: 16 }}>
                  <label style={{ ...TYPE.micro, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em' }}>Телефон</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, ...TYPE.body }}>
                    <span style={{ color: T.textTertiary }}>+380</span>
                    <input
                      type="tel"
                      inputMode="numeric"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value.replace(/\D/g, '').slice(0, 9))}
                      placeholder="501234567"
                      style={{
                        flex: 1,
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                        color: T.text,
                        fontFamily: 'inherit',
                        fontSize: 'inherit',
                      }}
                    />
                  </div>
                </div>

                {contactError && (
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
                    {contactError}
                  </div>
                )}

                <button
                  type="button"
                  onClick={saveContact}
                  disabled={contactBusy}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    width: '100%',
                    padding: '16px',
                    borderRadius: R.md,
                    border: 'none',
                    background: T.text,
                    color: T.bg,
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: contactBusy ? 'wait' : 'pointer',
                    fontFamily: 'inherit',
                    opacity: contactBusy ? 0.6 : 1,
                  }}
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
                paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h3 style={{ ...TYPE.h3, color: T.text, margin: 0 }}>{t.pwSheet}</h3>
                <button
                  type="button"
                  onClick={() => !pwBusy && setPwOpen(false)}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    border: `1px solid ${T.border}`,
                    background: T.surface,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                  aria-label={t.close}
                >
                  <X size={16} color={T.text} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ borderRadius: R.md, border: `1px solid ${T.borderSubtle}`, background: T.bg, padding: 16 }}>
                  <label style={{ ...TYPE.micro, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em' }}>{t.pwNew}</label>
                  <input
                    type="password"
                    value={pwNew}
                    onChange={(e) => setPwNew(e.target.value.slice(0, 72))}
                    placeholder={t.pwNewPlaceholder}
                    autoComplete="new-password"
                    style={{
                      display: 'block',
                      width: '100%',
                      marginTop: 4,
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      ...TYPE.body,
                      color: T.text,
                      fontFamily: 'inherit',
                    }}
                  />
                </div>

                <div style={{ borderRadius: R.md, border: `1px solid ${T.borderSubtle}`, background: T.bg, padding: 16 }}>
                  <label style={{ ...TYPE.micro, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em' }}>{t.pwRepeat}</label>
                  <input
                    type="password"
                    value={pwConfirm}
                    onChange={(e) => setPwConfirm(e.target.value.slice(0, 72))}
                    placeholder={t.pwRepeatPlaceholder}
                    autoComplete="new-password"
                    style={{
                      display: 'block',
                      width: '100%',
                      marginTop: 4,
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      ...TYPE.body,
                      color: T.text,
                      fontFamily: 'inherit',
                    }}
                  />
                </div>

                {pwError && (
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
                    {pwError}
                  </div>
                )}
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
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    width: '100%',
                    padding: '16px',
                    borderRadius: R.md,
                    border: 'none',
                    background: T.text,
                    color: T.bg,
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: pwBusy ? 'wait' : 'pointer',
                    fontFamily: 'inherit',
                    opacity: (pwBusy || pwSuccess) ? 0.6 : 1,
                  }}
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

function ToggleSwitch({ on }: { on: boolean }) {
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
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          transition: 'left 0.2s',
        }}
      />
    </div>
  );
}

function SettingsRow({
  icon: Icon,
  label,
  hint,
  onClick,
}: {
  icon: React.ComponentType<{ size?: number; color?: string }>;
  label: string;
  hint?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 16px',
        background: 'transparent',
        border: 'none',
        width: '100%',
        textAlign: 'left',
        cursor: 'pointer',
        fontFamily: 'inherit',
        color: T.text,
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: R.sm,
          border: `1px solid ${T.borderSubtle}`,
          background: T.surface,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon size={16} color={T.text} />
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ ...TYPE.bodyStrong, color: T.text, margin: 0 }}>{label}</p>
        {hint && <p style={{ ...TYPE.caption, margin: 0, marginTop: 1 }}>{hint}</p>}
      </div>
      <ChevronRight size={16} color={T.textTertiary} />
    </button>
  );
}
