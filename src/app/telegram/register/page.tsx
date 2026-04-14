/** --- YAML
 * name: MiniAppRegisterPage
 * description: Manual registration form — last/first/middle name, phone, email, optional DoB. Opt-in checkbox at bottom to link Telegram ID + username.
 * created: 2026-04-13
 * updated: 2026-04-13
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { User, Phone, Mail, Calendar, Loader2, Check, Send, UserRound, Briefcase, Lock } from 'lucide-react';
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

  const [role, setRole] = useState<'client' | 'master'>('client');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [dob, setDob] = useState('');
  const [linkTelegram, setLinkTelegram] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Email OTP verification state
  const [otpStage, setOtpStage] = useState<'form' | 'otp'>('form');
  const [otpCode, setOtpCode] = useState('');
  const [otpBusy, setOtpBusy] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [pendingRoute, setPendingRoute] = useState<string | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem('cres:tg');
    if (!raw) {
      router.replace('/telegram');
      return;
    }
    const s = JSON.parse(raw) as Stash;
    setStash(s);
    // Prefill name from Telegram if present — user can edit.
    if (s.tgData?.first_name) setFirstName(s.tgData.first_name);
    if (s.tgData?.last_name) setLastName(s.tgData.last_name);
  }, [router]);

  function normalizePhone(value: string): string | null {
    const digits = value.replace(/\D/g, '');
    if (digits.length < 9 || digits.length > 15) return null;
    return '+' + digits;
  }

  function validate(): string | null {
    if (!firstName.trim()) return mapError('missing_name');
    if (!lastName.trim()) return mapError('missing_name');
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

    const fullName = [lastName.trim(), firstName.trim(), middleName.trim()]
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
          middleName: middleName.trim() || null,
          fullNameOverride: fullName,
          phone: normalizedPhone,
          email: email.trim(),
          password,
          dateOfBirth: dob || null,
          linkTelegram,
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
        data.role === 'master'
          ? '/telegram/m/home'
          : stash.startParam?.startsWith('master_')
            ? `/telegram/home?master=${stash.startParam.replace('master_', '')}`
            : '/telegram/home';
      setPendingRoute(target);

      // Email is required — always send OTP and block until verified
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
    return <div className="min-h-dvh bg-[#1f2023]" />;
  }

  if (otpStage === 'otp') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex min-h-dvh flex-col bg-[#1f2023] text-white"
      >
        <div className="flex-1 space-y-6 px-6 pt-16">
          <div className="space-y-3 text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-violet-500/20">
              <Mail className="size-6 text-violet-200" />
            </div>
            <h1 className="text-2xl font-bold">Подтверждение email</h1>
            <p className="mx-auto max-w-xs text-[13px] leading-relaxed text-white/60">
              Мы отправили 8-значный код на <span className="font-semibold text-white">{email}</span>. Введите его ниже.
            </p>
          </div>

          <div className="mx-auto max-w-xs">
            <input
              autoFocus
              inputMode="numeric"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
              placeholder="• • • • • • • •"
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-5 text-center font-mono text-2xl tracking-[0.3em] outline-none focus:border-white/30"
            />
          </div>

          {otpError && <p className="text-center text-xs text-rose-300">{otpError}</p>}

          <div className="mx-auto max-w-xs space-y-2">
            <button
              onClick={verifyOtp}
              disabled={otpBusy || otpCode.length !== 8}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-4 text-[15px] font-semibold text-black active:scale-[0.98] transition-transform disabled:opacity-60"
            >
              {otpBusy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              Подтвердить
            </button>
            <button
              onClick={resendOtp}
              className="w-full py-2 text-xs text-white/50 underline-offset-2 hover:underline"
            >
              Отправить код ещё раз
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  const tgHandle = stash.tgData?.username;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex min-h-dvh flex-col bg-[#1f2023] text-white"
    >
      <div className="flex-1 space-y-6 px-6 pt-10 pb-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold">Регистрация</h1>
          <p className="mx-auto max-w-xs text-[13px] text-white/55">
            Заполните, пожалуйста, несколько полей — это займёт меньше минуты.
          </p>
        </div>

        {/* Role picker — client vs master */}
        <div className="space-y-1">
          <div className="px-1 text-[11px] font-semibold uppercase tracking-wide text-white/50">
            Я регистрируюсь как
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setRole('client')}
              className={`flex items-center justify-center gap-2 rounded-2xl border p-4 text-sm font-semibold transition-colors ${
                role === 'client'
                  ? 'border-violet-400 bg-violet-500/20 text-white'
                  : 'border-white/10 bg-white/5 text-white/60'
              }`}
            >
              <UserRound className="size-4" />
              Клиент
            </button>
            <button
              type="button"
              onClick={() => setRole('master')}
              className={`flex items-center justify-center gap-2 rounded-2xl border p-4 text-sm font-semibold transition-colors ${
                role === 'master'
                  ? 'border-violet-400 bg-violet-500/20 text-white'
                  : 'border-white/10 bg-white/5 text-white/60'
              }`}
            >
              <Briefcase className="size-4" />
              Мастер
            </button>
          </div>
          {role === 'master' && (
            <p className="mt-2 px-1 text-[11px] leading-snug text-white/45">
              Вы получите Mini App мастера с календарём, клиентами и финансами. Настроить услуги и график можно будет сразу после регистрации.
            </p>
          )}
        </div>

        <div className="space-y-3">
          <Field icon={User} label="Фамилия" value={lastName} onChange={setLastName} placeholder="Иванов" />
          <Field icon={User} label="Имя" value={firstName} onChange={setFirstName} placeholder="Иван" />
          <Field icon={User} label="Отчество" value={middleName} onChange={setMiddleName} placeholder="Иванович" optional />
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
          <div className="space-y-1">
            <div className="flex items-center gap-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-white/50">
              <Calendar className="size-3" /> Дата рождения <span className="normal-case text-white/30">· необязательно</span>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <input
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                max={new Date().toISOString().slice(0, 10)}
                className="w-full bg-transparent text-base outline-none [color-scheme:dark]"
              />
            </div>
          </div>
        </div>

        {/* Telegram opt-in */}
        <button
          type="button"
          onClick={() => setLinkTelegram((v) => !v)}
          className="flex w-full items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-left active:scale-[0.99] transition-transform"
        >
          <div
            className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
              linkTelegram ? 'border-violet-400 bg-violet-500' : 'border-white/30 bg-transparent'
            }`}
          >
            {linkTelegram && <Check className="size-3.5" />}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold">Привязать Telegram</p>
            <p className="mt-1 text-[12px] leading-snug text-white/55">
              Разрешаю сохранить мой Telegram ID{tgHandle ? ` и @${tgHandle}` : ''} для входа и связи с мастерами.
              Больше никакие данные из Telegram не копируются.
            </p>
          </div>
        </button>

        {errorMsg && (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
            {errorMsg}
          </div>
        )}
      </div>

      <div
        className="sticky bottom-0 space-y-2 bg-gradient-to-t from-[#1f2023] via-[#1f2023] to-transparent px-6 pb-6 pt-8"
        style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}
      >
        {done ? (
          <div className="flex items-center justify-center gap-2 py-4 text-emerald-300">
            <Check className="size-5" /> <span className="text-sm font-semibold">Готово — открываем CRES-CA</span>
          </div>
        ) : (
          <button
            onClick={submit}
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-4 text-[15px] font-semibold text-black active:scale-[0.98] transition-transform disabled:opacity-60"
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
        <p className="text-center text-[11px] leading-relaxed text-white/40">
          Продолжая, вы принимаете{' '}
          <a href="/telegram/terms" className="underline decoration-white/30">
            Условия использования
          </a>{' '}
          CRES-CA.
        </p>
      </div>
    </motion.div>
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
  optional,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: 'tel' | 'email' | 'text' | 'numeric';
  type?: string;
  optional?: boolean;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-white/50">
        <Icon className="size-3" /> {label}
        {optional && <span className="normal-case text-white/30">· необязательно</span>}
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          inputMode={inputMode}
          type={type}
          className="w-full bg-transparent text-base outline-none placeholder:text-white/25"
        />
      </div>
    </div>
  );
}
