/** --- YAML
 * name: MiniAppSettingsPage
 * description: Mini App settings — email, phone, password, language, privacy, help, sign out.
 * created: 2026-04-14
 * updated: 2026-04-16
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  LogOut,
  User,
  Globe,
  Shield,
  HelpCircle,
  Loader2,
  Mail,
  Phone as PhoneIcon,
  KeyRound,
  X,
  Check,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { useTelegram } from '@/components/miniapp/telegram-provider';
import { mapError } from '@/lib/errors';

export default function MiniAppSettingsPage() {
  const router = useRouter();
  const { haptic } = useTelegram();
  const { userId, clearAuth } = useAuthStore();
  const [signingOut, setSigningOut] = useState(false);

  // Contact info
  const [email, setEmail] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);

  // Edit contact modal
  const [contactOpen, setContactOpen] = useState(false);
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [contactBusy, setContactBusy] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);
  const [emailConfirmSent, setEmailConfirmSent] = useState(false);

  // Password change
  const [pwOpen, setPwOpen] = useState(false);
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const stash = sessionStorage.getItem('cres:tg');
      const initData = stash ? JSON.parse(stash).initData : null;
      if (initData) {
        const res = await fetch('/api/telegram/me', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ initData }),
        });
        if (res.ok) {
          const { profile: data } = await res.json();
          setEmail(data.email ?? null);
          setPhone(data.phone ?? null);
        }
      }
    })();
  }, [userId]);

  function openContactEdit() {
    setEditPhone(phone ? phone.replace(/^\+380/, '') : '');
    setEditEmail(email ?? '');
    setContactError(null);
    setEmailConfirmSent(false);
    setContactOpen(true);
    haptic('light');
  }

  async function saveContact() {
    if (contactBusy) return;
    setContactBusy(true);
    setContactError(null);
    try {
      const emailChanged = editEmail.trim().toLowerCase() !== (email ?? '').toLowerCase();
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: editPhone.trim(),
          email: editEmail.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setContactError(mapError(data.error, 'Не удалось сохранить'));
        haptic('error');
        return;
      }
      setPhone(editPhone.trim() ? `+380${editPhone.replace(/\D/g, '').replace(/^380/, '')}` : null);
      if (!emailChanged) setEmail(editEmail.trim() || null);
      haptic('success');
      if (emailChanged && editEmail.trim()) {
        setEmailConfirmSent(true);
      } else {
        setContactOpen(false);
      }
    } catch (e) {
      setContactError(mapError(e instanceof Error ? e.message : 'network_error'));
    } finally {
      setContactBusy(false);
    }
  }

  async function savePassword() {
    if (pwBusy) return;
    setPwError(null);
    if (pwNew.length < 6) {
      setPwError('Пароль должен быть не короче 6 символов');
      return;
    }
    if (pwNew !== pwConfirm) {
      setPwError('Пароли не совпадают');
      return;
    }
    setPwBusy(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pwNew }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPwError(mapError(data.error, 'Не удалось сменить пароль'));
        haptic('error');
        return;
      }
      haptic('success');
      setPwSuccess(true);
      setPwNew('');
      setPwConfirm('');
      setTimeout(() => {
        setPwOpen(false);
        setPwSuccess(false);
      }, 1400);
    } finally {
      setPwBusy(false);
    }
  }

  async function signOut() {
    if (signingOut) return;
    haptic('medium');
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    clearAuth();
    try {
      sessionStorage.removeItem('cres:tg');
    } catch {}
    router.replace('/telegram');
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="space-y-5 px-5 pt-4 pb-20"
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="flex size-9 items-center justify-center rounded-full bg-white/5"
            aria-label="Назад"
          >
            <ChevronLeft className="size-5" />
          </button>
          <h1 className="text-[22px] font-bold">Настройки</h1>
        </div>

        {/* Account */}
        <ul className="divide-y divide-white/5 rounded-2xl border border-white/10 bg-white/5">
          <li>
            <Link
              href="/telegram/profile"
              onClick={() => haptic('light')}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
            >
              <div className="flex size-9 items-center justify-center rounded-xl bg-white/5">
                <User className="size-4" />
              </div>
              <div className="flex-1">
                <p className="text-sm">Аккаунт</p>
                <p className="text-[11px] text-white/45">Имя, CRES-ID, био</p>
              </div>
              <ChevronRight className="size-4 text-white/40" />
            </Link>
          </li>
        </ul>

        {/* Contact info */}
        <ul className="divide-y divide-white/5 rounded-2xl border border-white/10 bg-white/5">
          <li>
            <button
              onClick={openContactEdit}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
            >
              <div className="flex size-9 items-center justify-center rounded-xl bg-white/5">
                <Mail className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm">Email</p>
                <p className="truncate text-[11px] text-white/45">{email ?? 'Не указан'}</p>
              </div>
              <ChevronRight className="size-4 text-white/40" />
            </button>
          </li>
          <li>
            <button
              onClick={openContactEdit}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
            >
              <div className="flex size-9 items-center justify-center rounded-xl bg-white/5">
                <PhoneIcon className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm">Телефон</p>
                <p className="truncate text-[11px] text-white/45">{phone ?? 'Не указан'}</p>
              </div>
              <ChevronRight className="size-4 text-white/40" />
            </button>
          </li>
          <li>
            <button
              onClick={() => {
                setPwNew('');
                setPwConfirm('');
                setPwError(null);
                setPwSuccess(false);
                setPwOpen(true);
                haptic('light');
              }}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
            >
              <div className="flex size-9 items-center justify-center rounded-xl bg-white/5">
                <KeyRound className="size-4" />
              </div>
              <div className="flex-1">
                <p className="text-sm">Сменить пароль</p>
              </div>
              <ChevronRight className="size-4 text-white/40" />
            </button>
          </li>
        </ul>

        {/* General */}
        <ul className="divide-y divide-white/5 rounded-2xl border border-white/10 bg-white/5">
          <Row icon={Globe} label="Язык" hint="Русский" onClick={() => haptic('light')} />
          <Row icon={Shield} label="Приватность" hint="Видимость профиля" onClick={() => haptic('light')} />
          <Row icon={HelpCircle} label="Помощь" hint="FAQ и поддержка" onClick={() => haptic('light')} />
        </ul>

        <button
          onClick={signOut}
          disabled={signingOut}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 py-4 text-[14px] font-semibold text-rose-200 active:scale-[0.98] transition-transform disabled:opacity-60"
        >
          {signingOut ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}
          Выйти из аккаунта
        </button>
      </motion.div>

      {/* Contact edit modal */}
      <AnimatePresence>
        {contactOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm"
            onClick={() => !contactBusy && setContactOpen(false)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-md rounded-t-[32px] border-t border-white/10 bg-[#2f3437] p-5"
              style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-bold">Контактные данные</h3>
                <button
                  onClick={() => !contactBusy && setContactOpen(false)}
                  className="flex size-9 items-center justify-center rounded-full bg-white/5"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
                    Email
                  </label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value.slice(0, 120))}
                    placeholder="you@example.com"
                    className="mt-1 w-full bg-transparent text-base outline-none placeholder:text-white/30"
                  />
                  {emailConfirmSent && (
                    <p className="mt-2 text-[11px] text-emerald-300">
                      Письмо с подтверждением отправлено. Откройте его, чтобы завершить смену email.
                    </p>
                  )}
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
                    Телефон
                  </label>
                  <div className="mt-1 flex items-center gap-2 text-base">
                    <span className="text-white/40">+380</span>
                    <input
                      type="tel"
                      inputMode="numeric"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value.replace(/\D/g, '').slice(0, 9))}
                      placeholder="501234567"
                      className="w-full bg-transparent outline-none placeholder:text-white/30"
                    />
                  </div>
                </div>

                {contactError && (
                  <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">
                    {contactError}
                  </div>
                )}

                <button
                  onClick={saveContact}
                  disabled={contactBusy}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-4 text-[15px] font-semibold text-black active:scale-[0.98] transition-transform disabled:opacity-60"
                >
                  {contactBusy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                  Сохранить
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Password change modal */}
      <AnimatePresence>
        {pwOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm"
            onClick={() => !pwBusy && setPwOpen(false)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-md rounded-t-[32px] border-t border-white/10 bg-[#2f3437] p-5"
              style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-bold">Сменить пароль</h3>
                <button
                  onClick={() => !pwBusy && setPwOpen(false)}
                  className="flex size-9 items-center justify-center rounded-full bg-white/5"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
                    Новый пароль
                  </label>
                  <input
                    type="password"
                    value={pwNew}
                    onChange={(e) => setPwNew(e.target.value.slice(0, 72))}
                    placeholder="Минимум 6 символов"
                    autoComplete="new-password"
                    className="mt-1 w-full bg-transparent text-base outline-none placeholder:text-white/30"
                  />
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
                    Повторите пароль
                  </label>
                  <input
                    type="password"
                    value={pwConfirm}
                    onChange={(e) => setPwConfirm(e.target.value.slice(0, 72))}
                    placeholder="Ещё раз"
                    autoComplete="new-password"
                    className="mt-1 w-full bg-transparent text-base outline-none placeholder:text-white/30"
                  />
                </div>

                {pwError && (
                  <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">
                    {pwError}
                  </div>
                )}
                {pwSuccess && (
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-200">
                    Пароль обновлён
                  </div>
                )}

                <button
                  onClick={savePassword}
                  disabled={pwBusy || pwSuccess}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-4 text-[15px] font-semibold text-black active:scale-[0.98] transition-transform disabled:opacity-60"
                >
                  {pwBusy ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
                  Сохранить пароль
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function Row({
  icon: Icon,
  label,
  hint,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  hint?: string;
  onClick: () => void;
}) {
  return (
    <li>
      <button onClick={onClick} className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
        <div className="flex size-9 items-center justify-center rounded-xl bg-white/5">
          <Icon className="size-4" />
        </div>
        <div className="flex-1">
          <p className="text-sm">{label}</p>
          {hint && <p className="text-[11px] text-white/45">{hint}</p>}
        </div>
        <ChevronRight className="size-4 text-white/40" />
      </button>
    </li>
  );
}
