/** --- YAML
 * name: Auth Page (unified login + register, glass split-layout)
 * description: 2-column auth page (form + hero image). 3 role toggles (Клиент / Мастер / Команда), glass inputs, Supabase email+password auth + OTP signup + reset-password flow + remember-me (saves email and password to localStorage).
 * created: 2026-04-15
 * updated: 2026-04-29
 * --- */

'use client';

import { useState, useEffect, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { REGEXP_ONLY_DIGITS } from 'input-otp';
import { createClient } from '@/lib/supabase/client';
import {
  InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator,
} from '@/components/ui/input-otp';
import {
  ArrowLeft, Eye, EyeOff, Mail, Shield,
  CalendarCheck, User as UserIcon, Building2,
} from 'lucide-react';
import { humanizeError } from '@/lib/format/error';
import { isDisposableEmail } from '@/lib/format/email-validator';

type Role = 'client' | 'master' | 'salon_admin';
type Mode = 'signin' | 'signup';
type Sub = 'form' | 'forgot' | 'reset-sent' | 'reset-otp' | 'new-password' | 'signup-otp' | '2fa' | 'restore';

const REMEMBER_KEY = 'cres-ca-remember';
// Нейтральная teal-tinted Unsplash для нового бренда (deep teal var(--color-accent))
const HERO_IMG = 'https://images.unsplash.com/photo-1604933762023-7213af7ff7a7?w=2160&q=80';

/* ───── Themed CSS — glass inputs + teal accent (m0038 rebrand) ───── */
const AUTH_CSS = `
.auth-glass {
  --af: var(--font-sans, 'Plus Jakarta Sans', sans-serif);
  --abg: var(--background, #ffffff);
  --acard: color-mix(in oklab, var(--abg) 92%, white);
  --afg: var(--foreground, #0a0a0a);
  --afg2: color-mix(in oklab, var(--afg) 65%, transparent);
  --afg3: color-mix(in oklab, var(--afg) 45%, transparent);
  --acb: color-mix(in oklab, var(--afg) 12%, transparent);
  --aviolet: var(--color-accent); --aviolet-l: #f0fdfa;
  --adanger: #b91c1c;
  font-family: var(--af);
  background: var(--abg);
  color: var(--afg);
  -webkit-font-smoothing: antialiased;
  min-height: 100dvh;
  width: 100%;
}
html.dark .auth-glass {
  --acard: color-mix(in oklab, var(--abg) 88%, white);
  --aviolet: #2dd4bf; --aviolet-l: rgba(45,212,191,.12);
  --adanger: #f87171;
}
.auth-glass input, .auth-glass button, .auth-glass select { font-family: var(--af); }
.auth-glass a { color: inherit; text-decoration: none; }
.glass-wrap {
  border-radius: 14px;
  border: 1px solid var(--acb);
  background: color-mix(in oklab, var(--afg) 5%, transparent);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  transition: border-color .15s ease, background .15s ease, box-shadow .15s ease;
}
.glass-wrap:hover { border-color: color-mix(in oklab, var(--aviolet) 35%, var(--acb)); }
.glass-wrap:focus-within {
  border-color: color-mix(in oklab, var(--aviolet) 70%, transparent);
  background: color-mix(in oklab, var(--aviolet) 10%, transparent);
  box-shadow: 0 0 0 3px color-mix(in oklab, var(--aviolet) 18%, transparent);
}
.glass-input {
  width: 100%; height: 46px; padding: 0 16px;
  border: none; outline: none; background: transparent;
  color: var(--afg); font-size: 14px;
  border-radius: 14px;
}
.glass-input::placeholder { color: var(--afg3); }
.auth-label { font-size: 12px; font-weight: 600; color: var(--afg2); display: block; margin-bottom: 6px; letter-spacing: .01em; }
input[type="checkbox"].auth-cb { accent-color: var(--aviolet); width: 14px; height: 14px; cursor: pointer; }
@keyframes auth-glow { 0%,100%{opacity:.45} 50%{opacity:.85} }

/* Role tabs — стили через CSS-селектор по data-active. Раньше использовали
   инлайн-стили, но в React 19 + framer-motion AnimatePresence обнаружился
   баг: реконсиляция ставила правильные props, но не флашила inline style
   в DOM. CSS-селектор автоматически реагирует на смену data-active. */
.role-tab {
  display: flex; align-items: center; justify-content: center; gap: 6px;
  padding: 9px 6px; border-radius: 10px; border: none; cursor: pointer;
  background: transparent; color: var(--afg2);
  font-size: 13px; font-weight: 600;
  box-shadow: none;
  transition: background .18s ease, color .18s ease, box-shadow .18s ease;
  outline: none;
}
.role-tab[data-active="true"] {
  background: var(--aviolet);
  color: #fff;
  box-shadow: 0 4px 14px color-mix(in oklab, var(--aviolet) 35%, transparent);
}
`;

const ROLES: { value: Role; label: string; icon: typeof UserIcon }[] = [
  { value: 'client',      label: 'Клиент',   icon: CalendarCheck },
  { value: 'master',      label: 'Мастер',   icon: UserIcon },
  { value: 'salon_admin', label: 'Команда',  icon: Building2 },
];

function readRemembered(): { email?: string; password?: string; role?: Role } {
  if (typeof window === 'undefined') return {};
  try {
    const saved = window.localStorage.getItem(REMEMBER_KEY);
    if (!saved) return {};
    const p = JSON.parse(saved) as { email?: string; password?: string; role?: string };
    const role = p.role && ['client','master','salon_admin'].includes(p.role) ? (p.role as Role) : undefined;
    return { email: p.email, password: p.password, role };
  } catch { return {}; }
}

export default function AuthPage() {
  const router = useRouter();
  const locale = useLocale();
  const sp = useSearchParams();
  const urlMode = sp.get('mode');
  const urlRole = sp.get('role') as Role | null;
  const urlEmail = sp.get('email') || '';
  const urlError = sp.get('error');

  const [role, setRole] = useState<Role>(() => {
    if (urlRole && ['client','master','salon_admin'].includes(urlRole)) return urlRole;
    return readRemembered().role ?? 'client';
  });
  const [mode, setMode] = useState<Mode>(urlMode === 'signup' ? 'signup' : 'signin');
  const [sub, setSub] = useState<Sub>('form');
  const [loading, setLoading] = useState(false);

  // Показываем тост если callback вернул ?error=auth (общий случай ошибки входа).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const e = params.get('error');
    if (e !== 'auth') return;
    const id = window.setTimeout(() => {
      toast.error('Не удалось войти. Попробуй ещё раз.', { duration: 7000 });
    }, 100);
    return () => window.clearTimeout(id);
  }, []);

  // Синхронизируем role с URL — иначе первый рендер с null'овым urlRole кэширует
  // 'client' в useState, а потом приходит ?role=master но state не меняется.
  useEffect(() => {
    if (urlRole && ['client', 'master', 'salon_admin'].includes(urlRole) && urlRole !== role) {
      setRole(urlRole);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlRole]);

  // То же для mode
  useEffect(() => {
    if (urlMode === 'signup' && mode !== 'signup') setMode('signup');
    if (urlMode === 'signin' && mode !== 'signin') setMode('signin');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlMode]);

  const remembered = readRemembered();
  const [email, setEmail] = useState(() => urlEmail || remembered.email || '');
  const [rememberMe, setRememberMe] = useState(true);
  const [password, setPassword] = useState(() => remembered.password || '');
  const [showPwd, setShowPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [salonName, setSalonName] = useState('');
  const [phone, setPhone] = useState('+380 ');
  const [dob, setDob] = useState('');
  const [terms, setTerms] = useState(false);

  const [otp, setOtp] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [twoFaCode, setTwoFaCode] = useState('');
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [pendingActualRole, setPendingActualRole] = useState<string | null>(null);
  // Сколько секунд осталось до возможности повторно отправить код. Стартует
  // с 60 при попадании на signup-otp / reset-otp, тикает каждую секунду.
  const [resendIn, setResendIn] = useState(0);
  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setTimeout(() => setResendIn((v) => Math.max(0, v - 1)), 1000);
    return () => clearTimeout(id);
  }, [resendIn]);
  useEffect(() => {
    if (sub === 'signup-otp' || sub === 'reset-otp') setResendIn(60);
    else setResendIn(0);
  }, [sub]);

  async function routeAfterAuth(actualRole: string) {
    if (actualRole === 'client') {
      try {
        const res = await fetch('/api/invite/claim', { method: 'POST' });
        const body = (await res.json()) as { master_id?: string };
        if (body.master_id) { router.push(`/masters/${body.master_id}`); return; }
      } catch {}
      router.push('/feed');
      return;
    }
    // Админ команды → сразу на свой /salon/{id}/dashboard, иначе обычный мастер → /calendar
    if (actualRole === 'salon_admin') {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: salon } = await supabase
            .from('salons')
            .select('id')
            .eq('owner_id', user.id)
            .limit(1)
            .maybeSingle();
          if (salon?.id) { router.push(`/salon/${salon.id}/dashboard`); return; }
        }
      } catch {}
      // Если салон ещё не создан — вернёмся к онбордингу
      router.push('/onboarding/account-type');
      return;
    }
    router.push('/calendar');
  }

  /* ───── sign-in ───── */
  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    try {
      if (rememberMe) localStorage.setItem(REMEMBER_KEY, JSON.stringify({ email, password, role }));
      else localStorage.removeItem(REMEMBER_KEY);
    } catch {}
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setLoading(false); toast.error(humanizeError(error)); return; }
    const user = data.user;
    if (!user) { setLoading(false); toast.error('Ошибка входа'); return; }

    const { data: profile } = await supabase.from('profiles')
      .select('role, tg_2fa_enabled, deleted_at')
      .eq('id', user.id)
      .single();
    const actualRole = profile?.role ?? 'client';
    const twoFa = (profile as { tg_2fa_enabled?: boolean } | null)?.tg_2fa_enabled ?? false;
    const deletedAt = (profile as { deleted_at?: string | null } | null)?.deleted_at ?? null;

    setPendingUserId(user.id);
    setPendingActualRole(actualRole);

    if (deletedAt) {
      setLoading(false);
      setSub('restore');
      return;
    }

    if (twoFa) {
      const res = await fetch('/api/auth/2fa/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile_id: user.id }),
      });
      setLoading(false);
      if (!res.ok) {
        toast.error('Не удалось отправить 2FA-код. Войдите снова.');
        await supabase.auth.signOut();
        return;
      }
      setSub('2fa');
      toast.success('Код отправлен в Telegram');
      return;
    }

    setLoading(false);
    await routeAfterAuth(actualRole);
  }

  async function handle2faSubmit() {
    if (twoFaCode.length !== 6 || !pendingUserId) return;
    setLoading(true);
    const res = await fetch('/api/auth/2fa/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile_id: pendingUserId, code: twoFaCode }),
    });
    if (!res.ok) {
      setLoading(false);
      const { error } = await res.json().catch(() => ({ error: 'invalid' }));
      toast.error(error === 'expired' ? 'Код истёк' : 'Неверный код');
      setTwoFaCode('');
      return;
    }
    setLoading(false);
    const actualRole = pendingActualRole ?? 'client';
    setTwoFaCode('');
    setPendingUserId(null);
    setPendingActualRole(null);
    await routeAfterAuth(actualRole);
  }

  async function handle2faCancel() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setSub('form');
    setTwoFaCode('');
    setPendingUserId(null);
    setPendingActualRole(null);
    setPassword('');
  }

  async function handleRestoreConfirm() {
    setLoading(true);
    const res = await fetch('/api/account/restore', { method: 'POST' });
    if (!res.ok) {
      setLoading(false);
      toast.error('Не удалось восстановить аккаунт');
      return;
    }
    toast.success('Аккаунт восстановлен');
    const actualRole = pendingActualRole ?? 'client';
    setPendingUserId(null);
    setPendingActualRole(null);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      setSub('form');
      return;
    }
    const profileRes = await supabase.from('profiles').select('tg_2fa_enabled').eq('id', user.id).single();
    const twoFa = (profileRes.data as { tg_2fa_enabled?: boolean } | null)?.tg_2fa_enabled ?? false;

    if (twoFa) {
      const sendRes = await fetch('/api/auth/2fa/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile_id: user.id }),
      });
      setLoading(false);
      if (!sendRes.ok) {
        toast.error('Не удалось отправить 2FA-код');
        await supabase.auth.signOut();
        setSub('form');
        return;
      }
      setPendingUserId(user.id);
      setPendingActualRole(actualRole);
      setSub('2fa');
      return;
    }
    setLoading(false);
    await routeAfterAuth(actualRole);
  }

  async function handleRestoreCancel() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setSub('form');
    setPendingUserId(null);
    setPendingActualRole(null);
    setPassword('');
    toast.info('Вход отменён. Аккаунт по-прежнему помечен на удаление.');
  }

  /* ───── sign-up ───── */
  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) { toast.error('Пароль — минимум 8 символов'); return; }
    if (!terms) { toast.error('Примите условия использования'); return; }
    if (role === 'salon_admin' && !salonName.trim()) {
      toast.error('Укажите название команды');
      return;
    }
    if (isDisposableEmail(email)) {
      toast.error('Используйте проверенную почту (Gmail, Outlook и т.п.). Регистрация с временной почтой нарушает наши условия использования.');
      return;
    }

    // Телефон обязательный. Нормализуем: «+380...», «380...», «0501234567» → «+...».
    const normalizedPhone = (() => {
      const trimmed = phone.trim();
      if (!trimmed) return null;
      const digits = trimmed.replace(/\D/g, '');
      if (digits.length < 9 || digits.length > 15) return null;
      if (digits.startsWith('0') && digits.length === 10) return '+380' + digits.slice(1);
      return '+' + digits;
    })();
    if (!normalizedPhone) {
      toast.error('Введите телефон в международном формате');
      return;
    }

    setLoading(true);

    // ── Бета-гейт: проверяем разрешение до supabase.auth.signUp ──
    try {
      const gateRes = await fetch('/api/auth/check-signup-allowed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const gate = await gateRes.json().catch(() => ({}));
      if (!gate?.allowed) {
        setLoading(false);
        const localeForRedirect = (typeof window !== 'undefined' && window.location.pathname.match(/^\/(ru|en|uk)\b/)?.[1]) || 'ru';
        router.push(`/${localeForRedirect}/beta-closed`);
        return;
      }
    } catch (e) {
      // Сетевая ошибка — fail-closed, не пускаем
      console.error('[signup] gate check failed:', e);
      setLoading(false);
      toast.error('Не удалось проверить доступ. Попробуйте ещё раз.');
      return;
    }

    const supabase = createClient();
    const personalFullName = [lastName.trim(), firstName.trim()]
      .filter(Boolean)
      .join(' ');
    const fullName = role === 'salon_admin' && salonName.trim()
      ? salonName.trim()
      : (personalFullName || firstName);

    const locale = (typeof window !== 'undefined' && window.location.pathname.match(/^\/(ru|en|uk)\b/)?.[1]) || 'ru';
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: {
        data: {
          full_name: fullName,
          role,
          first_name: firstName || undefined,
          last_name: lastName || undefined,
          salon_name: role === 'salon_admin' ? salonName.trim() : undefined,
          phone: normalizedPhone,
          date_of_birth: dob || undefined,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          locale,
        },
      },
    });
    setLoading(false);

    if (error) { toast.error(humanizeError(error)); return; }
    // Не выбрасываем на signin при «возможно email существует» (новый Supabase
    // намеренно возвращает identities=[] для всех чтобы блокировать enumeration —
    // эта проверка давала false-positive и кидала пользователя на «Войти»).
    // Если email реально занят — verifyOtp вернёт ошибку и покажет нормальный
    // тост, а до этого пользователь видит экран ввода кода как и должен.
    void data;
    setSub('signup-otp');
  }

  async function handleVerifySignupOTP() {
    if (otp.length !== 8 || loading) return;
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({ email, token: otp, type: 'signup' });
    setLoading(false);
    if (error) {
      const msg = /already registered|already.*confirmed|registered/i.test(error.message)
        ? 'Этот email уже подтверждён. Войди под своим паролем.'
        : /expired/i.test(error.message)
        ? 'Код истёк. Запроси новый ниже.'
        : 'Неверный код. Если запрашивал несколько раз — введи последний.';
      toast.error(msg);
      setOtp('');
      return;
    }
    toast.success('Аккаунт подтверждён');
    if (role === 'client') router.push('/feed');
    else router.push('/onboarding/account-type');
  }

  async function handleResendSignupOTP() {
    if (resendIn > 0) return;
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    setLoading(false);
    if (error) toast.error(humanizeError(error));
    else { toast.success('Код отправлен повторно'); setResendIn(60); }
  }

  /* ───── forgot password ───── */
  async function handleForgotSend(e: React.FormEvent) {
    e.preventDefault();
    if (!email) { toast.error('Введите email'); return; }
    if (isDisposableEmail(email)) {
      toast.error('Используйте проверенную почту (Gmail, Outlook и т.п.). Временные почты нарушают наши условия использования.');
      return;
    }
    setLoading(true);
    const supabase = createClient();
    // Locale comes from user_metadata set at signup — template reads {{ .Data.locale }}.
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    setLoading(false);
    if (error) { toast.error(humanizeError(error)); return; }
    setSub('reset-sent');
  }

  // Проверка OTP происходит сразу при «Далее» на экране ввода кода — чтобы
  // не выбрасывать пользователя обратно после ввода нового пароля.
  async function handleResetOtpVerify() {
    if (otp.length !== 8 || loading) return;
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({ email, token: otp, type: 'recovery' });
    setLoading(false);
    if (error) {
      // Для OTP-флоу не пускаем humanizeError — её паттерны мапят 403/«token expired»
      // на «Сессия истекла. Войди заново», что неверно по контексту.
      const msg = /expired/i.test(error.message)
        ? 'Код истёк. Запроси новый ниже.'
        : 'Неверный код. Если запрашивал несколько раз — введи последний.';
      toast.error(msg);
      setOtp('');
      return;
    }
    setSub('new-password');
  }

  async function handleSetNewPwd(e: React.FormEvent) {
    e.preventDefault();
    if (newPwd.length < 6) return;
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: newPwd });
    setLoading(false);
    if (error) { toast.error(humanizeError(error)); return; }
    toast.success('Пароль обновлён');
    setSub('form');
    setMode('signin');
    setPassword(''); setOtp(''); setNewPwd('');
  }

  const isSignUp = mode === 'signup';

  const slide = {
    initial: { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -6 },
    transition: { duration: 0.18, ease: 'easeOut' as const },
  };

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
      <style dangerouslySetInnerHTML={{ __html: AUTH_CSS }} />

      <div className="auth-glass" style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
        {/* Top bar — slim */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px clamp(16px,3vw,36px)',
          flexShrink: 0,
        }}>
          <Link href="/" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            fontWeight: 800, fontSize: 15, letterSpacing: '-.03em',
          }}>
            <span style={{
              width: 22, height: 22, borderRadius: 6,
              background: 'var(--aviolet)', display: 'grid', placeItems: 'center',
              color: '#fff', fontSize: 10, fontWeight: 900,
            }}>C</span>
            CRES-CA
          </Link>
          <Link href="/" style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 12, color: 'var(--afg3)',
          }}>
            <ArrowLeft size={12} /> На главную
          </Link>
        </div>

        {/* Split layout — естественная высота, страница скроллится если форма длинная.
            Раньше height:100dvh + overflow:hidden обрезали форму signup на узких
            экранах (нижние поля выходили за viewport, role-toggle уезжал наверх). */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'row', gap: 0,
          padding: 'clamp(6px, 1.2vw, 12px)',
        }}>
          {/* Form column — top-align так чтобы длинная форма signup не обрезалась
              сверху (центровка прятала role-toggle за viewport). Снизу — внятный
              отступ чтобы последняя кнопка не липла к краю экрана. Скролл —
              на уровне страницы. */}
          <motion.section
            layout
            transition={{ type: 'spring', stiffness: 180, damping: 26, mass: 0.8 }}
            style={{
              flex: 1, order: isSignUp ? 2 : 1,
              display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
              padding: 'clamp(20px, 3vw, 40px) clamp(12px, 2.5vw, 32px) clamp(40px, 5vw, 64px)',
            }}
          >
              <div style={{ width: '100%', maxWidth: 400 }}>
                {/* Role toggle. Стили активной кнопки идут через CSS-селектор
                    [data-active="true"] (см. AUTH_CSS) — инлайн-стили реконсилировались
                    некорректно в React 19. */}
                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4,
                  padding: 4, borderRadius: 14,
                  border: '1px solid var(--acb)',
                  background: 'color-mix(in oklab, var(--afg) 4%, transparent)',
                  marginBottom: isSignUp ? 14 : 22,
                }}>
                  {ROLES.map(r => {
                    const active = role === r.value;
                    const Icon = r.icon;
                    return (
                      <button
                        key={r.value}
                        type="button"
                        className="role-tab"
                        data-active={active ? 'true' : 'false'}
                        onClick={() => { setRole(r.value); setSub('form'); }}
                      >
                        <Icon size={14} />
                        {r.label}
                      </button>
                    );
                  })}
                </div>

                <AnimatePresence mode="wait">
                  {/* Sign-in / sign-up form */}
                  {sub === 'form' && (
                    <motion.div key={`form-${mode}`} {...slide}>
                      <h1 style={{
                        fontSize: isSignUp ? 'clamp(22px, 2.8vw, 28px)' : 'clamp(28px, 4vw, 36px)',
                        fontWeight: 300, letterSpacing: '-.025em',
                        margin: 0, lineHeight: 1.1,
                      }}>
                        {mode === 'signin' ? 'С возвращением' : 'Добро пожаловать'}
                      </h1>
                      <p style={{ fontSize: 13, color: 'var(--afg2)', margin: isSignUp ? '6px 0 14px' : '10px 0 22px', lineHeight: 1.45 }}>
                        {mode === 'signin'
                          ? 'Войдите в свой аккаунт'
                          : role === 'salon_admin'
                            ? 'Создайте аккаунт для вашей команды'
                            : 'Создайте бесплатный аккаунт'}
                      </p>

                      <form onSubmit={mode === 'signin' ? handleSignIn : handleSignUp} style={{ display: 'flex', flexDirection: 'column', gap: isSignUp ? 8 : 12 }}>
                        {mode === 'signup' && (
                          <>
                            {role === 'salon_admin' && (
                              <Field label="Название команды">
                                <GlassWrap>
                                  <input
                                    className="glass-input"
                                    value={salonName}
                                    onChange={e => setSalonName(e.target.value)}
                                    placeholder="Например: Studio 54, AutoPro, Dr. Smile…"
                                    required
                                    autoFocus
                                  />
                                </GlassWrap>
                              </Field>
                            )}

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                              <Field label={role === 'salon_admin' ? 'Имя администратора' : 'Имя'}>
                                <GlassWrap>
                                  <input
                                    className="glass-input"
                                    value={firstName}
                                    onChange={e => setFirstName(e.target.value)}
                                    required
                                    autoFocus={role !== 'salon_admin'}
                                  />
                                </GlassWrap>
                              </Field>
                              <Field label={role === 'salon_admin' ? 'Фамилия администратора' : 'Фамилия'}>
                                <GlassWrap>
                                  <input className="glass-input" value={lastName} onChange={e => setLastName(e.target.value)} required />
                                </GlassWrap>
                              </Field>
                            </div>

                            <Field label="Телефон">
                              <GlassWrap>
                                <input
                                  type="tel" inputMode="tel"
                                  value={phone}
                                  onChange={e => {
                                    const cleaned = e.target.value.replace(/[^\d+\s-]/g, '').slice(0, 20);
                                    setPhone(cleaned);
                                  }}
                                  className="glass-input"
                                  required
                                />
                              </GlassWrap>
                            </Field>

                            {role !== 'salon_admin' && (
                              <Field label="Дата рождения">
                                <GlassWrap>
                                  <DobInput value={dob} onChange={setDob} />
                                </GlassWrap>
                              </Field>
                            )}
                          </>
                        )}

                        <Field label="Email">
                          <GlassWrap>
                            <input className="glass-input" type="email" value={email} onChange={e => setEmail(e.target.value)} required
                              autoFocus={mode === 'signin'}
                              autoComplete={mode === 'signup' ? 'email' : 'username'} />
                          </GlassWrap>
                        </Field>

                        <Field label="Пароль"
                          right={mode === 'signin' ? (
                            <button type="button" onClick={() => setSub('forgot')}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--aviolet)', fontWeight: 500 }}>
                              Забыли пароль?
                            </button>
                          ) : null}
                        >
                          <GlassWrap>
                            <div style={{ position: 'relative' }}>
                              <input
                                className="glass-input"
                                type={showPwd ? 'text' : 'password'}
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required
                                minLength={mode === 'signup' ? 6 : undefined}
                                style={{ paddingRight: 44 }}
                                placeholder={mode === 'signup' ? 'Минимум 6 символов' : undefined}
                                /* autoComplete='new-password' — Chrome не должен
                                   автозаполнять сохранённый старый пароль при
                                   регистрации. Для входа — current-password. */
                                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                              />
                              <button type="button" onClick={() => setShowPwd(v => !v)} tabIndex={-1}
                                style={{
                                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--afg3)',
                                  display: 'flex', alignItems: 'center',
                                }}>
                                {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                              </button>
                            </div>
                          </GlassWrap>
                        </Field>

                        {mode === 'signin' && (
                          <label style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            fontSize: 13, color: 'var(--afg2)', cursor: 'pointer',
                          }}>
                            <input type="checkbox" className="auth-cb" checked={rememberMe}
                              onChange={e => setRememberMe(e.target.checked)} />
                            Запомнить меня
                          </label>
                        )}

                        {mode === 'signup' && (
                          <label style={{
                            display: 'flex', alignItems: 'flex-start', gap: 8,
                            fontSize: 12, color: 'var(--afg2)', cursor: 'pointer', lineHeight: 1.45,
                          }}>
                            <input type="checkbox" className="auth-cb" checked={terms}
                              onChange={e => setTerms(e.target.checked)} style={{ marginTop: 2 }} />
                            <span>
                              Я принимаю{' '}
                              <a href={`/${locale}/terms`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline' }}>
                                условия использования
                              </a>
                              {', '}
                              <a href={`/${locale}/privacy`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline' }}>
                                политику конфиденциальности
                              </a>
                              {' и '}
                              <a href={`/${locale}/cookies`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline' }}>
                                политику cookie
                              </a>
                            </span>
                          </label>
                        )}

                        <PrimaryButton disabled={loading || (mode === 'signup' && !terms)} type="submit">
                          {loading ? '...' : mode === 'signin' ? 'Войти' : 'Создать аккаунт'}
                        </PrimaryButton>
                      </form>

                      {/* Toggle mode */}
                      <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--afg2)', marginTop: isSignUp ? 12 : 22 }}>
                        {mode === 'signin' ? 'Нет аккаунта? ' : 'Уже есть аккаунт? '}
                        <button
                          type="button"
                          onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setPassword(''); }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer',
                            color: 'var(--aviolet)', fontWeight: 600, fontSize: 13,
                            padding: 0, fontFamily: 'var(--af)' }}
                        >
                          {mode === 'signin' ? 'Зарегистрироваться' : 'Войти'}
                        </button>
                      </p>
                    </motion.div>
                  )}

                  {/* Forgot password */}
                  {sub === 'forgot' && (
                    <motion.div key="forgot" {...slide}>
                      <BackLink onClick={() => setSub('form')} />
                      <h1 style={{ fontSize: 28, fontWeight: 300, letterSpacing: '-.02em', margin: '8px 0 6px' }}>
                        Забыли пароль?
                      </h1>
                      <p style={{ fontSize: 13, color: 'var(--afg2)', margin: '0 0 22px' }}>
                        Отправим код восстановления на email.
                      </p>
                      <form onSubmit={handleForgotSend} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <Field label="Email">
                          <GlassWrap>
                            <input className="glass-input" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
                          </GlassWrap>
                        </Field>
                        <PrimaryButton disabled={loading} type="submit">
                          {loading ? '...' : 'Отправить код'}
                        </PrimaryButton>
                      </form>
                    </motion.div>
                  )}

                  {/* Reset-sent */}
                  {sub === 'reset-sent' && (
                    <motion.div key="reset-sent" {...slide} style={{ textAlign: 'center' }}>
                      <IconBubble><Mail size={24} /></IconBubble>
                      <h1 style={{ fontSize: 24, fontWeight: 300, margin: '14px 0 4px', letterSpacing: '-.02em' }}>
                        Проверьте почту
                      </h1>
                      <p style={{ fontSize: 13, color: 'var(--afg2)', margin: '0 0 4px' }}>{email}</p>
                      <p style={{ fontSize: 13, color: 'var(--afg2)', margin: '8px 0 22px' }}>
                        Мы отправили 8-значный код. Введите его на следующем шаге.
                      </p>
                      <PrimaryButton onClick={() => setSub('reset-otp')} type="button">
                        Ввести код
                      </PrimaryButton>
                    </motion.div>
                  )}

                  {/* Reset OTP */}
                  {sub === 'reset-otp' && (
                    <motion.div key="reset-otp" {...slide} style={{ textAlign: 'center' }}>
                      <IconBubble><Mail size={24} /></IconBubble>
                      <h1 style={{ fontSize: 24, fontWeight: 300, margin: '14px 0 4px', letterSpacing: '-.02em' }}>Код из письма</h1>
                      <p style={{ fontSize: 13, color: 'var(--afg2)', margin: '0 0 22px' }}>
                        Отправлен на <strong style={{ color: 'var(--afg)' }}>{email}</strong>
                      </p>
                      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
                        <InputOTP maxLength={8} pattern={REGEXP_ONLY_DIGITS} value={otp} onChange={setOtp}
                          onComplete={handleResetOtpVerify}>
                          <InputOTPGroup>
                            <InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} /><InputOTPSlot index={3} />
                          </InputOTPGroup>
                          <InputOTPSeparator />
                          <InputOTPGroup>
                            <InputOTPSlot index={4} /><InputOTPSlot index={5} /><InputOTPSlot index={6} /><InputOTPSlot index={7} />
                          </InputOTPGroup>
                        </InputOTP>
                      </div>
                      <PrimaryButton disabled={otp.length !== 8 || loading} onClick={handleResetOtpVerify} type="button">
                        {loading ? 'Проверяем…' : 'Далее'}
                      </PrimaryButton>
                      <button
                        type="button"
                        disabled={loading || resendIn > 0}
                        onClick={async () => {
                          if (loading || resendIn > 0 || !email) return;
                          setLoading(true);
                          const supabase = createClient();
                          const { error } = await supabase.auth.resetPasswordForEmail(email);
                          setLoading(false);
                          setOtp('');
                          if (error) toast.error(humanizeError(error));
                          else { toast.success('Новый код отправлен'); setResendIn(60); }
                        }}
                        style={{ background: 'none', border: 'none',
                          cursor: resendIn > 0 ? 'not-allowed' : 'pointer',
                          color: resendIn > 0 ? 'var(--afg3)' : 'var(--aviolet)',
                          fontSize: 13, marginTop: 12, fontWeight: 600 }}>
                        {resendIn > 0 ? `Отправить новый код через ${resendIn}с` : 'Отправить новый код'}
                      </button>
                      <button type="button" onClick={() => { setSub('forgot'); setOtp(''); }}
                        style={{ display: 'block', margin: '8px auto 0', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--afg3)', fontSize: 12 }}>
                        Назад
                      </button>
                    </motion.div>
                  )}

                  {/* New password */}
                  {sub === 'new-password' && (
                    <motion.div key="new-password" {...slide}>
                      <BackLink onClick={() => { setSub('reset-otp'); setNewPwd(''); }} />
                      <h1 style={{ fontSize: 28, fontWeight: 300, letterSpacing: '-.02em', margin: '8px 0 6px' }}>
                        Новый пароль
                      </h1>
                      <p style={{ fontSize: 13, color: 'var(--afg2)', margin: '0 0 22px' }}>
                        Минимум 6 символов
                      </p>
                      <form onSubmit={handleSetNewPwd} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <Field label="Пароль">
                          <GlassWrap>
                            <div style={{ position: 'relative' }}>
                              <input
                                className="glass-input"
                                type={showNewPwd ? 'text' : 'password'}
                                value={newPwd} onChange={e => setNewPwd(e.target.value)}
                                required minLength={6} autoFocus
                                autoComplete="new-password"
                                style={{ paddingRight: 44 }}
                              />
                              <button type="button" onClick={() => setShowNewPwd(v => !v)} tabIndex={-1}
                                style={{
                                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--afg3)',
                                  display: 'flex', alignItems: 'center',
                                }}>
                                {showNewPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                              </button>
                            </div>
                          </GlassWrap>
                        </Field>
                        <PrimaryButton disabled={loading || newPwd.length < 6} type="submit">
                          {loading ? '...' : 'Сохранить'}
                        </PrimaryButton>
                      </form>
                    </motion.div>
                  )}

                  {/* 2FA Telegram code */}
                  {sub === '2fa' && (
                    <motion.div key="2fa" {...slide} style={{ textAlign: 'center' }}>
                      <IconBubble><Shield size={24} /></IconBubble>
                      <h1 style={{ fontSize: 24, fontWeight: 300, margin: '14px 0 4px', letterSpacing: '-.02em' }}>
                        Код из Telegram
                      </h1>
                      <p style={{ fontSize: 13, color: 'var(--afg2)', margin: '0 0 22px' }}>
                        Мы отправили 6-значный код в Telegram на привязанный аккаунт.
                      </p>
                      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
                        <InputOTP maxLength={6} pattern={REGEXP_ONLY_DIGITS} value={twoFaCode} onChange={setTwoFaCode}
                          onComplete={handle2faSubmit}>
                          <InputOTPGroup>
                            <InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} />
                          </InputOTPGroup>
                          <InputOTPSeparator />
                          <InputOTPGroup>
                            <InputOTPSlot index={3} /><InputOTPSlot index={4} /><InputOTPSlot index={5} />
                          </InputOTPGroup>
                        </InputOTP>
                      </div>
                      <PrimaryButton disabled={loading || twoFaCode.length !== 6} onClick={handle2faSubmit} type="button">
                        {loading ? '...' : 'Подтвердить'}
                      </PrimaryButton>
                      <button type="button" onClick={handle2faCancel}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--afg3)', fontSize: 12, marginTop: 12 }}>
                        Отмена
                      </button>
                    </motion.div>
                  )}

                  {/* Account pending deletion — restore prompt */}
                  {sub === 'restore' && (
                    <motion.div key="restore" {...slide} style={{ textAlign: 'center' }}>
                      <IconBubble><Shield size={24} /></IconBubble>
                      <h1 style={{ fontSize: 24, fontWeight: 300, margin: '14px 0 4px', letterSpacing: '-.02em' }}>
                        Аккаунт помечен на удаление
                      </h1>
                      <p style={{ fontSize: 13, color: 'var(--afg2)', margin: '0 0 22px', lineHeight: 1.5 }}>
                        Хотите восстановить? После 30 дней с момента запроса удаления все данные удаляются безвозвратно.
                      </p>
                      <PrimaryButton disabled={loading} onClick={handleRestoreConfirm} type="button">
                        {loading ? '...' : 'Восстановить аккаунт'}
                      </PrimaryButton>
                      <button type="button" onClick={handleRestoreCancel} disabled={loading}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--afg3)', fontSize: 12, marginTop: 12 }}>
                        Отмена
                      </button>
                    </motion.div>
                  )}

                  {/* Signup OTP */}
                  {sub === 'signup-otp' && (
                    <motion.div key="signup-otp" {...slide} style={{ textAlign: 'center' }}>
                      <IconBubble><Shield size={24} /></IconBubble>
                      <h1 style={{ fontSize: 24, fontWeight: 300, margin: '14px 0 4px', letterSpacing: '-.02em' }}>Подтверждение email</h1>
                      <p style={{ fontSize: 13, color: 'var(--afg2)', margin: '0 0 22px' }}>
                        Отправлен код на <strong style={{ color: 'var(--afg)' }}>{email}</strong>
                      </p>
                      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
                        <InputOTP maxLength={8} pattern={REGEXP_ONLY_DIGITS} value={otp} onChange={setOtp}
                          onComplete={handleVerifySignupOTP}>
                          <InputOTPGroup>
                            <InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} /><InputOTPSlot index={3} />
                          </InputOTPGroup>
                          <InputOTPSeparator />
                          <InputOTPGroup>
                            <InputOTPSlot index={4} /><InputOTPSlot index={5} /><InputOTPSlot index={6} /><InputOTPSlot index={7} />
                          </InputOTPGroup>
                        </InputOTP>
                      </div>
                      <PrimaryButton disabled={loading || otp.length !== 8} onClick={handleVerifySignupOTP} type="button">
                        {loading ? '...' : 'Подтвердить'}
                      </PrimaryButton>
                      <button type="button" onClick={handleResendSignupOTP} disabled={loading || resendIn > 0}
                        style={{ background: 'none', border: 'none', cursor: resendIn > 0 ? 'not-allowed' : 'pointer',
                          color: resendIn > 0 ? 'var(--afg3)' : 'var(--aviolet)',
                          fontSize: 13, marginTop: 12, fontWeight: 600 }}>
                        {resendIn > 0 ? `Отправить повторно через ${resendIn}с` : 'Отправить повторно'}
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
          </motion.section>

          {/* Hero image column — hidden on mobile */}
          <motion.section
            layout
            transition={{ type: 'spring', stiffness: 180, damping: 26, mass: 0.8 }}
            className="auth-hero"
            style={{
              flex: 1, order: isSignUp ? 1 : 2,
              position: 'relative',
              borderRadius: 28,
              overflow: 'hidden',
              minHeight: 400,
            }}
          >
              <div style={{
                position: 'absolute', inset: 0,
                backgroundImage: `url(${HERO_IMG})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }} />
              <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(135deg, color-mix(in oklab, var(--aviolet) 40%, transparent) 0%, transparent 60%)',
                mixBlendMode: 'multiply',
              }} />
            <style>{`
              @media (max-width: 767px) {
                .auth-hero { display: none !important; }
              }
            `}</style>
          </motion.section>
        </div>
      </div>
    </>
  );
}

/* ───── UI helpers ───── */

function Field({ label, right, children }: { label: string; right?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span className="auth-label" style={{ margin: 0 }}>{label}</span>
        {right}
      </div>
      {children}
    </div>
  );
}

function GlassWrap({ children }: { children: ReactNode }) {
  return <div className="glass-wrap">{children}</div>;
}

/** Plain text input for DOB — same look as other fields. Accepts DD.MM.YYYY, emits ISO YYYY-MM-DD. */
function DobInput({ value, onChange }: { value: string; onChange: (isoOrEmpty: string) => void }) {
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
      // partial input — clear error, but parent stays empty
      setError(null);
      onChange('');
      return;
    }

    const [, d, m, y] = full;
    const day = +d, month = +m, year = +y;
    const currentYear = new Date().getFullYear();

    // Per-field range checks first (more useful errors)
    if (month < 1 || month > 12) {
      setError('Месяц должен быть от 01 до 12');
      onChange('');
      return;
    }
    if (year < 1900 || year > currentYear) {
      setError(`Год должен быть от 1900 до ${currentYear}`);
      onChange('');
      return;
    }
    // Calendar-aware day check (handles 31 Feb / 31 Apr / etc).
    const candidate = new Date(year, month - 1, day);
    const valid =
      candidate.getFullYear() === year &&
      candidate.getMonth() === month - 1 &&
      candidate.getDate() === day;
    if (!valid) {
      setError(`В ${month.toString().padStart(2, '0')}.${year} нет ${day}-го числа`);
      onChange('');
      return;
    }
    // Sanity: can't be born in the future or younger than 5 years old
    if (candidate.getTime() > Date.now()) {
      setError('Дата в будущем — проверь');
      onChange('');
      return;
    }
    setError(null);
    onChange(`${y}-${m}-${d}`);
  }

  return (
    <div>
      <input
        className="glass-input"
        type="text"
        inputMode="numeric"
        autoComplete="bday"
        placeholder="__.__.____"
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        style={error ? { borderColor: '#ef4444' } : undefined}
        aria-invalid={!!error}
      />
      {error && (
        <p style={{ fontSize: 11, color: '#ef4444', marginTop: 4, lineHeight: 1.3 }}>
          {error}
        </p>
      )}
    </div>
  );
}

function PrimaryButton({
  children, onClick, disabled, type = 'button',
}: { children: ReactNode; onClick?: () => void; disabled?: boolean; type?: 'button' | 'submit' }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "100%", height: 48, borderRadius: 14,
        background: 'var(--aviolet)', color: '#fff',
        border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: 14, fontWeight: 600, letterSpacing: '.005em',
        opacity: disabled ? 0.55 : 1,
        transition: 'all .2s ease',
        boxShadow: disabled ? 'none' : '0 6px 20px color-mix(in oklab, var(--aviolet) 32%, transparent)',
      }}
    >
      {children}
    </button>
  );
}

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', gap: 6,
        fontSize: 13, color: 'var(--afg3)', padding: 0, marginBottom: 8,
        fontFamily: 'var(--af)',
      }}>
      <ArrowLeft size={14} /> Назад
    </button>
  );
}

function IconBubble({ children }: { children: ReactNode }) {
  return (
    <div style={{
      width: 56, height: 56, borderRadius: '50%',
      background: 'var(--aviolet-l)', color: 'var(--aviolet)',
      display: 'grid', placeItems: 'center', margin: '0 auto',
    }}>
      {children}
    </div>
  );
}

