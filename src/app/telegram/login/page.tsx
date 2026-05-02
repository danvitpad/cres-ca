/** --- YAML
 * name: BrowserLoginPage (Mini App-style)
 * description: Лёгкая страница входа для пользователей которые открыли сайт
 *              в обычном Chrome/Safari (не в Telegram). Email + пароль через
 *              Supabase auth → cookie session → редирект на нужный home.
 *              Визуально следует тем же design-токенам что и Mini App
 *              (svetlaya/dark theme, scaffold плавающего nav-бара).
 * created: 2026-05-02
 * --- */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Mail, Lock } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { MiniAppThemeProvider } from '@/components/miniapp/theme';
import { T, R, FONT_BASE, SHADOW, PAGE_PADDING_X } from '@/components/miniapp/design';
import type { UserRole, SubscriptionTier } from '@/types';

export default function MiniAppLoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
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
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, tier, full_name')
        .eq('id', user.id)
        .maybeSingle<{ role: string | null; tier: string | null; full_name: string | null }>();
      const role = (profile?.role ?? 'client') as string;
      setAuth(user.id, role as UserRole, (profile?.tier ?? null) as SubscriptionTier | null, profile?.full_name ?? null);
      if (role === 'master' || role === 'salon_admin') {
        router.replace('/telegram/m/home');
      } else {
        router.replace('/telegram/home');
      }
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
          ? 'Неверная почта или пароль'
          : error.message;
        setErr(msg);
        return;
      }
      if (!data.user) {
        setErr('Не удалось войти');
        return;
      }
      // Determine destination by role
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, tier, full_name')
        .eq('id', data.user.id)
        .maybeSingle<{ role: string | null; tier: string | null; full_name: string | null }>();
      const role = (profile?.role ?? 'client') as string;
      setAuth(data.user.id, role as UserRole, (profile?.tier ?? null) as SubscriptionTier | null, profile?.full_name ?? null);
      if (role === 'master' || role === 'salon_admin') {
        router.replace('/telegram/m/home');
      } else {
        router.replace('/telegram/home');
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Сетевая ошибка');
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
          Войдите в свой аккаунт
        </p>
      </div>

      <form
        onSubmit={handleLogin}
        style={{
          padding: `0 ${PAGE_PADDING_X}px`,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
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
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@example.com"
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
            placeholder="Пароль"
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

        {err && (
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
            {err}
          </div>
        )}

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
          Войти
        </button>
      </form>

      <div
        style={{
          padding: `20px ${PAGE_PADDING_X}px`,
          marginTop: 12,
          textAlign: 'center',
          fontSize: 13,
          color: T.textSecondary,
        }}
      >
        Нет аккаунта?{' '}
        <Link
          href="/ru/login?mode=signup"
          style={{ color: T.accent, fontWeight: 600, textDecoration: 'none' }}
        >
          Зарегистрироваться
        </Link>
      </div>

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
        Чтобы быстрее — откройте бот{' '}
        <a
          href="https://t.me/crescacom_bot"
          style={{ color: T.accent, fontWeight: 500, textDecoration: 'none' }}
        >
          @crescacom_bot
        </a>
        {' '}в Telegram
      </div>
    </div>
    </MiniAppThemeProvider>
  );
}
