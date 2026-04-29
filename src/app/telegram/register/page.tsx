/** --- YAML
 * name: MiniAppRegisterPage
 * description: Registration form in Mini App. Reads cres:locale from localStorage and shows UI in uk/ru/en. Fields: role (client/master/team), Name+Surname, DoB (required), Phone (required), Email, Password. Telegram auto-linked — shown as fact. Theme-responsive. Sticky bottom hides on keyboard.
 * created: 2026-04-13
 * updated: 2026-04-29
 * --- */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  User, Phone, Mail, Calendar, Loader2, Check, Send,
  UserRound, Briefcase, Building2, Lock, ArrowLeft,
} from 'lucide-react';
import { mapError } from '@/lib/errors';
import { useAuthStore } from '@/stores/auth-store';

// ─── i18n ────────────────────────────────────────────────────────────────────
type Lang = 'uk' | 'ru' | 'en';
const LANG_CYCLE: Lang[] = ['uk', 'ru', 'en'];

const T = {
  uk: {
    title: 'Реєстрація',
    subtitle: 'Заповніть, будь ласка, кілька полів — це займе менше хвилини.',
    roleLabel: 'Я реєструюся як',
    roleClient: 'Клієнт', roleMaster: 'Майстер', roleTeam: 'Команда',
    masterHint: 'Ви отримаєте Mini App майстра з календарем, клієнтами та фінансами. Налаштувати послуги та графік можна одразу після реєстрації.',
    teamHint: 'Команді — мультимайстерський календар, склад, зміни та звіти. Послуги та людей додасте після реєстрації.',
    teamName: 'Назва команди',
    teamNamePlaceholder: 'Наприклад: Studio 54, AutoPro, Dr. Smile...',
    firstName: "Ім'я", firstNameAdmin: "Ім'я адміністратора",
    lastName: 'Прізвище', lastNameAdmin: 'Прізвище адміністратора',
    dob: 'Дата народження', dobPlaceholder: '__.__.____',
    dobMonthErr: 'Місяць від 01 до 12',
    dobYearErr: (y: number) => `Рік від 1900 до ${y}`,
    dobDayErr: (d: number, m: string, y: string) => `У ${m}.${y} немає ${d}-го числа`,
    dobFutureErr: 'Дата в майбутньому',
    dobRequired: 'Введіть дату народження',
    phone: 'Телефон', email: 'Email',
    password: 'Пароль', passwordPlaceholder: 'мінімум 8 символів',
    tgLinked: 'Telegram прив\'язаний',
    tgLinkedSub: (handle: string) => `${handle} — для входу без пароля та для сповіщень.`,
    createBtn: 'Створити акаунт', saving: 'Зберігаємо…',
    done: 'Готово — відкриваємо CRES-CA',
    terms: 'Продовжуючи, ви погоджуєтесь з',
    termsLink: 'Умовами використання',
    haveAccount: 'Вже є акаунт?', signIn: 'Увійти',
    otpTitle: 'Підтвердження email',
    otpSub: (email: string) => `Ми надіслали 8-значний код на ${email}. Введіть його нижче.`,
    otpPlaceholder: '• • • • • • • •',
    otpConfirm: 'Підтвердити',
    otpResend: 'Надіслати код ще раз',
  },
  ru: {
    title: 'Регистрация',
    subtitle: 'Заполните, пожалуйста, несколько полей — это займёт меньше минуты.',
    roleLabel: 'Я регистрируюсь как',
    roleClient: 'Клиент', roleMaster: 'Мастер', roleTeam: 'Команда',
    masterHint: 'Вы получите Mini App мастера с календарём, клиентами и финансами. Настроить услуги и график можно будет сразу после регистрации.',
    teamHint: 'Команде — мультимастерский календарь, состав, смены и отчёты. Услуги и людей добавите после регистрации.',
    teamName: 'Название команды',
    teamNamePlaceholder: 'Например: Studio 54, AutoPro, Dr. Smile...',
    firstName: 'Имя', firstNameAdmin: 'Имя администратора',
    lastName: 'Фамилия', lastNameAdmin: 'Фамилия администратора',
    dob: 'Дата рождения', dobPlaceholder: '__.__.____',
    dobMonthErr: 'Месяц от 01 до 12',
    dobYearErr: (y: number) => `Год от 1900 до ${y}`,
    dobDayErr: (d: number, m: string, y: string) => `В ${m}.${y} нет ${d}-го числа`,
    dobFutureErr: 'Дата в будущем',
    dobRequired: 'Введите дату рождения',
    phone: 'Телефон', email: 'Email',
    password: 'Пароль', passwordPlaceholder: 'минимум 8 символов',
    tgLinked: 'Telegram привязан',
    tgLinkedSub: (handle: string) => `${handle} — для входа без пароля и для уведомлений.`,
    createBtn: 'Создать аккаунт', saving: 'Сохраняем…',
    done: 'Готово — открываем CRES-CA',
    terms: 'Продолжая, вы принимаете',
    termsLink: 'Условия использования',
    haveAccount: 'Уже есть аккаунт?', signIn: 'Войти',
    otpTitle: 'Подтверждение email',
    otpSub: (email: string) => `Мы отправили 8-значный код на ${email}. Введите его ниже.`,
    otpPlaceholder: '• • • • • • • •',
    otpConfirm: 'Подтвердить',
    otpResend: 'Отправить код ещё раз',
  },
  en: {
    title: 'Sign up',
    subtitle: 'Fill in a few fields — it takes less than a minute.',
    roleLabel: 'I am signing up as',
    roleClient: 'Client', roleMaster: 'Master', roleTeam: 'Team',
    masterHint: 'You will get a Master Mini App with calendar, clients and finances. Set up services and schedule right after sign-up.',
    teamHint: 'Team — multi-master calendar, roster, shifts and reports. Add services and people after sign-up.',
    teamName: 'Team name',
    teamNamePlaceholder: 'E.g.: Studio 54, AutoPro, Dr. Smile...',
    firstName: 'First name', firstNameAdmin: "Admin's first name",
    lastName: 'Last name', lastNameAdmin: "Admin's last name",
    dob: 'Date of birth', dobPlaceholder: '__.__.____',
    dobMonthErr: 'Month must be 01–12',
    dobYearErr: (y: number) => `Year must be 1900–${y}`,
    dobDayErr: (d: number, m: string, y: string) => `${m}.${y} has no day ${d}`,
    dobFutureErr: 'Date is in the future',
    dobRequired: 'Enter date of birth',
    phone: 'Phone', email: 'Email',
    password: 'Password', passwordPlaceholder: 'at least 8 characters',
    tgLinked: 'Telegram connected',
    tgLinkedSub: (handle: string) => `${handle} — for passwordless sign-in and notifications.`,
    createBtn: 'Create account', saving: 'Saving…',
    done: 'Done — opening CRES-CA',
    terms: 'By continuing you accept the',
    termsLink: 'Terms of Use',
    haveAccount: 'Already have an account?', signIn: 'Sign in',
    otpTitle: 'Email confirmation',
    otpSub: (email: string) => `We sent an 8-digit code to ${email}. Enter it below.`,
    otpPlaceholder: '• • • • • • • •',
    otpConfirm: 'Confirm',
    otpResend: 'Resend code',
  },
} as const;

// ─── Types ───────────────────────────────────────────────────────────────────
interface TgData {
  id: number;
  first_name: string;
  last_name: string | null;
  username: string | null;
  photo_url: string | null;
  language_code: string | null;
}

interface Stash {
  initData: string;
  tgData: TgData | null;
  startParam: string | null;
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function MiniAppRegisterPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [stash, setStash] = useState<Stash | null>(null);
  const [lang, setLang] = useState<Lang>('ru');

  const [role, setRole] = useState<'client' | 'master' | 'salon_admin'>('client');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [salonName, setSalonName] = useState('');
  // Телефон сразу со страны-кода — нет «резкого» появления при тапе
  const [phone, setPhone] = useState('+380 ');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [dob, setDob] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [otpStage, setOtpStage] = useState<'form' | 'otp'>('form');
  const [otpCode, setOtpCode] = useState('');
  const [otpBusy, setOtpBusy] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [pendingRoute, setPendingRoute] = useState<string | null>(null);

  // Кнопка прячется только когда клавиатура РЕАЛЬНО открылась
  // (visualViewport уменьшается при появлении клавиатуры на мобильном)
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  // Читаем сохранённый язык из welcome
  useEffect(() => {
    try {
      const stored = localStorage.getItem('cres:locale') as Lang | null;
      if (stored && LANG_CYCLE.includes(stored)) setLang(stored);
    } catch {}
  }, []);

  useEffect(() => {
    const raw = sessionStorage.getItem('cres:tg');
    if (!raw) { router.replace('/telegram'); return; }
    const s = JSON.parse(raw) as Stash;
    setStash(s);
    if (s.tgData?.first_name) setFirstName(s.tgData.first_name);
    if (s.tgData?.last_name) setLastName(s.tgData.last_name);
  }, [router]);

  // Следим за реальным размером видимой области — когда клавиатура открывается,
  // visualViewport.height падает. Прячем sticky bottom только тогда.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => {
      setKeyboardOpen(vv.height < window.innerHeight * 0.8);
    };
    vv.addEventListener('resize', onResize);
    return () => vv.removeEventListener('resize', onResize);
  }, []);

  const t = T[lang];

  function normalizePhone(value: string): string | null {
    const digits = value.replace(/\D/g, '');
    if (digits.length < 9 || digits.length > 15) return null;
    return '+' + digits;
  }

  function validate(): string | null {
    if (role === 'salon_admin' && !salonName.trim()) return mapError('missing_salon_name');
    if (!firstName.trim()) return mapError('missing_name');
    if (!lastName.trim()) return mapError('missing_name');
    if (!dob) return t.dobRequired;
    if (!normalizePhone(phone)) return mapError('invalid_phone');
    if (!email.trim()) return mapError('missing_email');
    if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email.trim())) return mapError('invalid_email');
    if (password.length < 8) return mapError('weak_password');
    return null;
  }

  async function submit() {
    if (!stash) return;
    const err = validate();
    if (err) { setErrorMsg(err); return; }
    setErrorMsg(null);
    setSubmitting(true);

    const personalFullName = [lastName.trim(), firstName.trim()].filter(Boolean).join(' ');
    const normalizedPhone = normalizePhone(phone)!;

    try {
      const res = await fetch('/api/telegram/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initData: stash.initData,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          fullNameOverride: role === 'salon_admin' ? salonName.trim() : personalFullName,
          salonName: role === 'salon_admin' ? salonName.trim() : undefined,
          phone: normalizedPhone,
          email: email.trim(),
          password,
          dateOfBirth: dob || null,
          linkTelegram: true,
          role,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setErrorMsg(mapError(data.error)); setSubmitting(false); return; }

      setAuth(data.userId, data.role, null);
      sessionStorage.removeItem('cres:tg');

      const target =
        data.role === 'master' || data.role === 'salon_admin'
          ? '/telegram/m/home'
          : stash.startParam?.startsWith('master_')
            ? `/telegram/home?master=${stash.startParam.replace('master_', '')}`
            : '/telegram/home';
      setPendingRoute(target);

      const otpRes = await fetch('/api/telegram/email-otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), locale: lang }),
      });
      if (!otpRes.ok) {
        const j = await otpRes.json().catch(() => ({}));
        setErrorMsg(mapError(j.error, 'Не удалось отправить код. Попробуйте снова.'));
        setSubmitting(false);
        return;
      }
      setSubmitting(false);
      setOtpStage('otp');
    } catch (e) {
      setErrorMsg(mapError(e instanceof Error ? e.message : 'network_error'));
      setSubmitting(false);
    }
  }

  async function verifyOtp() {
    if (otpBusy) return;
    setOtpBusy(true);
    setOtpError(null);
    try {
      const res = await fetch('/api/telegram/email-otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: otpCode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setOtpError(mapError(data.error, 'Ошибка проверки')); setOtpBusy(false); return; }
      setDone(true);
      setTimeout(() => { if (pendingRoute) router.replace(pendingRoute); }, 500);
    } catch {
      setOtpError(mapError('network_error'));
      setOtpBusy(false);
    }
  }

  async function resendOtp() {
    setOtpError(null);
    try {
      await fetch('/api/telegram/email-otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), locale: lang }),
      });
    } catch {}
  }

  if (!stash) return <div className="min-h-dvh" style={{ background: 'var(--background)' }} />;

  // ─── OTP screen ─────────────────────────────────────────────────────────────
  if (otpStage === 'otp') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex min-h-dvh flex-col"
        style={{ background: 'var(--background)', color: 'var(--foreground)' }}
      >
        <div className="flex-1 space-y-6 px-6 pt-16">
          <div className="space-y-3 text-center">
            <div
              className="mx-auto flex size-14 items-center justify-center rounded-2xl"
              style={{ background: 'color-mix(in oklab, var(--color-accent) 15%, transparent)' }}
            >
              <Mail className="size-6" style={{ color: 'var(--color-accent)' }} />
            </div>
            <h1 className="text-2xl font-bold">{t.otpTitle}</h1>
            <p
              className="mx-auto max-w-xs text-[13px] leading-relaxed"
              style={{ color: 'color-mix(in oklab, var(--foreground) 65%, transparent)' }}
            >
              {t.otpSub(email).split(email)[0]}
              <span className="font-semibold" style={{ color: 'var(--foreground)' }}>{email}</span>
              {t.otpSub(email).split(email)[1]}
            </p>
          </div>

          <div className="mx-auto max-w-xs">
            <input
              autoFocus
              inputMode="numeric"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
              placeholder={t.otpPlaceholder}
              className="w-full rounded-2xl border px-4 py-5 text-center font-mono text-2xl tracking-[0.3em] outline-none"
              style={{
                borderColor: 'color-mix(in oklab, var(--foreground) 12%, transparent)',
                background: 'color-mix(in oklab, var(--foreground) 4%, transparent)',
                color: 'var(--foreground)',
                caretColor: 'var(--color-accent)',
              }}
            />
          </div>

          {otpError && (
            <p className="text-center text-xs" style={{ color: '#f43f5e' }}>{otpError}</p>
          )}

          <div className="mx-auto max-w-xs space-y-2">
            <button
              onClick={verifyOtp}
              disabled={otpBusy || otpCode.length !== 8}
              className="flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-[16px] font-semibold active:scale-[0.98] transition-transform disabled:opacity-60"
              style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
            >
              {otpBusy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              {t.otpConfirm}
            </button>
            <button
              onClick={resendOtp}
              className="w-full py-2 text-xs underline-offset-2 hover:underline"
              style={{ color: 'color-mix(in oklab, var(--foreground) 55%, transparent)' }}
            >
              {t.otpResend}
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  const tgHandle = stash.tgData?.username;
  const tgFirstName = stash.tgData?.first_name;
  const tgDisplayName = tgHandle ? `@${tgHandle}` : (tgFirstName ?? 'Telegram');

  // ─── Registration form ───────────────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex min-h-dvh flex-col"
      style={{ background: 'var(--background)', color: 'var(--foreground)' }}
    >
      {/* Back button */}
      <div
        className="flex items-center px-4 pt-4"
        style={{ paddingTop: 'max(16px, env(safe-area-inset-top))' }}
      >
        <button
          type="button"
          onClick={() => router.replace('/telegram/welcome')}
          aria-label="Назад"
          className="flex size-9 items-center justify-center rounded-full border active:scale-95 transition-transform"
          style={{
            borderColor: 'color-mix(in oklab, var(--foreground) 14%, transparent)',
            color: 'var(--foreground)',
            background: 'color-mix(in oklab, var(--foreground) 5%, transparent)',
          }}
        >
          <ArrowLeft className="size-4" />
        </button>
      </div>

      <div className="flex-1 space-y-6 px-6 pt-6 pb-[140px]">
        {/* Header */}
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold">{t.title}</h1>
          <p
            className="mx-auto max-w-xs text-[13px]"
            style={{ color: 'color-mix(in oklab, var(--foreground) 60%, transparent)' }}
          >
            {t.subtitle}
          </p>
        </div>

        {/* Role picker */}
        <div className="space-y-1">
          <div
            className="px-1 text-[11px] font-semibold uppercase tracking-wide"
            style={{ color: 'color-mix(in oklab, var(--foreground) 55%, transparent)' }}
          >
            {t.roleLabel}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <RoleTile active={role === 'client'} onClick={() => setRole('client')} icon={UserRound} label={t.roleClient} />
            <RoleTile active={role === 'master'} onClick={() => setRole('master')} icon={Briefcase} label={t.roleMaster} />
            <RoleTile active={role === 'salon_admin'} onClick={() => setRole('salon_admin')} icon={Building2} label={t.roleTeam} />
          </div>
          {role === 'master' && (
            <p className="mt-2 px-1 text-[11px] leading-snug"
              style={{ color: 'color-mix(in oklab, var(--foreground) 55%, transparent)' }}>
              {t.masterHint}
            </p>
          )}
          {role === 'salon_admin' && (
            <p className="mt-2 px-1 text-[11px] leading-snug"
              style={{ color: 'color-mix(in oklab, var(--foreground) 55%, transparent)' }}>
              {t.teamHint}
            </p>
          )}
        </div>

        {/* Fields */}
        <div className="space-y-3">
          {role === 'salon_admin' && (
            <Field icon={Building2} label={t.teamName} value={salonName} onChange={setSalonName}
              placeholder={t.teamNamePlaceholder} />
          )}
          <Field icon={User}
            label={role === 'salon_admin' ? t.firstNameAdmin : t.firstName}
            value={firstName} onChange={setFirstName} />
          <Field icon={User}
            label={role === 'salon_admin' ? t.lastNameAdmin : t.lastName}
            value={lastName} onChange={setLastName} />
          <DobField value={dob} onChange={setDob} label={t.dob} placeholder={t.dobPlaceholder}
            errMonth={t.dobMonthErr} errYear={t.dobYearErr}
            errDay={t.dobDayErr} errFuture={t.dobFutureErr} />
          <Field icon={Phone} label={t.phone} value={phone} onChange={setPhone}
            inputMode="tel" type="tel" />
          <Field icon={Mail} label={t.email} value={email} onChange={setEmail}
            inputMode="email" type="email" />
          <Field icon={Lock} label={t.password} value={password} onChange={setPassword}
            placeholder={t.passwordPlaceholder} type="password" />
        </div>

        {/* Telegram fact */}
        <div
          className="flex items-start gap-3 rounded-2xl border p-4"
          style={{
            borderColor: 'color-mix(in oklab, var(--color-accent) 30%, transparent)',
            background: 'color-mix(in oklab, var(--color-accent) 8%, transparent)',
          }}
        >
          <div
            className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md"
            style={{ background: 'var(--color-accent)' }}
          >
            <Check className="size-3.5" style={{ color: '#fff' }} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold">{t.tgLinked}</p>
            <p className="mt-1 text-[12px] leading-snug"
              style={{ color: 'color-mix(in oklab, var(--foreground) 60%, transparent)' }}>
              {t.tgLinkedSub(tgDisplayName)}
            </p>
          </div>
        </div>

        {/* Error */}
        {errorMsg && (
          <div className="rounded-2xl border p-3 text-sm"
            style={{
              borderColor: 'rgba(244,63,94,0.3)',
              background: 'rgba(244,63,94,0.08)',
              color: '#f43f5e',
            }}>
            {errorMsg}
          </div>
        )}

        {/* Link to sign-in */}
        <p className="text-center text-[13px] pb-2"
          style={{ color: 'color-mix(in oklab, var(--foreground) 55%, transparent)' }}>
          {t.haveAccount}{' '}
          <button type="button" onClick={() => router.replace('/telegram/welcome')}
            className="font-semibold underline underline-offset-2"
            style={{ color: 'var(--foreground)' }}>
            {t.signIn}
          </button>
        </p>
      </div>

      {/* Sticky bottom */}
      <div
        className="fixed inset-x-0 bottom-0 space-y-2 px-6 pb-6 pt-8 transition-opacity duration-200"
        style={{
          opacity: keyboardOpen ? 0 : 1,
          pointerEvents: keyboardOpen ? 'none' : 'auto',
          paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
          background: 'linear-gradient(to top, var(--background) 0%, var(--background) 60%, transparent 100%)',
        }}
      >
        {done ? (
          <div className="flex items-center justify-center gap-2 py-4" style={{ color: '#15803d' }}>
            <Check className="size-5" />
            <span className="text-sm font-semibold">{t.done}</span>
          </div>
        ) : (
          <button
            onClick={submit}
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-[16px] font-semibold active:scale-[0.98] transition-transform disabled:opacity-60"
            style={{
              background: 'var(--primary)',
              color: 'var(--primary-foreground)',
              boxShadow: '0 6px 20px color-mix(in oklab, var(--primary) 32%, transparent)',
            }}
          >
            {submitting ? (
              <><Loader2 className="size-4 animate-spin" /> {t.saving}</>
            ) : (
              <><Send className="size-4" /> {t.createBtn}</>
            )}
          </button>
        )}
        <p className="text-center text-[11px] leading-relaxed"
          style={{ color: 'color-mix(in oklab, var(--foreground) 50%, transparent)' }}>
          {t.terms}{' '}
          <Link href="/telegram/terms" className="underline"
            style={{ textDecorationColor: 'color-mix(in oklab, var(--foreground) 30%, transparent)' }}>
            {t.termsLink}
          </Link>{' '}CRES-CA.
        </p>
      </div>
    </motion.div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────
function RoleTile({
  active, onClick, icon: Icon, label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-1 rounded-2xl border p-3 text-xs font-semibold transition-colors"
      style={
        active
          ? {
              borderColor: 'var(--color-accent)',
              background: 'color-mix(in oklab, var(--color-accent) 14%, transparent)',
              color: 'var(--foreground)',
            }
          : {
              borderColor: 'color-mix(in oklab, var(--foreground) 12%, transparent)',
              background: 'color-mix(in oklab, var(--foreground) 4%, transparent)',
              color: 'color-mix(in oklab, var(--foreground) 65%, transparent)',
            }
      }
    >
      <Icon className="size-4" />
      {label}
    </button>
  );
}

function DobField({
  value, onChange, label, placeholder,
  errMonth, errYear, errDay, errFuture,
}: {
  value: string;
  onChange: (iso: string) => void;
  label: string;
  placeholder: string;
  errMonth: string;
  errYear: (y: number) => string;
  errDay: (d: number, m: string, y: string) => string;
  errFuture: string;
}) {
  const isoToDmy = (iso: string) => {
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? `${m[3]}.${m[2]}.${m[1]}` : '';
  };
  const [text, setText] = useState<string>(isoToDmy(value));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setText(isoToDmy(value)); }, [value]);

  function handleChange(raw: string) {
    const digits = raw.replace(/\D/g, '').slice(0, 8);
    let formatted = digits;
    if (digits.length > 4) formatted = `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`;
    else if (digits.length > 2) formatted = `${digits.slice(0, 2)}.${digits.slice(2)}`;
    setText(formatted);

    if (digits.length === 0) { setError(null); onChange(''); return; }
    const full = formatted.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (!full) { setError(null); onChange(''); return; }

    const [, d, m, y] = full;
    const day = +d, month = +m, year = +y;
    const currentYear = new Date().getFullYear();
    if (month < 1 || month > 12) { setError(errMonth); onChange(''); return; }
    if (year < 1900 || year > currentYear) { setError(errYear(currentYear)); onChange(''); return; }
    const candidate = new Date(year, month - 1, day);
    const valid =
      candidate.getFullYear() === year &&
      candidate.getMonth() === month - 1 &&
      candidate.getDate() === day;
    if (!valid) { setError(errDay(day, m, y)); onChange(''); return; }
    if (candidate.getTime() > Date.now()) { setError(errFuture); onChange(''); return; }
    setError(null);
    onChange(`${y}-${m}-${d}`);
  }

  return (
    <div className="space-y-1">
      <div
        className="flex items-center gap-2 px-1 text-[11px] font-semibold uppercase tracking-wide"
        style={{ color: 'color-mix(in oklab, var(--foreground) 55%, transparent)' }}
      >
        <Calendar className="size-3" /> {label}
      </div>
      <div
        className="rounded-2xl border p-4"
        style={{
          borderColor: error
            ? 'rgba(244,63,94,0.5)'
            : 'color-mix(in oklab, var(--foreground) 12%, transparent)',
          background: 'color-mix(in oklab, var(--foreground) 4%, transparent)',
        }}
      >
        <input
          type="text"
          inputMode="numeric"
          autoComplete="bday"
          placeholder={placeholder}
          value={text}
          onChange={(e) => handleChange(e.target.value)}
          className="w-full bg-transparent text-base outline-none"
          style={{ color: 'var(--foreground)', caretColor: 'var(--color-accent)' }}
        />
      </div>
      {error && <p className="px-1 text-[11px]" style={{ color: '#f43f5e' }}>{error}</p>}
    </div>
  );
}

function Field({
  icon: Icon, label, value, onChange, placeholder, inputMode, type = 'text',
  onFocus, onBlur,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: 'tel' | 'email' | 'text' | 'numeric';
  type?: string;
  onFocus?: () => void;
  onBlur?: () => void;
}) {
  return (
    <div className="space-y-1">
      <div
        className="flex items-center gap-2 px-1 text-[11px] font-semibold uppercase tracking-wide"
        style={{ color: 'color-mix(in oklab, var(--foreground) 55%, transparent)' }}
      >
        <Icon className="size-3" /> {label}
      </div>
      <div
        className="rounded-2xl border p-4"
        style={{
          borderColor: 'color-mix(in oklab, var(--foreground) 12%, transparent)',
          background: 'color-mix(in oklab, var(--foreground) 4%, transparent)',
        }}
      >
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onFocus}
          onBlur={onBlur}
          placeholder={placeholder}
          inputMode={inputMode}
          type={type}
          className="w-full bg-transparent text-base outline-none"
          style={{ color: 'var(--foreground)', caretColor: 'var(--color-accent)' }}
        />
      </div>
    </div>
  );
}
