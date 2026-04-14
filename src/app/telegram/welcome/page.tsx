/** --- YAML
 * name: MiniAppWelcomePage
 * description: Friendly brand intro for first-time Telegram users. No data-import pressure — just welcomes them and routes to manual registration.
 * created: 2026-04-13
 * updated: 2026-04-13
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { Sparkles, Calendar, ShieldCheck, Heart, LogIn, Loader2 } from 'lucide-react';
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

export default function MiniAppWelcomePage() {
  const router = useRouter();
  const [stash, setStash] = useState<Stash | null>(null);

  const [loginOpen, setLoginOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem('cres:tg');
    if (!raw) {
      router.replace('/telegram');
      return;
    }
    setStash(JSON.parse(raw) as Stash);
  }, [router]);

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
    return <div className="min-h-dvh bg-[#1f2023]" />;
  }

  const firstName = stash.tgData?.first_name ?? '';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="flex min-h-dvh flex-col bg-[#1f2023] text-white"
    >
      <div className="flex-1 space-y-10 px-6 pt-14 pb-[260px]">
        {/* Brand hero */}
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 240, damping: 20 }}
          className="relative mx-auto flex size-28 items-center justify-center rounded-[34px] bg-gradient-to-br from-violet-500 via-fuchsia-500 to-rose-500"
        >
          <Sparkles className="size-12" />
          <div className="absolute -inset-3 rounded-[44px] bg-gradient-to-br from-violet-500/30 via-fuchsia-500/20 to-rose-500/30 blur-2xl" />
        </motion.div>

        <div className="space-y-3 text-center">
          <motion.h1
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-[32px] font-bold leading-tight"
          >
            Здравствуйте{firstName ? `, ${firstName}` : ''}!
          </motion.h1>
          <motion.p
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="mx-auto max-w-xs text-[15px] leading-relaxed text-white/60"
          >
            CRES-CA — ваше личное пространство для записи к лучшим мастерам красоты и заботы о себе.
          </motion.p>
        </div>

        {/* Feature bullets — soft, not pushy */}
        <motion.ul
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.35 }}
          className="space-y-3"
        >
          <Feature
            icon={Calendar}
            title="Запись в пару кликов"
            text="Выбирайте мастера, услугу и время — без звонков и переписок."
          />
          <Feature
            icon={Heart}
            title="История вашей красоты"
            text="Любимые мастера, бонусы и прошлые визиты — всегда под рукой."
          />
          <Feature
            icon={ShieldCheck}
            title="Надёжно и приватно"
            text="Данные хранятся у нас и не передаются третьим лицам."
          />
        </motion.ul>
      </div>

      {/* Bottom actions */}
      <div
        className="fixed inset-x-0 bottom-0 space-y-3 bg-gradient-to-t from-[#1f2023] via-[#1f2023]/95 to-transparent px-6 pb-6 pt-10"
        style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}
      >
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="px-1 text-center text-[11px] leading-relaxed text-white/45"
        >
          Продолжая, вы соглашаетесь с{' '}
          <Link href="/telegram/terms" className="underline decoration-white/30 hover:decoration-white">
            Условиями использования
          </Link>
        </motion.p>
        <motion.button
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.45 }}
          onClick={() => router.push('/telegram/register')}
          className="w-full rounded-2xl bg-white py-4 text-[15px] font-semibold text-black active:scale-[0.98] transition-transform"
        >
          Создать аккаунт
        </motion.button>
        <motion.button
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          onClick={() => {
            setLoginOpen(true);
            setErr(null);
          }}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/5 py-4 text-[15px] font-semibold text-white active:scale-[0.98] transition-transform"
        >
          <LogIn className="size-4" /> У меня уже есть аккаунт
        </motion.button>
      </div>

      <AnimatePresence>
        {loginOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end bg-black/60 backdrop-blur-sm"
            onClick={() => !busy && setLoginOpen(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full rounded-t-3xl bg-[#1f2023] px-6 pb-8 pt-5 text-white"
              style={{ paddingBottom: 'max(32px, env(safe-area-inset-bottom))' }}
            >
              <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />
              <div className="mb-5 flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/30 to-rose-500/30">
                  <LogIn className="size-5" />
                </div>
                <div>
                  <h2 className="text-[17px] font-semibold">Вход в аккаунт</h2>
                  <p className="text-[12px] text-white/50">Свяжем этот Telegram с вашим аккаунтом</p>
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
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-[15px] outline-none placeholder:text-white/30 focus:border-white/30"
                />
                <input
                  type="password"
                  placeholder="Пароль"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-[15px] outline-none placeholder:text-white/30 focus:border-white/30"
                />
                {err && (
                  <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-200">
                    {err}
                  </div>
                )}
                <button
                  onClick={signIn}
                  disabled={busy || !email || !password}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-4 text-[15px] font-semibold text-black disabled:opacity-40 active:scale-[0.98] transition-transform"
                >
                  {busy && <Loader2 className="size-4 animate-spin" />}
                  Войти
                </button>
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
    <li className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/30 to-rose-500/30">
        <Icon className="size-5 text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-0.5 text-[12px] leading-snug text-white/55">{text}</p>
      </div>
    </li>
  );
}
