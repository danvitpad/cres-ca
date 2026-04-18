/** --- YAML
 * name: Auth Page (unified login + register)
 * description: Single page with 3 role tabs (Клиент/Мастер/Команда). Each tab shows sign-in form by default; bottom link swaps to sign-up on the same page. No navigation between routes. Styled to match landing v6 (Plus Jakarta Sans, violet accent, CSS vars).
 * created: 2026-04-15
 * updated: 2026-04-18
 * --- */

'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
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

type Role = 'client' | 'master' | 'salon_admin';
type Mode = 'signin' | 'signup';
type Sub = 'form' | 'forgot' | 'reset-sent' | 'reset-otp' | 'new-password' | 'signup-otp';

const REMEMBER_KEY = 'cres-ca-remember';

/* ───── Themed CSS — palette matches landing v6 ───── */
const AUTH_CSS = `
.auth-v6 {
  --af: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  /* Light: page=#fff, card=#fff, input=#f5f5f7 (subtle lift off card) */
  --abg: #ffffff;
  --acard: #ffffff;
  --ainput: #f5f5f7;
  --afg: #0a0a0a; --afg2: #555555; --afg3: #888888;
  --acb: rgba(0,0,0,.08);
  --aviolet: #7c3aed; --aviolet-l: #ede9fe;
  --adanger: #dc2626;
  font-family: var(--af);
  background: var(--abg);
  color: var(--afg);
  -webkit-font-smoothing: antialiased;
  min-height: 100vh;
}
html.dark .auth-v6 {
  /* Dark: page=#09090b, card=#141417 (softer), input=#1f1f23 (visible lift) */
  --abg: #09090b;
  --acard: #141417;
  --ainput: #1f1f23;
  --afg: #fafafa; --afg2: #a1a1aa; --afg3: #71717a;
  --acb: rgba(255,255,255,.08);
  --aviolet: #a78bfa; --aviolet-l: rgba(167,139,250,.12);
  --adanger: #f87171;
}
.auth-v6 input, .auth-v6 button, .auth-v6 select { font-family: var(--af); }
.auth-v6 a { color: inherit; text-decoration: none; }
.auth-input {
  width: 100%;
  height: 46px;
  padding: 0 14px;
  border-radius: 12px;
  border: 1px solid var(--acb);
  background: var(--ainput);
  color: var(--afg);
  font-size: 14px;
  outline: none;
  transition: border-color .15s, box-shadow .15s, background .15s;
}
.auth-input::placeholder { color: var(--afg3); }
.auth-input:hover { border-color: color-mix(in oklab, var(--aviolet) 40%, var(--acb)); }
.auth-input:focus { border-color: var(--aviolet); box-shadow: 0 0 0 3px color-mix(in oklab, var(--aviolet) 22%, transparent); }
.auth-label { font-size: 12px; font-weight: 600; color: var(--afg2); display: block; margin-bottom: 6px; letter-spacing: .01em; }
@keyframes auth-bg-pulse { 0%,100%{opacity:.55;transform:translate(-50%,-50%) scale(1)} 50%{opacity:.9;transform:translate(-50%,-50%) scale(1.08)} }
`;

const ROLES: { value: Role; label: string; icon: typeof UserIcon }[] = [
  { value: 'client',      label: 'Клиент',   icon: CalendarCheck },
  { value: 'master',      label: 'Мастер',   icon: UserIcon },
  { value: 'salon_admin', label: 'Команда',  icon: Building2 },
];

/** Read remembered {email, role} from localStorage once on mount (safe for SSR). */
function readRemembered(): { email?: string; role?: Role } {
  if (typeof window === 'undefined') return {};
  try {
    const saved = window.localStorage.getItem(REMEMBER_KEY);
    if (!saved) return {};
    const p = JSON.parse(saved) as { email?: string; role?: string };
    const role = p.role && ['client','master','salon_admin'].includes(p.role) ? (p.role as Role) : undefined;
    return { email: p.email, role };
  } catch { return {}; }
}

export default function AuthPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const urlMode = sp.get('mode');
  const urlRole = sp.get('role') as Role | null;
  const urlEmail = sp.get('email') || '';

  const [role, setRole] = useState<Role>(() => {
    if (urlRole && ['client','master','salon_admin'].includes(urlRole)) return urlRole;
    return readRemembered().role ?? 'client';
  });
  const [mode, setMode] = useState<Mode>(urlMode === 'signup' ? 'signup' : 'signin');
  const [sub, setSub] = useState<Sub>('form');
  const [loading, setLoading] = useState(false);

  // Shared fields — lazy-init email from URL or remembered store
  const [email, setEmail] = useState(() => urlEmail || readRemembered().email || '');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);

  // Signup-only fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [teamName, setTeamName] = useState('');
  const [phone, setPhone] = useState('');
  const [dob, setDob] = useState('');
  const [terms, setTerms] = useState(false);

  // OTP / reset
  const [otp, setOtp] = useState('');
  const [newPwd, setNewPwd] = useState('');

  /* ───── sign-in ───── */
  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    try {
      localStorage.setItem(REMEMBER_KEY, JSON.stringify({ email, role }));
    } catch {}
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setLoading(false); toast.error(error.message); return; }

    const user = data.user;
    if (!user) { setLoading(false); toast.error('Ошибка входа'); return; }

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    const actualRole = profile?.role ?? 'client';
    setLoading(false);

    if (actualRole === 'client') {
      try {
        const res = await fetch('/api/invite/claim', { method: 'POST' });
        const body = (await res.json()) as { master_id?: string };
        if (body.master_id) { router.push(`/masters/${body.master_id}`); return; }
      } catch {}
      router.push('/feed');
    } else {
      router.push('/calendar');
    }
  }

  /* ───── sign-up ───── */
  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) { toast.error('Пароль — минимум 6 символов'); return; }
    if (!terms) { toast.error('Примите условия использования'); return; }

    setLoading(true);
    const supabase = createClient();
    const isTeam = role === 'salon_admin';
    const fullName = isTeam ? teamName.trim() : `${firstName} ${lastName}`.trim();

    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: {
        data: {
          full_name: fullName || firstName,
          role,
          phone: phone ? `+380${phone}` : undefined,
          date_of_birth: dob || undefined,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      },
    });
    setLoading(false);

    if (error) { toast.error(error.message); return; }
    if (data.user && data.user.identities?.length === 0) {
      toast.error('Этот email уже зарегистрирован');
      setMode('signin');
      return;
    }
    setSub('signup-otp');
  }

  async function handleVerifySignupOTP() {
    if (otp.length !== 8) return;
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({ email, token: otp, type: 'signup' });
    setLoading(false);
    if (error) { toast.error('Неверный код'); setOtp(''); return; }
    toast.success('Аккаунт подтверждён');
    if (role === 'client') router.push('/feed');
    else router.push('/onboarding/account-type');
  }

  async function handleResendSignupOTP() {
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    setLoading(false);
    if (error) toast.error(error.message);
    else toast.success('Код отправлен повторно');
  }

  /* ───── forgot password ───── */
  async function handleForgotSend(e: React.FormEvent) {
    e.preventDefault();
    if (!email) { toast.error('Введите email'); return; }
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setSub('reset-sent');
  }

  async function handleSetNewPwd(e: React.FormEvent) {
    e.preventDefault();
    if (newPwd.length < 6) return;
    setLoading(true);
    const supabase = createClient();
    const { error: verifyErr } = await supabase.auth.verifyOtp({ email, token: otp, type: 'recovery' });
    if (verifyErr) { toast.error('Неверный код'); setLoading(false); setSub('reset-otp'); setOtp(''); return; }
    const { error } = await supabase.auth.updateUser({ password: newPwd });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Пароль обновлён');
    setSub('form');
    setMode('signin');
    setPassword(''); setOtp(''); setNewPwd('');
  }

  /* ───── OAuth (clients) ───── */
  async function handleOAuth(provider: 'google' | 'facebook') {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/api/auth/callback` },
    });
    if (error) toast.error(error.message);
  }

  const slide = {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -8 },
    transition: { duration: 0.2 },
  };

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
      <style dangerouslySetInnerHTML={{ __html: AUTH_CSS }} />

      <div className="auth-v6" style={{ display: 'flex', flexDirection: 'column' }}>
        {/* Top bar: logo + back to landing */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px clamp(20px,4vw,48px)',
        }}>
          <Link href="/" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            fontWeight: 800, fontSize: 17, letterSpacing: '-.03em',
          }}>
            <span style={{
              width: 26, height: 26, borderRadius: 7,
              background: 'var(--aviolet)', display: 'grid', placeItems: 'center',
              color: '#fff', fontSize: 12, fontWeight: 900,
            }}>C</span>
            CRES-CA
          </Link>
          <Link href="/" style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 13, color: 'var(--afg3)',
          }}>
            <ArrowLeft size={14} /> На главную
          </Link>
        </div>

        {/* Centered card */}
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '20px clamp(16px,4vw,48px) 64px', position: 'relative',
        }}>
          {/* decorative violet glow */}
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%,-50%)',
            width: 'min(700px, 90vw)', height: 600,
            background: 'radial-gradient(ellipse, var(--aviolet-l), transparent 60%)',
            pointerEvents: 'none', zIndex: 0,
            animation: 'auth-bg-pulse 8s ease-in-out infinite',
          }} />

          <div style={{
            position: 'relative', zIndex: 1,
            width: '100%', maxWidth: 460,
            background: 'var(--acard)',
            border: '1px solid var(--acb)',
            borderRadius: 24,
            padding: 'clamp(28px,4vw,40px)',
            boxShadow: '0 30px 80px rgba(124,58,237,.12), 0 8px 24px rgba(0,0,0,.06)',
          }}>
            {/* Role tabs */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4,
              padding: 4, borderRadius: 12,
              background: 'var(--abg2)',
              marginBottom: 24,
            }}>
              {ROLES.map(r => {
                const active = role === r.value;
                const Icon = r.icon;
                return (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => { setRole(r.value); setSub('form'); }}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      padding: '9px 6px', borderRadius: 8, border: 'none', cursor: 'pointer',
                      background: active ? 'var(--acard)' : 'transparent',
                      color: active ? 'var(--afg)' : 'var(--afg3)',
                      fontSize: 13, fontWeight: 600,
                      boxShadow: active ? '0 2px 8px rgba(0,0,0,.04)' : 'none',
                      transition: 'all .15s',
                    }}
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
                <motion.div key={`form-${mode}-${role}`} {...slide}>
                  <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-.02em', margin: 0 }}>
                    {mode === 'signin' ? 'Вход' : 'Регистрация'}
                  </h1>
                  <p style={{ fontSize: 13, color: 'var(--afg2)', margin: '6px 0 20px' }}>
                    {mode === 'signin'
                      ? 'Войдите в свой аккаунт'
                      : role === 'salon_admin'
                        ? 'Создайте аккаунт для вашей команды'
                        : 'Создайте бесплатный аккаунт'}
                  </p>

                  {/* OAuth — clients only, sign-in only */}
                  {role === 'client' && mode === 'signin' && (
                    <>
                      <OAuthRow onClick={handleOAuth} />
                      <Divider />
                    </>
                  )}

                  <form onSubmit={mode === 'signin' ? handleSignIn : handleSignUp} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {/* ─── SIGN UP: name → phone → dob → email → password ─── */}
                    {mode === 'signup' && (
                      <>
                        {role === 'salon_admin' ? (
                          <Field label="Название команды / салона">
                            <input className="auth-input" value={teamName} onChange={e => setTeamName(e.target.value)} placeholder="Beauty Studio" required autoFocus />
                          </Field>
                        ) : (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            <Field label="Имя">
                              <input className="auth-input" value={firstName} onChange={e => setFirstName(e.target.value)} required autoFocus />
                            </Field>
                            <Field label="Фамилия">
                              <input className="auth-input" value={lastName} onChange={e => setLastName(e.target.value)} required />
                            </Field>
                          </div>
                        )}

                        <Field label="Телефон">
                          <div style={{
                            display: 'flex', alignItems: 'center', height: 46,
                            border: '1px solid var(--acb)', borderRadius: 12, overflow: 'hidden',
                            background: 'var(--ainput)',
                          }}>
                            <span style={{
                              padding: '0 12px', fontSize: 14, color: 'var(--afg2)',
                              borderRight: '1px solid var(--acb)', height: '100%',
                              display: 'flex', alignItems: 'center',
                              background: 'color-mix(in oklab, var(--acard) 50%, var(--ainput))',
                            }}>
                              +380
                            </span>
                            <input
                              type="tel" inputMode="numeric"
                              value={phone}
                              onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 9))}
                              placeholder="501234567"
                              style={{
                                flex: 1, height: '100%', padding: '0 12px',
                                border: 'none', outline: 'none',
                                background: 'transparent', color: 'var(--afg)', fontSize: 14,
                              }}
                            />
                          </div>
                        </Field>

                        {/* Date of birth — for client & master (not team, where org doesn't have a DOB) */}
                        {role !== 'salon_admin' && (
                          <Field label="Дата рождения">
                            <input
                              className="auth-input"
                              type="date"
                              value={dob}
                              onChange={e => setDob(e.target.value)}
                              max={new Date().toISOString().slice(0, 10)}
                            />
                          </Field>
                        )}
                      </>
                    )}

                    <Field label="Email">
                      <input className="auth-input" type="email" value={email} onChange={e => setEmail(e.target.value)} required
                        autoFocus={mode === 'signin'} />
                    </Field>

                    <Field label="Пароль"
                      right={mode === 'signin' ? (
                        <button type="button" onClick={() => setSub('forgot')}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--afg3)' }}>
                          Забыли?
                        </button>
                      ) : null}
                    >
                      <div style={{ position: 'relative' }}>
                        <input
                          className="auth-input"
                          type={showPwd ? 'text' : 'password'}
                          value={password}
                          onChange={e => setPassword(e.target.value)}
                          required
                          minLength={mode === 'signup' ? 6 : undefined}
                          style={{ paddingRight: 40 }}
                          placeholder={mode === 'signup' ? 'Минимум 6 символов' : undefined}
                        />
                        <button type="button" onClick={() => setShowPwd(v => !v)} tabIndex={-1}
                          style={{
                            position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                            background: 'none', border: 'none', cursor: 'pointer', color: 'var(--afg3)',
                          }}>
                          {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </Field>

                    {mode === 'signup' && (
                      <label style={{
                        display: 'flex', alignItems: 'flex-start', gap: 8,
                        fontSize: 12, color: 'var(--afg2)', cursor: 'pointer', lineHeight: 1.45,
                      }}>
                        <input type="checkbox" checked={terms} onChange={e => setTerms(e.target.checked)}
                          style={{ marginTop: 2, accentColor: 'var(--aviolet)' }} />
                        Я принимаю условия использования и политику конфиденциальности
                      </label>
                    )}

                    <PrimaryButton disabled={loading || (mode === 'signup' && !terms)} type="submit">
                      {loading ? '...' : mode === 'signin' ? 'Войти' : 'Создать аккаунт'}
                    </PrimaryButton>
                  </form>

                  {/* Toggle mode */}
                  <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--afg2)', marginTop: 20 }}>
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
                  <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-.02em', margin: '8px 0 6px' }}>
                    Забыли пароль?
                  </h1>
                  <p style={{ fontSize: 13, color: 'var(--afg2)', margin: '0 0 20px' }}>
                    Отправим код восстановления на email.
                  </p>
                  <form onSubmit={handleForgotSend} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <Field label="Email">
                      <input className="auth-input" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
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
                  <h1 style={{ fontSize: 22, fontWeight: 800, margin: '12px 0 4px' }}>
                    Проверьте почту
                  </h1>
                  <p style={{ fontSize: 13, color: 'var(--afg2)', margin: '0 0 4px' }}>{email}</p>
                  <p style={{ fontSize: 13, color: 'var(--afg2)', margin: '8px 0 20px' }}>
                    Мы отправили 6-значный код. Введите его на следующем шаге.
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
                  <h1 style={{ fontSize: 22, fontWeight: 800, margin: '12px 0 4px' }}>Код из письма</h1>
                  <p style={{ fontSize: 13, color: 'var(--afg2)', margin: '0 0 20px' }}>
                    Отправлен на <strong style={{ color: 'var(--afg)' }}>{email}</strong>
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
                    <InputOTP maxLength={6} pattern={REGEXP_ONLY_DIGITS} value={otp} onChange={setOtp}
                      onComplete={() => otp.length === 6 && setSub('new-password')}>
                      <InputOTPGroup>
                        <InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} />
                      </InputOTPGroup>
                      <InputOTPSeparator />
                      <InputOTPGroup>
                        <InputOTPSlot index={3} /><InputOTPSlot index={4} /><InputOTPSlot index={5} />
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                  <PrimaryButton disabled={otp.length !== 6} onClick={() => setSub('new-password')} type="button">
                    Далее
                  </PrimaryButton>
                  <button type="button" onClick={() => { setSub('forgot'); setOtp(''); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--afg3)', fontSize: 12, marginTop: 12 }}>
                    Назад
                  </button>
                </motion.div>
              )}

              {/* New password */}
              {sub === 'new-password' && (
                <motion.div key="new-password" {...slide}>
                  <BackLink onClick={() => { setSub('reset-otp'); setNewPwd(''); }} />
                  <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-.02em', margin: '8px 0 6px' }}>
                    Новый пароль
                  </h1>
                  <p style={{ fontSize: 13, color: 'var(--afg2)', margin: '0 0 20px' }}>
                    Минимум 6 символов
                  </p>
                  <form onSubmit={handleSetNewPwd} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <Field label="Пароль">
                      <div style={{ position: 'relative' }}>
                        <input
                          className="auth-input"
                          type={showNewPwd ? 'text' : 'password'}
                          value={newPwd} onChange={e => setNewPwd(e.target.value)}
                          required minLength={6} autoFocus
                          style={{ paddingRight: 40 }}
                        />
                        <button type="button" onClick={() => setShowNewPwd(v => !v)} tabIndex={-1}
                          style={{
                            position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                            background: 'none', border: 'none', cursor: 'pointer', color: 'var(--afg3)',
                          }}>
                          {showNewPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </Field>
                    <PrimaryButton disabled={loading || newPwd.length < 6} type="submit">
                      {loading ? '...' : 'Сохранить'}
                    </PrimaryButton>
                  </form>
                </motion.div>
              )}

              {/* Signup OTP */}
              {sub === 'signup-otp' && (
                <motion.div key="signup-otp" {...slide} style={{ textAlign: 'center' }}>
                  <IconBubble><Shield size={24} /></IconBubble>
                  <h1 style={{ fontSize: 22, fontWeight: 800, margin: '12px 0 4px' }}>Подтверждение email</h1>
                  <p style={{ fontSize: 13, color: 'var(--afg2)', margin: '0 0 20px' }}>
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
                  <button type="button" onClick={handleResendSignupOTP} disabled={loading}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--aviolet)', fontSize: 13, marginTop: 12, fontWeight: 600 }}>
                    Отправить повторно
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </>
  );
}

/* ───── Small UI helpers ───── */

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

function PrimaryButton({
  children, onClick, disabled, type = 'button',
}: { children: ReactNode; onClick?: () => void; disabled?: boolean; type?: 'button' | 'submit' }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%', height: 44, borderRadius: 12,
        background: 'var(--aviolet)', color: '#fff',
        border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: 14, fontWeight: 600,
        opacity: disabled ? 0.55 : 1,
        transition: 'all .2s',
        boxShadow: disabled ? 'none' : '0 4px 16px rgba(124,58,237,.25)',
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

function Divider() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0' }}>
      <div style={{ flex: 1, height: 1, background: 'var(--acb)' }} />
      <span style={{ fontSize: 11, color: 'var(--afg3)', textTransform: 'uppercase', letterSpacing: '.08em' }}>или</span>
      <div style={{ flex: 1, height: 1, background: 'var(--acb)' }} />
    </div>
  );
}

function OAuthRow({ onClick }: { onClick: (p: 'google' | 'facebook') => void }) {
  const btnStyle: React.CSSProperties = {
    flex: 1, height: 44, borderRadius: 12,
    border: '1px solid var(--acb)', background: 'var(--abg)', color: 'var(--afg)',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    fontSize: 13, fontWeight: 600, cursor: 'pointer',
    fontFamily: 'var(--af)',
  };
  return (
    <div style={{ display: 'flex', gap: 10 }}>
      <button type="button" onClick={() => onClick('google')} style={btnStyle}>
        <svg width="16" height="16" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
        Google
      </button>
      <button type="button" onClick={() => onClick('facebook')} style={btnStyle}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
        Facebook
      </button>
    </div>
  );
}
