/** --- YAML
 * name: MiniAppWelcomePage
 * description: First-time intro for Telegram users. Hero-style без приветствия. Логомарк + заголовок + субтайтл + 3 кнопки выбора роли. Тема следует за TG colorScheme. Язык переключается chip'ом в правом верхнем углу.
 * created: 2026-04-13
 * updated: 2026-05-11
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { Briefcase, User, LogIn, Loader2, ChevronDown } from 'lucide-react';
import { useTheme } from 'next-themes';
import { mapError } from '@/lib/errors';
import '@/styles/od-welcome-landing.css';

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

type Lang = 'uk' | 'ru' | 'en';

const LANG_CYCLE: Lang[] = ['uk', 'ru', 'en'];
const LANG_SHORT: Record<Lang, string> = { uk: 'UA', ru: 'RU', en: 'EN' };

const T = {
  uk: {
    headline: 'Сервіс який знає ваших клієнтів',
    sub: 'Записи, нагадування, фінанси і маркетинг — в одному Telegram-боті',
    terms: 'Продовжуючи, ви погоджуєтесь з',
    termsLink: 'Умовами використання',
    iAmClient: 'Я клієнт',
    iAmMaster: 'Я майстер',
    haveAccount: 'У мене вже є акаунт',
    loginTitle: 'Вхід в акаунт',
    loginSub: 'Зв’яжемо цей Telegram з вашим акаунтом',
    pwd: 'Пароль',
    enter: 'Увійти',
  },
  ru: {
    headline: 'Сервис, который знает ваших клиентов',
    sub: 'Записи, напоминания, финансы и маркетинг — в одном Telegram-боте',
    terms: 'Продолжая, вы соглашаетесь с',
    termsLink: 'Условиями использования',
    iAmClient: 'Я клиент',
    iAmMaster: 'Я мастер',
    haveAccount: 'У меня уже есть аккаунт',
    loginTitle: 'Вход в аккаунт',
    loginSub: 'Свяжем этот Telegram с вашим аккаунтом',
    pwd: 'Пароль',
    enter: 'Войти',
  },
  en: {
    headline: 'The service that knows your clients',
    sub: 'Bookings, reminders, finances and marketing — all in one Telegram bot',
    terms: 'By continuing you agree to the',
    termsLink: 'Terms of Use',
    iAmClient: 'I am a client',
    iAmMaster: 'I am a master',
    haveAccount: 'I already have an account',
    loginTitle: 'Sign in',
    loginSub: 'We’ll link this Telegram to your account',
    pwd: 'Password',
    enter: 'Sign in',
  },
};

export default function MiniAppWelcomePage() {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [stash, setStash] = useState<Stash | null>(null);

  const [lang, setLang] = useState<Lang>('uk');

  const [loginOpen, setLoginOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    const stored = (typeof window !== 'undefined' && localStorage.getItem('cres:locale')) as Lang | null;
    if (stored && LANG_CYCLE.includes(stored)) setLang(stored);
  }, []);

  // Mini App тема строго из Telegram (см. CLAUDE.md правило 10)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const tg = (window as { Telegram?: { WebApp?: { colorScheme?: 'light' | 'dark' } } }).Telegram?.WebApp;
    const tgScheme = tg?.colorScheme;
    if (tgScheme === 'light' || tgScheme === 'dark') {
      setTheme(tgScheme);
    } else if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
      setTheme('dark');
    } else {
      setTheme('light');
    }
  }, [setTheme]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    type TG = { WebApp?: { colorScheme?: 'light' | 'dark'; onEvent?: (e: string, cb: () => void) => void; offEvent?: (e: string, cb: () => void) => void } };
    const tg = (window as { Telegram?: TG }).Telegram?.WebApp;
    const handler = () => {
      const next = tg?.colorScheme;
      if (next === 'light' || next === 'dark') setTheme(next);
    };
    tg?.onEvent?.('themeChanged', handler);
    return () => { tg?.offEvent?.('themeChanged', handler); };
  }, [setTheme]);

  useEffect(() => {
    if (typeof window === 'undefined' || !mounted) return;
    const tg = (window as {
      Telegram?: {
        WebApp?: {
          setHeaderColor?: (c: string) => void;
          setBackgroundColor?: (c: string) => void;
          setBottomBarColor?: (c: string) => void;
        };
      };
    }).Telegram?.WebApp;
    if (!tg) return;
    // Hex ТОЧНО совпадает с --m-bg в globals.css (см. MiniAppThemeProvider).
    // Раньше welcome ставил #0f172a (slate-blue) → на переходе в register/
    // login Telegram chrome оставался slate, body уже #141417 — visible
    // «горб». Унифицировано: один hex везде.
    const bg = resolvedTheme === 'dark' ? '#141417' : '#ffffff';
    try { tg.setHeaderColor?.(bg); } catch {}
    try { tg.setBackgroundColor?.(bg); } catch {}
    try { tg.setBottomBarColor?.(bg); } catch {}
  }, [resolvedTheme, mounted]);

  useEffect(() => {
    const raw = sessionStorage.getItem('cres:tg');
    if (!raw) {
      router.replace('/telegram');
      return;
    }
    setStash(JSON.parse(raw) as Stash);
  }, [router]);

  function cycleLang() {
    const idx = LANG_CYCLE.indexOf(lang);
    const next = LANG_CYCLE[(idx + 1) % LANG_CYCLE.length];
    setLang(next);
    try { localStorage.setItem('cres:locale', next); } catch {}
    try { document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=31536000`; } catch {}
  }

  async function signIn() {
    if (!stash) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch('/api/telegram/link-existing/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: stash.initData, email, password }),
      });
      const j = await res.json();
      if (!res.ok) {
        setErr(mapError(j.error, 'Не удалось войти'));
        return;
      }
      router.replace('/telegram');
    } catch {
      setErr(mapError('network_error'));
    } finally {
      setBusy(false);
    }
  }

  if (!stash) {
    return <div className="min-h-dvh" style={{ background: 'var(--background)' }} />;
  }

  const t = T[lang];
  const isDark = resolvedTheme === 'dark';

  // Background — solid hex, ТОЧНО совпадает с --m-bg (см. MiniAppThemeProvider
  // + globals.css). Раньше был градиент 0f172a→1e293b→0f172a — середина
  // светлее, а chrome был #0f172a из этого же hex'а: на переходе на другую
  // страницу chrome оставался slate, body уже #141417 — visible «горб».
  const bg = isDark ? '#141417' : '#ffffff';

  // Цвета текста и хром-элементов под тему
  const fg = isDark ? '#ffffff' : '#0f172a';
  const fgMuted = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(15,23,42,0.55)';
  const fgDim = isDark ? 'rgba(255,255,255,0.4)' : 'rgba(15,23,42,0.4)';
  const chipBg = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.06)';
  const chipBorder = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.1)';
  const secondaryBg = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(37,99,235,0.06)';
  const secondaryBorder = isDark ? 'rgba(255,255,255,0.2)' : 'rgba(37,99,235,0.3)';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="od-welcome-landing relative flex min-h-dvh flex-col overflow-hidden"
      style={{ background: bg, color: fg }}
    >
      {/* Cobalt glow — radial accent за центром hero */}
      <div
        aria-hidden
        className="pointer-events-none absolute"
        style={{
          width: 320,
          height: 320,
          borderRadius: '50%',
          left: '50%',
          top: '45%',
          transform: 'translate(-50%,-55%)',
          background: 'radial-gradient(circle, rgba(37,99,235,0.28) 0%, transparent 70%)',
        }}
      />

      {/* Lang chip — правый верхний угол, под TG bottom-sheet chrome (~60px offset).
          Минималистичный pill: только код языка + крошечный chevron.
          Globe убран 2026-05-11 (выбивался — три элемента в маленьком чипе
          выглядели тяжело). */}
      <div
        className="relative z-10 flex items-center justify-end px-5"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 60px)' }}
      >
        <button
          type="button"
          onClick={cycleLang}
          aria-label="Сменить язык"
          className="flex items-center gap-1 rounded-full border px-3 py-1.5 text-[12px] font-medium active:scale-95 transition-transform"
          style={{
            background: chipBg,
            borderColor: chipBorder,
            color: isDark ? 'rgba(255,255,255,0.85)' : 'rgba(15,23,42,0.75)',
          }}
        >
          {LANG_SHORT[lang]}
          <ChevronDown className="size-3" style={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(15,23,42,0.45)' }} />
        </button>
      </div>

      {/* Hero center */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-7 pb-[260px] text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="mb-5 flex size-[52px] items-center justify-center rounded-[16px]"
          style={{
            background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
            boxShadow: '0 8px 24px rgba(37,99,235,0.4)',
          }}
        >
          <svg width="28" height="20" viewBox="0 0 28 20" fill="none">
            <path
              d="M4 10C4 6.686 6.686 4 10 4h8c3.314 0 6 2.686 6 6v0c0 3.314-2.686 6-6 6h-8C6.686 16 4 13.314 4 10z"
              fill="white"
              fillOpacity="0.9"
            />
            <circle cx="10" cy="10" r="3" fill="white" fillOpacity="0.3" />
            <circle cx="18" cy="10" r="3" fill="white" fillOpacity="0.3" />
          </svg>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="mb-2.5 text-[18px] font-bold tracking-tight"
          style={{ color: fg }}
        >
          CRES<span style={{ color: '#60a5fa' }}>-CA</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="mb-3 max-w-[280px] text-[24px] font-bold leading-[1.2] tracking-tight"
          style={{ color: fg }}
        >
          {t.headline}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-[280px] text-[13px] leading-[1.55]"
          style={{ color: fgMuted }}
        >
          {t.sub}
        </motion.p>
      </div>

      {/* Bottom CTAs — sticky над home indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.85, duration: 0.4 }}
        className="fixed inset-x-0 bottom-0 z-20 space-y-2.5 px-7 pt-6"
        style={{
          paddingBottom: 'calc(28px + env(safe-area-inset-bottom, 0px))',
          background: isDark
            ? 'linear-gradient(to top, #141417 0%, #141417 60%, transparent 100%)'
            : 'linear-gradient(to top, #ffffff 0%, #ffffff 60%, transparent 100%)',
        }}
      >
        <p className="px-1 pb-1 text-center text-[11px] leading-relaxed" style={{ color: fgDim }}>
          {t.terms}{' '}
          <Link
            href="/telegram/terms"
            className="underline"
            style={{ textDecorationColor: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(15,23,42,0.3)' }}
          >
            {t.termsLink}
          </Link>
        </p>

        <button
          onClick={() => router.push('/telegram/register?role=master')}
          className="flex w-full items-center justify-center gap-2 rounded-[14px] py-3.5 text-[15px] font-semibold active:scale-[0.97] transition-transform"
          style={{
            background: '#2563eb',
            color: '#ffffff',
            boxShadow: '0 4px 16px rgba(37,99,235,0.4)',
          }}
        >
          <Briefcase className="size-4" />
          {t.iAmMaster}
        </button>

        <button
          onClick={() => router.push('/telegram/register?role=client')}
          className="flex w-full items-center justify-center gap-2 rounded-[14px] border-[1.5px] py-3.5 text-[15px] font-medium active:scale-[0.97] transition-transform"
          style={{
            background: secondaryBg,
            borderColor: secondaryBorder,
            color: fg,
          }}
        >
          <User className="size-4" style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(15,23,42,0.55)' }} />
          {t.iAmClient}
        </button>

        <button
          onClick={() => {
            setLoginOpen(true);
            setErr(null);
          }}
          className="flex w-full items-center justify-center gap-1.5 py-2 text-[13px] font-medium underline-offset-[3px] active:scale-[0.97] transition-transform"
          style={{ color: fgDim, textDecoration: 'underline' }}
        >
          <LogIn className="size-3.5" /> {t.haveAccount}
        </button>
      </motion.div>

      <AnimatePresence>
        {loginOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end backdrop-blur-sm"
            style={{ background: 'rgba(0,0,0,0.6)' }}
            onClick={() => !busy && setLoginOpen(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full rounded-t-3xl px-6 pb-8 pt-5"
              style={{
                background: isDark ? '#0f172a' : '#ffffff',
                color: fg,
                paddingBottom: 'max(32px, env(safe-area-inset-bottom))',
              }}
            >
              <div
                className="mx-auto mb-4 h-1 w-10 rounded-full"
                style={{ background: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(15,23,42,0.2)' }}
              />
              <div className="mb-5 flex items-center gap-3">
                <div
                  className="flex size-10 items-center justify-center rounded-xl border"
                  style={{
                    background: 'rgba(37,99,235,0.15)',
                    borderColor: 'rgba(37,99,235,0.25)',
                  }}
                >
                  <LogIn className="size-5" style={{ color: '#2563eb' }} />
                </div>
                <div>
                  <h2 className="text-[17px] font-semibold">{t.loginTitle}</h2>
                  <p className="text-[12px]" style={{ color: fgMuted }}>{t.loginSub}</p>
                </div>
              </div>

              <div className="space-y-3">
                <input
                  type="email"
                  inputMode="email"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-2xl border px-4 py-4 text-[16px] outline-none"
                  style={{
                    borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.12)',
                    background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.04)',
                    color: fg,
                    caretColor: '#2563eb',
                  }}
                />
                <input
                  type="password"
                  placeholder={t.pwd}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-2xl border px-4 py-4 text-[16px] outline-none"
                  style={{
                    borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.12)',
                    background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.04)',
                    color: fg,
                    caretColor: '#2563eb',
                  }}
                />
                {err && (
                  <div
                    className="rounded-xl border px-3 py-2 text-[12px]"
                    style={{
                      borderColor: 'rgba(244,63,94,0.3)',
                      background: 'rgba(244,63,94,0.1)',
                      color: '#fda4af',
                    }}
                  >
                    {err}
                  </div>
                )}
                <button
                  onClick={signIn}
                  disabled={busy || !email || !password}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-[16px] font-semibold disabled:opacity-40 active:scale-[0.98] transition-transform"
                  style={{
                    background: '#2563eb',
                    color: '#ffffff',
                  }}
                >
                  {busy && <Loader2 className="size-4 animate-spin" />}
                  {t.enter}
                </button>

                <p className="pt-1 text-center text-[13px]" style={{ color: fgMuted }}>
                  {lang === 'en' ? "Don't have an account?" : lang === 'uk' ? 'Немає акаунту?' : 'Нет аккаунта?'}{' '}
                  <button
                    type="button"
                    onClick={() => router.push('/telegram/register')}
                    className="font-semibold underline underline-offset-2"
                    style={{ color: fg }}
                  >
                    {lang === 'en' ? 'Register' : lang === 'uk' ? 'Зареєструватися' : 'Зарегистрироваться'}
                  </button>
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
