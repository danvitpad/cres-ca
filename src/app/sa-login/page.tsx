/** --- YAML
 * name: Superadmin login page (hidden URL)
 * description: Минималистичная страница входа в /superadmin для Данила. URL вне
 *   стандартного [locale]/login — чтобы случайные люди не наткнулись на форму.
 *   Принимает {username, password}, шлёт в /api/auth/sa-login, по успеху —
 *   редирект на /ru/superadmin/dashboard.
 * created: 2026-04-29
 * --- */

'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, ShieldCheck } from 'lucide-react';

export default function SuperadminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/sa-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data?.error === 'login_disabled') {
          setError('Вход в админку временно отключён.');
        } else {
          setError('Неверные данные.');
        }
        setBusy(false);
        return;
      }
      // Hard reload — чтобы серверные компоненты увидели новые cookies
      window.location.href = data.redirectTo || '/ru/superadmin/dashboard';
    } catch {
      setError('Сетевая ошибка. Попробуй ещё раз.');
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#0d0e10] px-4 text-white">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-300">
            <ShieldCheck size={24} strokeWidth={1.8} />
          </div>
          <div>
            <h1 className="text-[20px] font-semibold tracking-tight">Вход для администратора</h1>
            <p className="mt-1 text-[12px] text-white/40">Только для управления платформой</p>
          </div>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-3">
          <div>
            <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-white/40">
              Логин
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              required
              className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 text-[14px] text-white placeholder:text-white/30 outline-none transition-colors focus:border-violet-400/60 focus:bg-white/[0.05]"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-white/40">
              Пароль
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 text-[14px] text-white placeholder:text-white/30 outline-none transition-colors focus:border-violet-400/60 focus:bg-white/[0.05]"
            />
          </div>

          {error && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy || !username.trim() || !password}
            className="mt-2 flex h-11 items-center justify-center gap-2 rounded-xl bg-violet-500 text-[14px] font-semibold text-white transition-colors hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Lock size={16} />
            {busy ? '...' : 'Войти'}
          </button>
        </form>
      </div>
    </div>
  );
}
