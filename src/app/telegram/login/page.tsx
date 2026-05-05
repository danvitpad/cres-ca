/** --- YAML
 * name: BrowserLoginPage (Mini App-style)
 * description: Лёгкая страница входа для пользователей которые открыли сайт
 *              в обычном Chrome/Safari (не в Telegram). Email + пароль через
 *              Supabase auth → cookie session → редирект на нужный home.
 *              Визуально следует тем же design-токенам что и Mini App
 *              (svetlaya/dark theme, scaffold плавающего nav-бара).
 *              Локализация uk/ru/en + flow «Забыл пароль» через resetPasswordForEmail.
 * created: 2026-05-02
 * updated: 2026-05-05
 * --- */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Mail, Lock, ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { MiniAppThemeProvider } from '@/components/miniapp/theme';
import { T, R, FONT_BASE, SHADOW, PAGE_PADDING_X } from '@/components/miniapp/design';
import { useMiniAppLocale, type MiniAppLang } from '@/lib/miniapp/use-locale';
import type { UserRole, SubscriptionTier } from '@/types';

const I18N: Record<MiniAppLang, {
  brandSubtitle: string;
  emailPh: string; passwordPh: string;
  loginBtn: string;
  noAccount: string; signUp: string;
  forgot: string; back: string;
  forgotTitle: string; forgotSubtitle: string;
  sendReset: string;
  resetSent: string; resetSentDesc: string;
  invalidCreds: string; loginFailed: string; networkError: string;
  fasterTg: string;
}> = {
  uk: {
    brandSubtitle: 'Увійдіть до свого акаунту',
    emailPh: 'email@example.com', passwordPh: 'Пароль',
    loginBtn: 'Увійти',
    noAccount: 'Немає акаунту?', signUp: 'Зареєструватись',
    forgot: 'Забули пароль?', back: 'Назад',
    forgotTitle: 'Скидання пароля',
    forgotSubtitle: 'Введіть email — пришлемо лист із посиланням для скидання пароля.',
    sendReset: 'Надіслати лист',
    resetSent: 'Лист надіслано',
    resetSentDesc: 'Перевірте пошту — там посилання, по якому можна задати новий пароль.',
    invalidCreds: 'Невірна пошта або пароль',
    loginFailed: 'Не вдалось увійти', networkError: 'Помилка мережі',
    fasterTg: 'Щоб швидше — відкрийте бот',
  },
  ru: {
    brandSubtitle: 'Войдите в свой аккаунт',
    emailPh: 'email@example.com', passwordPh: 'Пароль',
    loginBtn: 'Войти',
    noAccount: 'Нет аккаунта?', signUp: 'Зарегистрироваться',
    forgot: 'Забыли пароль?', back: 'Назад',
    forgotTitle: 'Сброс пароля',
    forgotSubtitle: 'Введите email — пришлём письмо со ссылкой для сброса пароля.',
    sendReset: 'Отправить письмо',
    resetSent: 'Письмо отправлено',
    resetSentDesc: 'Проверьте почту — там ссылка, по которой можно задать новый пароль.',
    invalidCreds: 'Неверная почта или пароль',
    loginFailed: 'Не удалось войти', networkError: 'Сетевая ошибка',
    fasterTg: 'Чтобы быстрее — откройте бот',
  },
  en: {
    brandSubtitle: 'Sign in to your account',
    emailPh: 'email@example.com', passwordPh: 'Password',
    loginBtn: 'Sign in',
    noAccount: 'No account?', signUp: 'Sign up',
    forgot: 'Forgot password?', back: 'Back',
    forgotTitle: 'Password reset',
    forgotSubtitle: 'Enter your email — we’ll send you a link to reset your password.',
    sendReset: 'Send reset link',
    resetSent: 'Email sent',
    resetSentDesc: 'Check your inbox — the link inside lets you set a new password.',
    invalidCreds: 'Invalid email or password',
    loginFailed: 'Sign in failed', networkError: 'Network error',
    fasterTg: 'Faster way — open the bot',
  },
};

type Mode = 'login' | 'forgot' | 'sent';

export default function MiniAppLoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const lang = useMiniAppLocale();
  const t = I18N[lang];
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Если уже залогинен — сразу разводим по home в зависимости от роли
  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [{ data: profile }, { data: masterRow }] = await Promise.all([
        supabase
          .from('profiles')
          .select('role, tier, full_name')
          .eq('id', user.id)
          .maybeSingle<{ role: string | null; tier: string | null; full_name: string | null }>(),
        supabase
          .from('masters')
          .select('id')
          .eq('profile_id', user.id)
          .maybeSingle<{ id: string }>(),
      ]);
      const isMaster = !!masterRow || profile?.role === 'master' || profile?.role === 'salon_admin';
      const role = (isMaster ? (profile?.role ?? 'master') : (profile?.role ?? 'client')) as string;
      setAuth(user.id, role as UserRole, (profile?.tier ?? null) as SubscriptionTier | null, profile?.full_name ?? null);
      window.location.replace(isMaster ? '/telegram/m/home' : '/telegram/home');
    })();
  }, [router, setAuth]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) {
        const msg = error.message.toLowerCase().includes('invalid')
          ? t.invalidCreds
          : error.message;
        setErr(msg);
        return;
      }
      if (!data.user) {
        setErr(t.loginFailed);
        return;
      }
      const [{ data: profile }, { data: masterRow }] = await Promise.all([
        supabase
          .from('profiles')
          .select('role, tier, full_name')
          .eq('id', data.user.id)
          .maybeSingle<{ role: string | null; tier: string | null; full_name: string | null }>(),
        supabase
          .from('masters')
          .select('id')
          .eq('profile_id', data.user.id)
          .maybeSingle<{ id: string }>(),
      ]);
      const isMaster = !!masterRow || profile?.role === 'master' || profile?.role === 'salon_admin';
      const role = (isMaster ? (profile?.role ?? 'master') : (profile?.role ?? 'client')) as string;
      setAuth(data.user.id, role as UserRole, (profile?.tier ?? null) as SubscriptionTier | null, profile?.full_name ?? null);
      const target = isMaster ? '/telegram/m/home' : '/telegram/home';
      window.location.replace(target);
    } catch (e) {
      setErr(e instanceof Error ? e.message : t.networkError);
    } finally {
      setBusy(false);
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const supabase = createClient();
      // Redirect назад на ту же страницу — Supabase передаст code, сессия восстановится,
      // юзер увидит обычный home-redirect выше. Если хочется отдельный экран
      // "новый пароль" — можно завести /telegram/login/new-password позже.
      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        { redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/telegram/login` : undefined },
      );
      if (error) {
        setErr(error.message);
        return;
      }
      setMode('sent');
    } catch (e) {
      setErr(e instanceof Error ? e.message : t.networkError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <MiniAppThemeProvider
      style={{
        ...FONT_BASE,
        minHeight: '100dvh',
        background: T.bg,
        color: T.text,
      }}
    >
    <div
      style={{
        ...FONT_BASE,
        minHeight: '100dvh',
        background: T.bg,
        color: T.text,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          padding: `40px ${PAGE_PADDING_X}px 24px`,
          paddingTop: 'max(40px, env(safe-area-inset-top))',
          textAlign: 'center',
        }}
      >
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
          CRES-CA
        </h1>
        <p style={{ marginTop: 8, fontSize: 14, color: T.textSecondary }}>
          {mode === 'login' ? t.brandSubtitle : mode === 'forgot' ? t.forgotTitle : t.resetSent}
        </p>
      </div>

      {mode === 'login' && (
        <form
          onSubmit={handleLogin}
          style={{
            padding: `0 ${PAGE_PADDING_X}px`,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <EmailField value={email} onChange={setEmail} placeholder={t.emailPh} />
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '12px 14px',
              borderRadius: R.md,
              border: `1.5px solid ${T.border}`,
              background: T.surface,
            }}
          >
            <Lock size={16} color={T.textTertiary} style={{ flexShrink: 0 }} />
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t.passwordPh}
              required
              style={{
                flex: 1,
                border: 'none',
                background: 'transparent',
                outline: 'none',
                fontSize: 15,
                color: T.text,
                fontFamily: 'inherit',
              }}
            />
          </div>

          {err && <ErrorBox text={err} />}

          <button
            type="submit"
            disabled={busy || !email.trim() || !password}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              width: '100%',
              padding: '14px 0',
              borderRadius: R.lg,
              background: T.accent,
              color: '#fff',
              fontSize: 16,
              fontWeight: 700,
              border: 'none',
              cursor: busy ? 'wait' : 'pointer',
              fontFamily: 'inherit',
              opacity: busy || !email.trim() || !password ? 0.6 : 1,
              boxShadow: SHADOW.card,
              marginTop: 8,
            }}
          >
            {busy && <Loader2 size={16} className="animate-spin" />}
            {t.loginBtn}
          </button>

          <button
            type="button"
            onClick={() => { setErr(null); setMode('forgot'); }}
            style={{
              alignSelf: 'center',
              padding: '8px 12px',
              marginTop: 4,
              border: 'none',
              background: 'transparent',
              color: T.accent,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {t.forgot}
          </button>
        </form>
      )}

      {mode === 'forgot' && (
        <form
          onSubmit={handleForgot}
          style={{
            padding: `0 ${PAGE_PADDING_X}px`,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <p
            style={{
              fontSize: 13,
              color: T.textSecondary,
              margin: 0,
              padding: '0 4px 6px',
              lineHeight: 1.4,
            }}
          >
            {t.forgotSubtitle}
          </p>

          <EmailField value={email} onChange={setEmail} placeholder={t.emailPh} />

          {err && <ErrorBox text={err} />}

          <button
            type="submit"
            disabled={busy || !email.trim()}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              width: '100%',
              padding: '14px 0',
              borderRadius: R.lg,
              background: T.accent,
              color: '#fff',
              fontSize: 16,
              fontWeight: 700,
              border: 'none',
              cursor: busy ? 'wait' : 'pointer',
              fontFamily: 'inherit',
              opacity: busy || !email.trim() ? 0.6 : 1,
              boxShadow: SHADOW.card,
              marginTop: 4,
            }}
          >
            {busy && <Loader2 size={16} className="animate-spin" />}
            {t.sendReset}
          </button>

          <button
            type="button"
            onClick={() => { setErr(null); setMode('login'); }}
            style={{
              alignSelf: 'center',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 12px',
              marginTop: 4,
              border: 'none',
              background: 'transparent',
              color: T.textSecondary,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            <ArrowLeft size={14} /> {t.back}
          </button>
        </form>
      )}

      {mode === 'sent' && (
        <div
          style={{
            padding: `0 ${PAGE_PADDING_X}px`,
            textAlign: 'center',
            fontSize: 14,
            color: T.textSecondary,
            lineHeight: 1.5,
            maxWidth: 320,
            margin: '0 auto',
          }}
        >
          {t.resetSentDesc}
          <button
            type="button"
            onClick={() => { setErr(null); setMode('login'); }}
            style={{
              display: 'block',
              margin: '24px auto 0',
              padding: '10px 18px',
              border: `1px solid ${T.border}`,
              borderRadius: R.pill,
              background: T.surface,
              color: T.text,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            <ArrowLeft size={14} style={{ verticalAlign: -2, marginRight: 6 }} />
            {t.back}
          </button>
        </div>
      )}

      {mode === 'login' && (
        <div
          style={{
            padding: `20px ${PAGE_PADDING_X}px`,
            marginTop: 12,
            textAlign: 'center',
            fontSize: 13,
            color: T.textSecondary,
          }}
        >
          {t.noAccount}{' '}
          <Link
            href={`/${lang}/login?mode=signup`}
            style={{ color: T.accent, fontWeight: 600, textDecoration: 'none' }}
          >
            {t.signUp}
          </Link>
        </div>
      )}

      <div
        style={{
          marginTop: 'auto',
          padding: `20px ${PAGE_PADDING_X}px`,
          paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
          textAlign: 'center',
          fontSize: 11,
          color: T.textTertiary,
          lineHeight: 1.5,
        }}
      >
        {t.fasterTg}{' '}
        <a
          href="https://t.me/crescacom_bot"
          style={{ color: T.accent, fontWeight: 500, textDecoration: 'none' }}
        >
          @crescacom_bot
        </a>
      </div>
    </div>
    </MiniAppThemeProvider>
  );
}

function EmailField({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '12px 14px',
        borderRadius: R.md,
        border: `1.5px solid ${T.border}`,
        background: T.surface,
      }}
    >
      <Mail size={16} color={T.textTertiary} style={{ flexShrink: 0 }} />
      <input
        type="email"
        inputMode="email"
        autoComplete="email"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required
        style={{
          flex: 1,
          border: 'none',
          background: 'transparent',
          outline: 'none',
          fontSize: 15,
          color: T.text,
          fontFamily: 'inherit',
        }}
      />
    </div>
  );
}

function ErrorBox({ text }: { text: string }) {
  return (
    <div
      style={{
        padding: '10px 12px',
        borderRadius: R.sm,
        background: T.dangerSoft,
        color: T.danger,
        fontSize: 13,
        fontWeight: 500,
      }}
    >
      {text}
    </div>
  );
}
