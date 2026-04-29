/** --- YAML
 * name: MiniAppWelcomePage
 * description: First-time intro for Telegram users — без приветствия, универсальный текст под любую сферу услуг (не только бьюти). Сверху — переключатели темы и языка. Не залогиненный никаких приветствий не видит.
 * created: 2026-04-13
 * updated: 2026-04-29
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  Calendar, ShieldCheck, Heart, LogIn, Loader2, Sun, Moon, Globe,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { mapError } from '@/lib/errors';

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
    description: 'CRES-CA — ваш особистий простір для запису до найкращих майстрів.',
    f1Title: 'Запис у пару кліків',
    f1Text: 'Обирайте спеціаліста, послугу та час — без дзвінків і листувань.',
    f2Title: 'Історія ваших візитів',
    f2Text: 'Улюблені майстри, бонуси та минулі візити — завжди під рукою.',
    f3Title: 'Надійно і приватно',
    f3Text: 'Дані зберігаються у нас і не передаються третім особам.',
    terms: 'Продовжуючи, ви погоджуєтесь з',
    termsLink: 'Умовами використання',
    create: 'Створити акаунт',
    haveAccount: 'У мене вже є акаунт',
    loginTitle: 'Вхід в акаунт',
    loginSub: 'Зв’яжемо цей Telegram з вашим акаунтом',
    pwd: 'Пароль',
    enter: 'Увійти',
  },
  ru: {
    description: 'CRES-CA — ваше личное пространство для записи к лучшим мастерам.',
    f1Title: 'Запись в пару кликов',
    f1Text: 'Выбирайте специалиста, услугу и время — без звонков и переписок.',
    f2Title: 'История ваших визитов',
    f2Text: 'Любимые мастера, бонусы и прошлые визиты — всегда под рукой.',
    f3Title: 'Надёжно и приватно',
    f3Text: 'Данные хранятся у нас и не передаются третьим лицам.',
    terms: 'Продолжая, вы соглашаетесь с',
    termsLink: 'Условиями использования',
    create: 'Создать аккаунт',
    haveAccount: 'У меня уже есть аккаунт',
    loginTitle: 'Вход в аккаунт',
    loginSub: 'Свяжем этот Telegram с вашим аккаунтом',
    pwd: 'Пароль',
    enter: 'Войти',
  },
  en: {
    description: 'CRES-CA — your personal space to book the best specialists.',
    f1Title: 'Book in two taps',
    f1Text: 'Pick a specialist, a service and a time — no calls, no chats.',
    f2Title: 'Your visit history',
    f2Text: 'Favourite specialists, bonuses and past visits — always at hand.',
    f3Title: 'Safe and private',
    f3Text: 'Your data stays with us and is never shared with third parties.',
    terms: 'By continuing you agree to the',
    termsLink: 'Terms of Use',
    create: 'Create account',
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
    if (stored && LANG_CYCLE.includes(stored)) {
      setLang(stored);
    } else {
      // По умолчанию украинский. Дополнительно: если у TG-юзера украинский язык — тоже uk.
      setLang('uk');
    }
  }, []);

  // Синхронизируем тему с Telegram при первом заходе. Если юзер ещё не выбирал
  // тему вручную (next-themes хранит выбор в localStorage 'theme') — берём
  // colorScheme из TG. Если в TG включена тёмная — приложение тоже тёмное.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const tg = (window as { Telegram?: { WebApp?: { colorScheme?: 'light' | 'dark' } } }).Telegram?.WebApp;
    if (!tg?.colorScheme) return;
    const stored = localStorage.getItem('theme');
    if (!stored || stored === 'system') {
      setTheme(tg.colorScheme);
    }
  }, [setTheme]);

  // Перекрашиваем шапку и низ TG в наш цвет фона при каждой смене темы —
  // иначе остаётся синяя полоска TG, не совпадающая с нашим #141417/#ffffff.
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

  function toggleTheme() {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
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

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="flex min-h-dvh flex-col"
      style={{ background: 'var(--background)', color: 'var(--foreground)' }}
    >
      {/* Top bar — переключатели темы и языка */}
      <div
        className="flex items-center justify-end gap-2 px-5 pt-4"
        style={{ paddingTop: 'max(16px, env(safe-area-inset-top))' }}
      >
        <button
          type="button"
          onClick={cycleLang}
          aria-label="Сменить язык"
          className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold active:scale-95 transition-transform"
          style={{
            borderColor: 'color-mix(in oklab, var(--foreground) 14%, transparent)',
            color: 'var(--foreground)',
            background: 'color-mix(in oklab, var(--foreground) 5%, transparent)',
          }}
        >
          <Globe className="size-3.5" />
          {LANG_SHORT[lang]}
        </button>
        <button
          type="button"
          onClick={toggleTheme}
          aria-label="Сменить тему"
          className="flex size-9 items-center justify-center rounded-full border active:scale-95 transition-transform"
          style={{
            borderColor: 'color-mix(in oklab, var(--foreground) 14%, transparent)',
            color: 'var(--foreground)',
            background: 'color-mix(in oklab, var(--foreground) 5%, transparent)',
          }}
        >
          {mounted && resolvedTheme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </button>
      </div>

      <div className="flex-1 space-y-8 px-6 pt-10 pb-[260px]">
        <div className="space-y-3 text-center">
          <motion.p
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="mx-auto max-w-xs text-[15px] leading-relaxed"
            style={{ color: 'color-mix(in oklab, var(--foreground) 70%, transparent)' }}
          >
            {t.description}
          </motion.p>
        </div>

        <motion.ul
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="space-y-3"
        >
          <Feature icon={Calendar} title={t.f1Title} text={t.f1Text} />
          <Feature icon={Heart} title={t.f2Title} text={t.f2Text} />
          <Feature icon={ShieldCheck} title={t.f3Title} text={t.f3Text} />
        </motion.ul>
      </div>

      {/* Bottom actions */}
      <div
        className="fixed inset-x-0 bottom-0 space-y-3 px-6 pb-6 pt-10"
        style={{
          paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
          background: 'linear-gradient(to top, var(--background) 0%, var(--background) 60%, transparent 100%)',
        }}
      >
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="px-1 text-center text-[11px] leading-relaxed"
          style={{ color: 'color-mix(in oklab, var(--foreground) 50%, transparent)' }}
        >
          {t.terms}{' '}
          <Link
            href="/telegram/terms"
            className="underline"
            style={{ textDecorationColor: 'color-mix(in oklab, var(--foreground) 30%, transparent)' }}
          >
            {t.termsLink}
          </Link>
        </motion.p>
        <motion.button
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.45 }}
          onClick={() => router.push('/telegram/register')}
          className="w-full rounded-2xl py-4 text-[16px] font-semibold active:scale-[0.98] transition-transform"
          style={{
            background: 'var(--primary)',
            color: 'var(--primary-foreground)',
            boxShadow: '0 6px 20px color-mix(in oklab, var(--primary) 32%, transparent)',
          }}
        >
          {t.create}
        </motion.button>
        <motion.button
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          onClick={() => {
            setLoginOpen(true);
            setErr(null);
          }}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border py-4 text-[16px] font-semibold active:scale-[0.98] transition-transform"
          style={{
            borderColor: 'color-mix(in oklab, var(--foreground) 18%, transparent)',
            background: 'color-mix(in oklab, var(--foreground) 5%, transparent)',
            color: 'var(--foreground)',
          }}
        >
          <LogIn className="size-4" /> {t.haveAccount}
        </motion.button>
      </div>

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
                background: 'var(--background)',
                color: 'var(--foreground)',
                paddingBottom: 'max(32px, env(safe-area-inset-bottom))',
              }}
            >
              <div
                className="mx-auto mb-4 h-1 w-10 rounded-full"
                style={{ background: 'color-mix(in oklab, var(--foreground) 20%, transparent)' }}
              />
              <div className="mb-5 flex items-center gap-3">
                <div
                  className="flex size-10 items-center justify-center rounded-xl border"
                  style={{
                    background: 'color-mix(in oklab, var(--color-accent) 15%, transparent)',
                    borderColor: 'color-mix(in oklab, var(--color-accent) 25%, transparent)',
                  }}
                >
                  <LogIn className="size-5" />
                </div>
                <div>
                  <h2 className="text-[17px] font-semibold">{t.loginTitle}</h2>
                  <p
                    className="text-[12px]"
                    style={{ color: 'color-mix(in oklab, var(--foreground) 50%, transparent)' }}
                  >
                    {t.loginSub}
                  </p>
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
                    borderColor: 'color-mix(in oklab, var(--foreground) 12%, transparent)',
                    background: 'color-mix(in oklab, var(--foreground) 5%, transparent)',
                    color: 'var(--foreground)',
                    caretColor: 'var(--color-accent)',
                  }}
                />
                <input
                  type="password"
                  placeholder={t.pwd}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-2xl border px-4 py-4 text-[16px] outline-none"
                  style={{
                    borderColor: 'color-mix(in oklab, var(--foreground) 12%, transparent)',
                    background: 'color-mix(in oklab, var(--foreground) 5%, transparent)',
                    color: 'var(--foreground)',
                    caretColor: 'var(--color-accent)',
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
                    background: 'var(--primary)',
                    color: 'var(--primary-foreground)',
                  }}
                >
                  {busy && <Loader2 className="size-4 animate-spin" />}
                  {t.enter}
                </button>

                {/* Ссылка на регистрацию — для тех у кого нет аккаунта */}
                <p
                  className="text-center text-[13px] pt-1"
                  style={{ color: 'color-mix(in oklab, var(--foreground) 55%, transparent)' }}
                >
                  {lang === 'en' ? "Don't have an account?" : lang === 'uk' ? 'Немає акаунту?' : 'Нет аккаунта?'}{' '}
                  <button
                    type="button"
                    onClick={() => router.push('/telegram/register')}
                    className="font-semibold underline underline-offset-2"
                    style={{ color: 'var(--foreground)' }}
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

function Feature({
  icon: Icon,
  title,
  text,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  text: string;
}) {
  return (
    <li
      className="flex items-start gap-3 rounded-2xl border p-4"
      style={{
        borderColor: 'color-mix(in oklab, var(--foreground) 10%, transparent)',
        background: 'color-mix(in oklab, var(--foreground) 4%, transparent)',
      }}
    >
      <div
        className="flex size-10 shrink-0 items-center justify-center rounded-xl border"
        style={{
          background: 'color-mix(in oklab, var(--color-accent) 15%, transparent)',
          borderColor: 'color-mix(in oklab, var(--color-accent) 25%, transparent)',
        }}
      >
        <Icon className="size-5" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold">{title}</p>
        <p
          className="mt-0.5 text-[12px] leading-snug"
          style={{ color: 'color-mix(in oklab, var(--foreground) 55%, transparent)' }}
        >
          {text}
        </p>
      </div>
    </li>
  );
}
