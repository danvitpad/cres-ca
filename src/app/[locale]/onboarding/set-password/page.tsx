/** --- YAML
 * name: OnboardingSetPassword
 * description: Принудительная установка пароля после Google OAuth signup.
 *              Аккаунт не считается зарегистрированным пока юзер не задал
 *              пароль — это позволяет ему заходить и без Google в будущем.
 *              Следующий шаг: /onboarding/complete-profile.
 * created: 2026-04-28
 * --- */

'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Eye, EyeOff } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { humanizeError } from '@/lib/format/error';

export default function SetPasswordPage() {
  const router = useRouter();
  const [loaded, setLoaded] = useState(false);
  const [email, setEmail] = useState('');
  const [pwd, setPwd] = useState('');
  const [pwd2, setPwd2] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (!cancelled) router.replace('/login');
        return;
      }
      // Если пароль уже задан — пропускаем шаг
      const { data: profile } = await supabase
        .from('profiles').select('password_set').eq('id', user.id).single();
      if (cancelled) return;
      if (profile?.password_set) {
        router.replace('/onboarding/complete-profile');
        return;
      }
      setEmail(user.email ?? '');
      setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pwd.length < 6) { toast.error('Минимум 6 символов'); return; }
    if (pwd !== pwd2) { toast.error('Пароли не совпадают'); return; }
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: pwd });
    if (error) {
      setSaving(false);
      toast.error(humanizeError(error));
      return;
    }
    // Помечаем профиль — пароль установлен
    const res = await fetch('/api/onboarding/set-password-flag', { method: 'POST' });
    if (!res.ok) {
      setSaving(false);
      toast.error('Не удалось сохранить состояние. Попробуй ещё раз.');
      return;
    }
    toast.success('Пароль сохранён');
    router.replace('/onboarding/complete-profile');
  }

  return (
    <div
      className="fixed inset-0 overflow-y-auto"
      style={{
        background:
          'radial-gradient(120% 80% at 50% -10%, rgba(45,212,191,0.10), transparent 60%), #141417',
      }}
    >
      <div className="mx-auto flex min-h-full max-w-md flex-col justify-center px-6 py-12 md:py-16">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto mb-6 flex size-14 items-center justify-center rounded-2xl"
          style={{
            background: 'rgba(45,212,191,0.14)',
            border: '1px solid rgba(45,212,191,0.3)',
          }}
        >
          <span className="text-xl font-bold" style={{ color: '#2dd4bf', letterSpacing: '-0.02em' }}>
            C
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="text-center text-3xl font-semibold leading-tight tracking-tight md:text-4xl"
          style={{ color: '#fafafa', letterSpacing: '-0.02em' }}
        >
          Придумай пароль
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="mt-3 text-center text-sm md:text-[15px]"
          style={{ color: '#a1a1aa' }}
        >
          {email ? <>Аккаунт <strong style={{ color: '#fafafa' }}>{email}</strong>.</> : null}
          <br />
          Пароль нужен, чтобы заходить и без Google.
        </motion.p>

        {!loaded ? (
          <div className="mt-10 h-64 animate-pulse rounded-2xl" style={{ background: '#1a1a1d' }} />
        ) : (
          <motion.form
            onSubmit={handleSubmit}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mt-8 flex flex-col gap-3"
          >
            <Field label="Пароль">
              <div style={{ position: 'relative' }}>
                <input
                  className="cp-input"
                  type={showPwd ? 'text' : 'password'}
                  value={pwd}
                  onChange={(e) => setPwd(e.target.value)}
                  required
                  minLength={6}
                  autoFocus
                  autoComplete="new-password"
                  placeholder="Минимум 6 символов"
                  style={{ paddingRight: 44 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  tabIndex={-1}
                  style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', color: '#a1a1aa',
                    display: 'flex', alignItems: 'center',
                  }}
                >
                  {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </Field>

            <Field label="Повтори пароль">
              <input
                className="cp-input"
                type={showPwd ? 'text' : 'password'}
                value={pwd2}
                onChange={(e) => setPwd2(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </Field>

            <button
              type="submit"
              disabled={saving}
              className="mt-2 h-12 rounded-2xl font-semibold transition-all"
              style={{
                background: '#2dd4bf',
                color: '#0a0a0a',
                opacity: saving ? 0.55 : 1,
                cursor: saving ? 'not-allowed' : 'pointer',
                fontSize: 14,
                boxShadow: '0 8px 24px rgba(45,212,191,0.25)',
              }}
            >
              {saving ? 'Сохраняю…' : 'Продолжить'}
            </button>
          </motion.form>
        )}
      </div>

      <style>{`
        .cp-input {
          width: 100%; height: 46px; padding: 0 14px;
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,0.08);
          background: #1a1a1d;
          color: #fafafa;
          font-size: 14px;
          outline: none;
          transition: border-color .15s ease, background .15s ease;
        }
        .cp-input::placeholder { color: rgba(250,250,250,0.35); }
        .cp-input:focus {
          border-color: rgba(45,212,191,0.7);
          background: #1f1f22;
        }
        .cp-label {
          font-size: 12px; font-weight: 600; color: #a1a1aa;
          display: block; margin-bottom: 6px; letter-spacing: 0.01em;
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <span className="cp-label">{label}</span>
      {children}
    </div>
  );
}
