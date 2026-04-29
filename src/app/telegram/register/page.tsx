/** --- YAML
 * name: MiniAppRegisterPage
 * description: Manual registration form в Mini App. Поля: роль (клиент/мастер/команда), Имя+Фамилия (для команды — Имя/Фамилия владельца + Название команды), Телефон (обязательно), Email, Пароль, ДР (опц). Telegram привязывается автоматически — показано как готовый факт. Реагирует на тёмную/светлую тему. Sticky bottom скрывается когда юзер набирает в инпуте.
 * created: 2026-04-13
 * updated: 2026-04-29
 * --- */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { User, Phone, Mail, Calendar, Loader2, Check, Send, UserRound, Briefcase, Building2, Lock, ArrowLeft } from 'lucide-react';
import { mapError } from '@/lib/errors';
import { useAuthStore } from '@/stores/auth-store';

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

export default function MiniAppRegisterPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [stash, setStash] = useState<Stash | null>(null);

  const [role, setRole] = useState<'client' | 'master' | 'salon_admin'>('client');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [salonName, setSalonName] = useState('');
  const [phone, setPhone] = useState('');
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

  // Когда юзер начинает печатать в любом инпуте — прячем нижнюю sticky-панель
  // (кнопка «Создать аккаунт» + текст про условия), чтобы не залезала на клаву.
  const [inputFocused, setInputFocused] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem('cres:tg');
    if (!raw) {
      router.replace('/telegram');
      return;
    }
    const s = JSON.parse(raw) as Stash;
    setStash(s);
    if (s.tgData?.first_name) setFirstName(s.tgData.first_name);
    if (s.tgData?.last_name) setLastName(s.tgData.last_name);
  }, [router]);

  // Глобальный focus/blur listener — на любых input/textarea внутри страницы
  // прячем sticky bottom. Безопасно для DateWheelPicker (он не текстовый input).
  useEffect(() => {
    function isTextInput(el: EventTarget | null) {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA';
    }
    function onFocus(e: FocusEvent) {
      if (isTextInput(e.target)) setInputFocused(true);
    }
    function onBlur(e: FocusEvent) {
      if (isTextInput(e.target)) setInputFocused(false);
    }
    document.addEventListener('focusin', onFocus);
    document.addEventListener('focusout', onBlur);
    return () => {
      document.removeEventListener('focusin', onFocus);
      document.removeEventListener('focusout', onBlur);
    };
  }, []);

  function normalizePhone(value: string): string | null {
    const digits = value.replace(/\D/g, '');
    if (digits.length < 9 || digits.length > 15) return null;
    return '+' + digits;
  }

  function validate(): string | null {
    if (role === 'salon_admin') {
      if (!salonName.trim()) return mapError('missing_salon_name');
    }
    if (!firstName.trim()) return mapError('missing_name');
    if (!lastName.trim()) return mapError('missing_name');
    if (!dob) return 'Введите дату рождения';
    if (!normalizePhone(phone)) return mapError('invalid_phone');
    if (!email.trim()) return mapError('missing_email');
    if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email.trim())) return mapError('invalid_email');
    if (password.length < 8) return mapError('weak_password');
    return null;
  }

  async function submit() {
    if (!stash) return;
    const validationError = validate();
    if (validationError) {
      setErrorMsg(validationError);
      return;
    }
    setErrorMsg(null);
    setSubmitting(true);

    const personalFullName = [lastName.trim(), firstName.trim()]
      .filter(Boolean)
      .join(' ');
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
      if (!res.ok) {
        setErrorMsg(mapError(data.error));
        setSubmitting(false);
        return;
      }
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
        body: JSON.stringify({ email: email.trim(), locale: 'ru' }),
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
      if (!res.ok) {
        setOtpError(mapError(data.error, 'Ошибка проверки'));
        setOtpBusy(false);
        return;
      }
      setDone(true);
      setTimeout(() => {
        if (pendingRoute) router.replace(pendingRoute);
      }, 500);
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
        body: JSON.stringify({ email: email.trim(), locale: 'ru' }),
      });
    } catch {}
  }

  if (!stash) {
    return <div className="min-h-dvh" style={{ background: 'var(--background)' }} />;
  }

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
            <h1 className="text-2xl font-bold">Подтверждение email</h1>
            <p
              className="mx-auto max-w-xs text-[13px] leading-relaxed"
              style={{ color: 'color-mix(in oklab, var(--foreground) 65%, transparent)' }}
            >
              Мы отправили 8-значный код на <span className="font-semibold" style={{ color: 'var(--foreground)' }}>{email}</span>. Введите его ниже.
            </p>
          </div>

          <div className="mx-auto max-w-xs">
            <input
              autoFocus
              inputMode="numeric"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
              placeholder="• • • • • • • •"
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
              style={{
                background: 'var(--primary)',
                color: 'var(--primary-foreground)',
              }}
            >
              {otpBusy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              Подтвердить
            </button>
            <button
              onClick={resendOtp}
              className="w-full py-2 text-xs underline-offset-2 hover:underline"
              style={{ color: 'color-mix(in oklab, var(--foreground) 55%, transparent)' }}
            >
              Отправить код ещё раз
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  const tgHandle = stash.tgData?.username;
  const tgFirstName = stash.tgData?.first_name;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex min-h-dvh flex-col"
      style={{ background: 'var(--background)', color: 'var(--foreground)' }}
    >
      {/* Кнопка «назад» — в верхнем левом углу */}
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
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold">Регистрация</h1>
          <p
            className="mx-auto max-w-xs text-[13px]"
            style={{ color: 'color-mix(in oklab, var(--foreground) 60%, transparent)' }}
          >
            Заполните, пожалуйста, несколько полей — это займёт меньше минуты.
          </p>
        </div>

        {/* Role picker — client / master / salon */}
        <div className="space-y-1">
          <div
            className="px-1 text-[11px] font-semibold uppercase tracking-wide"
            style={{ color: 'color-mix(in oklab, var(--foreground) 55%, transparent)' }}
          >
            Я регистрируюсь как
          </div>
          <div className="grid grid-cols-3 gap-2">
            <RoleTile active={role === 'client'} onClick={() => setRole('client')} icon={UserRound} label="Клиент" />
            <RoleTile active={role === 'master'} onClick={() => setRole('master')} icon={Briefcase} label="Мастер" />
            <RoleTile active={role === 'salon_admin'} onClick={() => setRole('salon_admin')} icon={Building2} label="Команда" />
          </div>
          {role === 'master' && (
            <p
              className="mt-2 px-1 text-[11px] leading-snug"
              style={{ color: 'color-mix(in oklab, var(--foreground) 55%, transparent)' }}
            >
              Вы получите Mini App мастера с календарём, клиентами и финансами. Настроить услуги и график можно будет сразу после регистрации.
            </p>
          )}
          {role === 'salon_admin' && (
            <p
              className="mt-2 px-1 text-[11px] leading-snug"
              style={{ color: 'color-mix(in oklab, var(--foreground) 55%, transparent)' }}
            >
              Команде — мультимастерский календарь, состав, смены и отчёты. Услуги и людей добавите после регистрации. Подходит для любой сферы услуг.
            </p>
          )}
        </div>

        <div className="space-y-3">
          {role === 'salon_admin' && (
            <Field
              icon={Building2}
              label="Название команды"
              value={salonName}
              onChange={setSalonName}
              placeholder="Например: Studio 54, AutoPro, Dr. Smile..."
            />
          )}
          <Field
            icon={User}
            label={role === 'salon_admin' ? 'Имя администратора' : 'Имя'}
            value={firstName}
            onChange={setFirstName}
            placeholder="Иван"
          />
          <Field
            icon={User}
            label={role === 'salon_admin' ? 'Фамилия администратора' : 'Фамилия'}
            value={lastName}
            onChange={setLastName}
            placeholder="Иванов"
          />
          <DobField value={dob} onChange={setDob} />
          <Field
            icon={Phone}
            label="Телефон"
            value={phone}
            onChange={setPhone}
            placeholder="+380 ..."
            inputMode="tel"
            type="tel"
          />
          <Field
            icon={Mail}
            label="Email"
            value={email}
            onChange={setEmail}
            placeholder="you@example.com"
            inputMode="email"
            type="email"
          />
          <Field
            icon={Lock}
            label="Пароль"
            value={password}
            onChange={setPassword}
            placeholder="минимум 8 символов"
            type="password"
          />
        </div>

        {/* Telegram — констатация факта, не выбор */}
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
            <p className="text-sm font-semibold">Telegram привязан</p>
            <p
              className="mt-1 text-[12px] leading-snug"
              style={{ color: 'color-mix(in oklab, var(--foreground) 60%, transparent)' }}
            >
              {tgHandle ? `@${tgHandle}` : (tgFirstName ?? 'Ваш аккаунт')} — для входа без пароля и для уведомлений.
            </p>
          </div>
        </div>

        {errorMsg && (
          <div
            className="rounded-2xl border p-3 text-sm"
            style={{
              borderColor: 'rgba(244,63,94,0.3)',
              background: 'rgba(244,63,94,0.08)',
              color: '#f43f5e',
            }}
          >
            {errorMsg}
          </div>
        )}

        {/* Ссылка на вход — для тех у кого аккаунт уже есть */}
        <p
          className="text-center text-[13px] pb-2"
          style={{ color: 'color-mix(in oklab, var(--foreground) 55%, transparent)' }}
        >
          Уже есть аккаунт?{' '}
          <button
            type="button"
            onClick={() => router.replace('/telegram/welcome')}
            className="font-semibold underline underline-offset-2"
            style={{ color: 'var(--foreground)' }}
          >
            Войти
          </button>
        </p>
      </div>

      {/* Sticky bottom — прячется когда юзер фокусится на инпуте */}
      <div
        className="fixed inset-x-0 bottom-0 space-y-2 px-6 pb-6 pt-8 transition-opacity duration-200"
        style={{
          opacity: inputFocused ? 0 : 1,
          pointerEvents: inputFocused ? 'none' : 'auto',
          paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
          background: 'linear-gradient(to top, var(--background) 0%, var(--background) 60%, transparent 100%)',
        }}
      >
        {done ? (
          <div className="flex items-center justify-center gap-2 py-4" style={{ color: '#15803d' }}>
            <Check className="size-5" /> <span className="text-sm font-semibold">Готово — открываем CRES-CA</span>
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
              <>
                <Loader2 className="size-4 animate-spin" /> Сохраняем…
              </>
            ) : (
              <>
                <Send className="size-4" /> Создать аккаунт
              </>
            )}
          </button>
        )}
        <p
          className="text-center text-[11px] leading-relaxed"
          style={{ color: 'color-mix(in oklab, var(--foreground) 50%, transparent)' }}
        >
          Продолжая, вы принимаете{' '}
          <Link
            href="/telegram/terms"
            className="underline"
            style={{ textDecorationColor: 'color-mix(in oklab, var(--foreground) 30%, transparent)' }}
          >
            Условия использования
          </Link>{' '}
          CRES-CA.
        </p>
      </div>
    </motion.div>
  );
}

function RoleTile({
  active,
  onClick,
  icon: Icon,
  label,
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

function DobField({ value, onChange }: { value: string; onChange: (iso: string) => void }) {
  // ДР как обычный текстовый инпут «ДД.ММ.ГГГГ» — без колеса, надёжно работает
  // на любой теме. На лету собирает точки между цифрами и валидирует диапазон.
  const isoToDmy = (iso: string) => {
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? `${m[3]}.${m[2]}.${m[1]}` : '';
  };
  const [text, setText] = useState<string>(isoToDmy(value));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setText(isoToDmy(value));
  }, [value]);

  function handleChange(raw: string) {
    const digits = raw.replace(/\D/g, '').slice(0, 8);
    let formatted = digits;
    if (digits.length > 4) formatted = `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`;
    else if (digits.length > 2) formatted = `${digits.slice(0, 2)}.${digits.slice(2)}`;
    setText(formatted);

    if (digits.length === 0) {
      setError(null);
      onChange('');
      return;
    }
    const full = formatted.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (!full) {
      setError(null);
      onChange('');
      return;
    }
    const [, d, m, y] = full;
    const day = +d, month = +m, year = +y;
    const currentYear = new Date().getFullYear();
    if (month < 1 || month > 12) { setError('Месяц от 01 до 12'); onChange(''); return; }
    if (year < 1900 || year > currentYear) { setError(`Год от 1900 до ${currentYear}`); onChange(''); return; }
    const candidate = new Date(year, month - 1, day);
    const valid =
      candidate.getFullYear() === year &&
      candidate.getMonth() === month - 1 &&
      candidate.getDate() === day;
    if (!valid) { setError(`В ${m}.${y} нет ${day}-го числа`); onChange(''); return; }
    if (candidate.getTime() > Date.now()) { setError('Дата в будущем'); onChange(''); return; }
    setError(null);
    onChange(`${y}-${m}-${d}`);
  }

  return (
    <div className="space-y-1">
      <div
        className="flex items-center gap-2 px-1 text-[11px] font-semibold uppercase tracking-wide"
        style={{ color: 'color-mix(in oklab, var(--foreground) 55%, transparent)' }}
      >
        <Calendar className="size-3" /> Дата рождения
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
          placeholder="ДД.ММ.ГГГГ"
          value={text}
          onChange={(e) => handleChange(e.target.value)}
          className="w-full bg-transparent text-base outline-none"
          style={{
            color: 'var(--foreground)',
            caretColor: 'var(--color-accent)',
          }}
        />
      </div>
      {error && (
        <p className="px-1 text-[11px]" style={{ color: '#f43f5e' }}>{error}</p>
      )}
    </div>
  );
}

function Field({
  icon: Icon,
  label,
  value,
  onChange,
  placeholder,
  inputMode,
  type = 'text',
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: 'tel' | 'email' | 'text' | 'numeric';
  type?: string;
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
          placeholder={placeholder}
          inputMode={inputMode}
          type={type}
          className="w-full bg-transparent text-base outline-none"
          style={{
            color: 'var(--foreground)',
            caretColor: 'var(--color-accent)',
          }}
        />
      </div>
    </div>
  );
}
