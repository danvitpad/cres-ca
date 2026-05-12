/** --- YAML
 * name: MasterMiniAppSettings
 * description: Mini App master settings — паритет с клиентом по контактным
 *              данным (Email · Телефон · Пароль) + раздел разделов мастера
 *              (Расписание / Тариф / Уведомления / Язык / Помощь / Обратная
 *              связь) + Theme toggle + Sign out.
 * created: 2026-04-19
 * updated: 2026-05-07
 * --- */

'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import '@/styles/od-master-settings.css';
import {
  CreditCard,
  Bell,
  Globe,
  Moon,
  LogOut,
  ChevronRight,
  ArrowLeft,
  Loader2,
  Mail,
  Phone as PhoneIcon,
  KeyRound,
  Cake,
  Vibrate,
  X,
  Check,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useTelegram } from '@/components/miniapp/telegram-provider';
import { useAuthStore } from '@/stores/auth-store';
import { mapError } from '@/lib/errors';
import { getInitData } from '@/lib/telegram/webapp';
import { T, R, FONT_BASE, SHADOW, PAGE_PADDING_X, TYPE, SPRING } from '@/components/miniapp/design';
import { useMiniAppTheme } from '@/components/miniapp/theme';
import { useHapticPrefs } from '@/components/miniapp/haptic-provider';
import { MiniAppEditTextSheet } from '@/components/miniapp/edit-text-sheet';
import { Briefcase } from 'lucide-react';
import { useMiniAppLocale, type MiniAppLang } from '@/lib/miniapp/use-locale';

const I18N: Record<MiniAppLang, {
  back: string;
  schedule: string; billing: string; notifications: string; language: string; help: string; feedback: string;
  themeDark: string; themeManual: string; themeAsTelegram: string;
  hapticLabel: string; hapticHint: string;
  loggingOut: string; logout: string;
  emailLabel: string; phoneLabel: string; notSet: string;
  changePassword: string;
  contactSheet: string; save: string; close: string;
  pwSheet: string; pwNew: string; pwRepeat: string; pwMinLen: string; pwMismatch: string;
  pwNewPlaceholder: string; pwRepeatPlaceholder: string; pwSaved: string;
  emailConfirm: string;
  saveError: string;
  visibilityTitle: string; visibilityHint: string;
  showPhone: string; showEmail: string; showDob: string;
  specTitle: string; specEdit: string; specEmpty: string;
  sectionProfile: string; sectionAccount: string; sectionAppearance: string;
}> = {
  uk: {
    back: 'Назад',
    schedule: 'Графік роботи', billing: 'Тариф та платежі', notifications: 'Сповіщення', language: 'Мова',
    help: 'Допомога', feedback: 'Зворотний зв’язок',
    themeDark: 'Темна тема', themeManual: 'Вручну', themeAsTelegram: 'Як в Telegram',
    hapticLabel: 'Вібрація на дотик', hapticHint: 'Легкий відгук при натисканнях',
    loggingOut: 'Виходимо…', logout: 'Вийти',
    emailLabel: 'Email', phoneLabel: 'Телефон', notSet: 'Не вказано',
    changePassword: 'Змінити пароль',
    contactSheet: 'Контактні дані', save: 'Зберегти', close: 'Закрити',
    pwSheet: 'Змінити пароль', pwNew: 'Новий пароль', pwRepeat: 'Повторіть пароль',
    pwMinLen: 'Пароль має бути не менше 8 символів', pwMismatch: 'Паролі не збігаються',
    pwNewPlaceholder: 'Мінімум 8 символів', pwRepeatPlaceholder: 'Ще раз',
    pwSaved: 'Пароль оновлено',
    emailConfirm: 'Лист з підтвердженням надіслано. Відкрийте його, щоб завершити зміну email.',
    saveError: 'Не вдалось зберегти',
    visibilityTitle: 'Видимість для клієнтів',
    visibilityHint: 'Якщо тумблер вимкнений — поле сховане від клієнтів',
    showPhone: 'Показувати телефон', showEmail: 'Показувати email', showDob: 'Показувати дату народження',
    specTitle: 'Напрямок', specEdit: 'Напрямок майстра', specEmpty: 'Не вказано',
    sectionProfile: 'Профіль', sectionAccount: 'Акаунт', sectionAppearance: 'Зовнішній вигляд',
  },
  ru: {
    back: 'Назад',
    schedule: 'График работы', billing: 'Тариф и платежи', notifications: 'Уведомления', language: 'Язык',
    help: 'Помощь', feedback: 'Обратная связь',
    themeDark: 'Тёмная тема', themeManual: 'Вручную', themeAsTelegram: 'Как в Telegram',
    hapticLabel: 'Вибрация на тапах', hapticHint: 'Лёгкая отдача при нажатиях',
    loggingOut: 'Выходим…', logout: 'Выйти',
    emailLabel: 'Email', phoneLabel: 'Телефон', notSet: 'Не указан',
    changePassword: 'Сменить пароль',
    contactSheet: 'Контактные данные', save: 'Сохранить', close: 'Закрыть',
    pwSheet: 'Сменить пароль', pwNew: 'Новый пароль', pwRepeat: 'Повторите пароль',
    pwMinLen: 'Пароль должен быть не короче 8 символов', pwMismatch: 'Пароли не совпадают',
    pwNewPlaceholder: 'Минимум 8 символов', pwRepeatPlaceholder: 'Ещё раз',
    pwSaved: 'Пароль обновлён',
    emailConfirm: 'Письмо с подтверждением отправлено. Откройте его, чтобы завершить смену email.',
    saveError: 'Не удалось сохранить',
    visibilityTitle: 'Видимость для клиентов',
    visibilityHint: 'Если тумблер выключен — поле скрыто от клиентов',
    showPhone: 'Показывать телефон', showEmail: 'Показывать email', showDob: 'Показывать дату рождения',
    specTitle: 'Направление', specEdit: 'Направление мастера', specEmpty: 'Не указано',
    sectionProfile: 'Профиль', sectionAccount: 'Аккаунт', sectionAppearance: 'Внешний вид',
  },
  en: {
    back: 'Back',
    schedule: 'Schedule', billing: 'Plan & billing', notifications: 'Notifications', language: 'Language',
    help: 'Help', feedback: 'Feedback',
    themeDark: 'Dark theme', themeManual: 'Manual', themeAsTelegram: 'Match Telegram',
    hapticLabel: 'Tap vibration', hapticHint: 'Light haptic response on taps',
    loggingOut: 'Signing out…', logout: 'Sign out',
    emailLabel: 'Email', phoneLabel: 'Phone', notSet: 'Not set',
    changePassword: 'Change password',
    contactSheet: 'Contact info', save: 'Save', close: 'Close',
    pwSheet: 'Change password', pwNew: 'New password', pwRepeat: 'Repeat password',
    pwMinLen: 'Password must be at least 8 characters', pwMismatch: 'Passwords do not match',
    pwNewPlaceholder: 'At least 8 characters', pwRepeatPlaceholder: 'Once more',
    pwSaved: 'Password updated',
    emailConfirm: 'Confirmation email sent. Open it to finish changing your email.',
    saveError: 'Failed to save',
    visibilityTitle: 'Visibility to clients',
    visibilityHint: 'Toggle off to hide a field from clients',
    showPhone: 'Show phone', showEmail: 'Show email', showDob: 'Show birthday',
    specTitle: 'Direction', specEdit: 'Master direction', specEmpty: 'Not set',
    sectionProfile: 'Profile', sectionAccount: 'Account', sectionAppearance: 'Appearance',
  },
};

interface SettingsItem {
  key: string;
  href: string;
  labelKey: keyof typeof I18N['ru'];
  Icon: LucideIcon;
}

// Минимальный набор настроек. Убрано (по запросу 2026-05-07):
//   • График работы — переехал на публичную страницу.
//   • Помощь — пишется в TG-бот.
//   • Обратная связь — пишется в TG-бот.
const ITEMS: SettingsItem[] = [
  { key: 'billing',       href: '/telegram/m/settings/billing',        labelKey: 'billing',       Icon: CreditCard },
  { key: 'notifications', href: '/telegram/m/settings/notifications',  labelKey: 'notifications', Icon: Bell },
  { key: 'language',      href: '/telegram/m/settings/language',       labelKey: 'language',      Icon: Globe },
];

export default function MasterMiniAppSettings() {
  const { haptic } = useTelegram();
  const router = useRouter();
  const { userId, clearAuth } = useAuthStore();
  const { theme, override, setOverride } = useMiniAppTheme();
  const { enabled: hapticEnabled, loaded: hapticLoaded, setEnabled: setHapticEnabled } = useHapticPrefs();
  const lang = useMiniAppLocale();
  const t = I18N[lang];
  const [loggingOut, setLoggingOut] = useState(false);

  // Контактные данные — то же что у клиента
  const [email, setEmail] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);

  // Edit contact modal
  const [contactOpen, setContactOpen] = useState(false);
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

  // Visibility flags для публичной страницы — мастер решает показывать ли
  // клиентам телефон / email / ДР. null = ещё не загружено (скрываем
  // тумблеры до загрузки, иначе flash «выключено → включено»).
  const [phonePublic, setPhonePublic] = useState<boolean | null>(null);
  const [emailPublic, setEmailPublic] = useState<boolean | null>(null);
  const [dobPublic, setDobPublic] = useState<boolean | null>(null);

  // Направление мастера (specialization). Редактируется тут, а не на публичке.
  const [specialization, setSpecialization] = useState<string>('');
  const [specSheetOpen, setSpecSheetOpen] = useState(false);
  const [specSaving, setSpecSaving] = useState(false);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const supabase = createClient();
      const [profileQ, masterQ] = await Promise.all([
        supabase
          .from('profiles')
          .select('email, phone')
          .eq('id', userId)
          .maybeSingle<{ email: string | null; phone: string | null }>(),
        supabase
          .from('masters')
          .select('phone_public, email_public, dob_public, specialization, headline')
          .eq('profile_id', userId)
          .maybeSingle<{
            phone_public: boolean | null; email_public: boolean | null; dob_public: boolean | null;
            specialization: string | null; headline: string | null;
          }>(),
      ]);
      if (profileQ.data) {
        setEmail(profileQ.data.email);
        setPhone(profileQ.data.phone);
      }
      if (masterQ.data) {
        setPhonePublic(!!masterQ.data.phone_public);
        setEmailPublic(!!masterQ.data.email_public);
        setDobPublic(!!masterQ.data.dob_public);
        setSpecialization(masterQ.data.headline || masterQ.data.specialization || '');
      }
    })();
  }, [userId]);

  async function saveSpecialization(value: string) {
    setSpecSaving(true);
    try {
      const initData = getInitData();
      const res = await fetch('/api/telegram/m/master-patch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(initData ? { 'X-TG-Init-Data': initData } : {}),
        },
        body: JSON.stringify({ headline: value, specialization: value }),
      });
      if (!res.ok) throw new Error('failed');
      setSpecialization(value.trim());
      setSpecSheetOpen(false);
      haptic('success');
    } catch {
      haptic('error');
      throw new Error('save_failed');
    } finally {
      setSpecSaving(false);
    }
  }

  async function toggleVisibility(field: 'phone_public' | 'email_public' | 'dob_public', next: boolean) {
    haptic('light');
    // Optimistic update — visual immediately, revert при ошибке.
    if (field === 'phone_public') setPhonePublic(next);
    if (field === 'email_public') setEmailPublic(next);
    if (field === 'dob_public') setDobPublic(next);
    const initData = getInitData();
    try {
      const res = await fetch('/api/telegram/m/public-visibility', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(initData ? { 'X-TG-Init-Data': initData } : {}),
        },
        body: JSON.stringify({ [field]: next }),
      });
      if (!res.ok) throw new Error('failed');
    } catch {
      haptic('error');
      // revert
      if (field === 'phone_public') setPhonePublic(!next);
      if (field === 'email_public') setEmailPublic(!next);
      if (field === 'dob_public') setDobPublic(!next);
    }
  }

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
      const initData = getInitData();
      const emailChanged = editEmail.trim().toLowerCase() !== (email ?? '').toLowerCase();
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(initData ? { 'X-TG-Init-Data': initData } : {}),
        },
        body: JSON.stringify({
          phone: editPhone.trim(),
          email: editEmail.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setContactError(mapError(data.error, t.saveError));
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
      const initData = getInitData();
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(initData ? { 'X-TG-Init-Data': initData } : {}),
        },
        body: JSON.stringify({ password: pwNew }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPwError(mapError(data.error, t.saveError));
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

  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    haptic('warning');
    // Паритет с клиентским logout: сначала /api/telegram/unlink (отвязка
    // telegram_id чтобы не было автологина), потом auth.signOut, очистка
    // auth-store + sessionStorage, и затем редирект. Раньше был только
    // fire-and-forget signOut + redirect — этого мало для чистого выхода.
    try {
      const initData = getInitData();
      if (initData) {
        await fetch('/api/telegram/unlink', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ initData }),
        });
      }
    } catch { /* ignore */ }
    try { await createClient().auth.signOut(); } catch { /* ignore */ }
    try { clearAuth(); } catch { /* ignore */ }
    try { sessionStorage.removeItem('cres:tg'); } catch { /* ignore */ }
    window.location.replace('/telegram/welcome');
  }

  // Стили settings: .settings-card / .settings-row / .settings-row-icon /
  // .icon-cobalt / .settings-section-label берутся из
  // /styles/od-master-settings.css (.od-master-settings scope).

  return (
    <div
      className="od-master-settings"
      style={{
        ...FONT_BASE,
        background: T.bg,
        color: T.text,
      }}
    >
      <div style={{ padding: `16px ${PAGE_PADDING_X}px 32px`, display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Back button — явный переход на /more, не router.back().
            Раньше browser-back уходил в history → если зашёл с /more →
            /settings → /language → back → /settings, то router.back()
            на /settings возвращал не на /more а обратно на /language.
            Исправлено: всегда идём на /more напрямую. */}
        <button
          type="button"
          onClick={() => { haptic('light'); router.push('/telegram/m/more'); }}
          aria-label={t.back}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            border: `1px solid ${T.border}`,
            background: T.surface,
            color: T.text,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: SHADOW.card,
          }}
        >
          <ArrowLeft size={18} strokeWidth={2.4} />
        </button>

        {/* ─── ПРОФИЛЬ — личные данные мастера ─── */}
        <div>
          <p className="settings-section-label" style={{ margin: '4px 4px 8px' }}>{t.sectionProfile}</p>
          <div className="settings-card">
            <button type="button" onClick={openContactEdit} className="settings-row">
              <div className="settings-row-icon icon-cobalt"><Mail size={16} color={T.text} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ ...TYPE.bodyStrong, color: T.text, margin: 0 }}>{t.emailLabel}</p>
                <p style={{ ...TYPE.caption, margin: '1px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email ?? t.notSet}</p>
              </div>
              <ChevronRight size={16} color={T.textTertiary} />
            </button>
            {/* divider handled by .settings-row:not(:last-child)::after */}
            <button type="button" onClick={openContactEdit} className="settings-row">
              <div className="settings-row-icon icon-cobalt"><PhoneIcon size={16} color={T.text} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ ...TYPE.bodyStrong, color: T.text, margin: 0 }}>{t.phoneLabel}</p>
                <p style={{ ...TYPE.caption, margin: '1px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{phone ?? t.notSet}</p>
              </div>
              <ChevronRight size={16} color={T.textTertiary} />
            </button>
            {/* divider handled by .settings-row:not(:last-child)::after */}
            <button
              type="button"
              onClick={() => {
                setPwNew(''); setPwConfirm('');
                setPwError(null); setPwSuccess(false);
                setPwOpen(true);
                haptic('light');
              }}
              className="settings-row"
            >
              <div className="settings-row-icon icon-cobalt"><KeyRound size={16} color={T.text} /></div>
              <div style={{ flex: 1 }}>
                <p style={{ ...TYPE.bodyStrong, color: T.text, margin: 0 }}>{t.changePassword}</p>
              </div>
              <ChevronRight size={16} color={T.textTertiary} />
            </button>
            {/* divider handled by .settings-row:not(:last-child)::after */}
            <button
              type="button"
              onClick={() => { haptic('light'); setSpecSheetOpen(true); }}
              className="settings-row"
            >
              <div className="settings-row-icon icon-cobalt"><Briefcase size={16} color={T.text} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ ...TYPE.bodyStrong, color: T.text, margin: 0 }}>{t.specTitle}</p>
                <p style={{ ...TYPE.caption, margin: '1px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {specialization || t.specEmpty}
                </p>
              </div>
              <ChevronRight size={16} color={T.textTertiary} />
            </button>
          </div>
        </div>

        {/* ─── ВИДИМОСТЬ ДЛЯ КЛИЕНТОВ — что показывать на публичной странице ─── */}
        {phonePublic !== null && emailPublic !== null && dobPublic !== null && (
          <div>
            <p className="settings-section-label" style={{ margin: '4px 4px 8px' }}>{t.visibilityTitle}</p>
            <div className="settings-card">
              <button type="button" onClick={() => toggleVisibility('phone_public', !phonePublic)} className="settings-row">
                <div className="settings-row-icon icon-cobalt"><PhoneIcon size={16} color={T.text} /></div>
                <p style={{ ...TYPE.bodyStrong, color: T.text, margin: 0, flex: 1 }}>{t.showPhone}</p>
                <MiniToggle on={phonePublic} />
              </button>
              {/* divider handled by .settings-row:not(:last-child)::after */}
              <button type="button" onClick={() => toggleVisibility('email_public', !emailPublic)} className="settings-row">
                <div className="settings-row-icon icon-cobalt"><Mail size={16} color={T.text} /></div>
                <p style={{ ...TYPE.bodyStrong, color: T.text, margin: 0, flex: 1 }}>{t.showEmail}</p>
                <MiniToggle on={emailPublic} />
              </button>
              {/* divider handled by .settings-row:not(:last-child)::after */}
              <button type="button" onClick={() => toggleVisibility('dob_public', !dobPublic)} className="settings-row">
                <div className="settings-row-icon icon-cobalt"><Cake size={16} color={T.text} /></div>
                <p style={{ ...TYPE.bodyStrong, color: T.text, margin: 0, flex: 1 }}>{t.showDob}</p>
                <MiniToggle on={dobPublic} />
              </button>
            </div>
            <p style={{ ...TYPE.micro, color: T.textTertiary, margin: '6px 4px 0' }}>
              {t.visibilityHint}
            </p>
          </div>
        )}

        {/* ─── АККАУНТ — уведомления + подписка ─── */}
        <div>
          <p className="settings-section-label" style={{ margin: '4px 4px 8px' }}>{t.sectionAccount}</p>
          <div className="settings-card">
            {ITEMS.map((item, idx) => {
              const Icon = item.Icon;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  onClick={() => haptic('light')}
                  className="settings-row"
                >
                  <div className="settings-row-icon icon-cobalt"><Icon size={16} color={T.text} /></div>
                  <span style={{ flex: 1, ...TYPE.bodyStrong, color: T.text }}>
                    {t[item.labelKey]}
                  </span>
                  <ChevronRight size={16} color={T.textTertiary} strokeWidth={2} />
                </Link>
              );
            }).reduce<React.ReactNode[]>((acc, el, i) => {
              // dividers handled by .settings-row:not(:last-child)::after
              acc.push(el);
              return acc;
            }, [])}
          </div>
        </div>

        {/* ─── ВНЕШНИЙ ВИД — тема + вибрация ─── */}
        <div>
          <p className="settings-section-label" style={{ margin: '4px 4px 8px' }}>{t.sectionAppearance}</p>
          <div className="settings-card">
            <button
              type="button"
              onClick={() => { haptic('light'); setOverride(theme === 'dark' ? 'light' : 'dark'); }}
              className="settings-row"
            >
              <div className="settings-row-icon icon-cobalt"><Moon size={16} color={T.text} /></div>
              <span style={{ flex: 1 }}>
                <span style={{ display: 'block', ...TYPE.bodyStrong, color: T.text }}>{t.themeDark}</span>
                <span style={{ display: 'block', ...TYPE.caption, marginTop: 1 }}>
                  {override ? t.themeManual : t.themeAsTelegram}
                </span>
              </span>
              <MiniToggle on={theme === 'dark'} />
            </button>
            {/* divider handled by .settings-row:not(:last-child)::after */}
            <button
              type="button"
              onClick={() => {
                if (!hapticLoaded) return;
                const next = !hapticEnabled;
                setHapticEnabled(next);
                if (next) haptic('light');
              }}
              disabled={!hapticLoaded}
              className="settings-row"
            >
              <div className="settings-row-icon icon-cobalt"><Vibrate size={16} color={T.text} /></div>
              <span style={{ flex: 1 }}>
                <span style={{ display: 'block', ...TYPE.bodyStrong, color: T.text }}>{t.hapticLabel}</span>
                <span style={{ display: 'block', ...TYPE.caption, marginTop: 1 }}>{t.hapticHint}</span>
              </span>
              <MiniToggle on={hapticEnabled} />
            </button>
          </div>
        </div>

        {/* ─── ВЫХОД — литерально .settings-logout-row из OD ─── */}
        <button
          type="button"
          onClick={logout}
          disabled={loggingOut}
          className="settings-logout-row"
          style={{
            marginTop: 4,
            cursor: loggingOut ? 'wait' : 'pointer',
            opacity: loggingOut ? 0.6 : 1,
          }}
        >
          {loggingOut
            ? <Loader2 size={16} className="animate-spin" />
            : <LogOut size={16} strokeWidth={2.4} />
          }
          {loggingOut ? t.loggingOut : t.logout}
        </button>
      </div>

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
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h3 style={{ ...TYPE.h3, color: T.text, margin: 0 }}>{t.contactSheet}</h3>
                <button
                  type="button"
                  onClick={() => !contactBusy && setContactOpen(false)}
                  style={{
                    width: 36, height: 36, borderRadius: '50%',
                    border: `1px solid ${T.border}`, background: T.surface,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
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
                      display: 'block', width: '100%', marginTop: 4,
                      background: 'transparent', border: 'none', outline: 'none',
                      ...TYPE.body, color: T.text, fontFamily: 'inherit',
                    }}
                  />
                  {emailConfirmSent && (
                    <p style={{ ...TYPE.micro, color: T.success, marginTop: 8 }}>
                      {t.emailConfirm}
                    </p>
                  )}
                </div>

                <div style={{ borderRadius: R.md, border: `1px solid ${T.borderSubtle}`, background: T.bg, padding: 16 }}>
                  <label style={{ ...TYPE.micro, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em' }}>{t.phoneLabel}</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, ...TYPE.body }}>
                    <span style={{ color: T.textTertiary }}>+380</span>
                    <input
                      type="tel"
                      inputMode="numeric"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value.replace(/\D/g, '').slice(0, 9))}
                      placeholder="501234567"
                      style={{
                        flex: 1, background: 'transparent', border: 'none', outline: 'none',
                        color: T.text, fontFamily: 'inherit', fontSize: 'inherit',
                      }}
                    />
                  </div>
                </div>

                {contactError && (
                  <div style={{
                    position: 'relative', borderRadius: R.sm,
                    border: `1px solid ${T.dangerSoft}`, background: T.dangerSoft,
                    padding: '12px 12px 12px 16px', ...TYPE.caption, color: T.danger, overflow: 'hidden',
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
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    width: '100%', padding: '16px', borderRadius: R.md, border: 'none',
                    background: T.text, color: T.bg, fontSize: 15, fontWeight: 700,
                    cursor: contactBusy ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: contactBusy ? 0.6 : 1,
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
              position: 'fixed', inset: 0, zIndex: 50,
              display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
              background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
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
                width: '100%', maxWidth: 480,
                borderRadius: `${R.lg}px ${R.lg}px 0 0`, background: T.surface,
                padding: `20px ${PAGE_PADDING_X}px`,
                paddingBottom: 'calc(96px + env(safe-area-inset-bottom, 0px))',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h3 style={{ ...TYPE.h3, color: T.text, margin: 0 }}>{t.pwSheet}</h3>
                <button
                  type="button"
                  onClick={() => !pwBusy && setPwOpen(false)}
                  style={{
                    width: 36, height: 36, borderRadius: '50%',
                    border: `1px solid ${T.border}`, background: T.surface,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
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
                      display: 'block', width: '100%', marginTop: 4,
                      background: 'transparent', border: 'none', outline: 'none',
                      ...TYPE.body, color: T.text, fontFamily: 'inherit',
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
                      display: 'block', width: '100%', marginTop: 4,
                      background: 'transparent', border: 'none', outline: 'none',
                      ...TYPE.body, color: T.text, fontFamily: 'inherit',
                    }}
                  />
                </div>

                {pwError && (
                  <div style={{
                    position: 'relative', borderRadius: R.sm,
                    border: `1px solid ${T.dangerSoft}`, background: T.dangerSoft,
                    padding: '12px 12px 12px 16px', ...TYPE.caption, color: T.danger, overflow: 'hidden',
                  }}>
                    <span style={{ position: 'absolute', left: 0, top: 8, bottom: 8, width: 4, borderRadius: '0 4px 4px 0', background: T.danger }} />
                    {pwError}
                  </div>
                )}
                {pwSuccess && (
                  <div style={{
                    position: 'relative', borderRadius: R.sm,
                    border: `1px solid ${T.successSoft}`, background: T.successSoft,
                    padding: '12px 12px 12px 16px', ...TYPE.caption, color: T.success, overflow: 'hidden',
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
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    width: '100%', padding: '16px', borderRadius: R.md, border: 'none',
                    background: T.text, color: T.bg, fontSize: 15, fontWeight: 700,
                    cursor: pwBusy ? 'wait' : 'pointer', fontFamily: 'inherit',
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

      {/* Edit specialization sheet */}
      <MiniAppEditTextSheet
        open={specSheetOpen}
        title={t.specEdit}
        initialValue={specialization}
        multiline={false}
        maxLength={120}
        onClose={() => !specSaving && setSpecSheetOpen(false)}
        onSave={async (v) => { await saveSpecialization(v); }}
      />
    </div>
  );
}

function MiniToggle({ on }: { on: boolean }) {
  // Литерально .ios-switch (.on) из OD master-settings.html — стили в
  // od-master-settings.css. Размер 50×30 (OD), белый thumb 26px, переезд
  // 20px вправо в состоянии on. Не интерактивный сам по себе — оборачивается
  // в кнопку.
  return <span className={`ios-switch${on ? ' on' : ''}`} aria-hidden />;
}
