/** --- YAML
 * name: OnboardingCompleteProfile
 * description: Промежуточный экран после Google OAuth — добираем имя/фамилию/
 *              телефон/ДР. Google не передаёт ничего кроме email + (опц.) name.
 *              Подтверждение email пропускаем — Google уже верифицировал.
 *              После сохранения: client → /feed, master/salon_admin → /onboarding/account-type.
 * created: 2026-04-28
 * --- */

'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { humanizeError } from '@/lib/format/error';

type Role = 'client' | 'master' | 'salon_admin';

export default function CompleteProfilePage() {
  const router = useRouter();
  const [loaded, setLoaded] = useState(false);
  const [role, setRole] = useState<Role>('client');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [dob, setDob] = useState('');
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (!cancelled) router.replace('/login');
        return;
      }
      const md = (user.user_metadata ?? {}) as Record<string, unknown>;
      // Google отдаёт `full_name` или `name`, иногда `given_name` + `family_name`.
      const fn = (typeof md.given_name === 'string' && md.given_name) ||
                 (typeof md.first_name === 'string' && md.first_name) ||
                 ((typeof md.full_name === 'string' && md.full_name.split(' ')[0]) ||
                  (typeof md.name === 'string' && md.name.split(' ')[0])) || '';
      const ln = (typeof md.family_name === 'string' && md.family_name) ||
                 (typeof md.last_name === 'string' && md.last_name) ||
                 ((typeof md.full_name === 'string' && md.full_name.split(' ').slice(1).join(' ')) ||
                  (typeof md.name === 'string' && md.name.split(' ').slice(1).join(' '))) || '';
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, phone, date_of_birth, full_name')
        .eq('id', user.id)
        .single();
      if (cancelled) return;
      const r = (profile?.role as Role) ?? 'client';
      setRole(r);
      setEmail(user.email ?? '');
      setFirstName(fn || (profile?.full_name?.split(' ')[0] ?? ''));
      setLastName(ln || (profile?.full_name?.split(' ').slice(1).join(' ') ?? ''));
      const existingPhone = (profile?.phone || '').replace(/^\+?380/, '');
      setPhone(existingPhone);
      setDob(profile?.date_of_birth || '');
      setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!firstName.trim()) { toast.error('Введи имя'); return; }
    if (!lastName.trim()) { toast.error('Введи фамилию'); return; }
    if (!phone.trim() || phone.length < 9) { toast.error('Введи телефон'); return; }
    if (role !== 'salon_admin' && !dob) { toast.error('Введи дату рождения'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/auth/complete-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          phone: phone ? `+380${phone}` : '',
          date_of_birth: dob || null,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { next?: string; error?: string };
      if (!res.ok) {
        toast.error(humanizeError({ message: j.error || 'Не удалось сохранить' }));
        setSaving(false);
        return;
      }
      router.replace(j.next || '/onboarding/account-type');
    } catch (err) {
      toast.error(humanizeError(err));
      setSaving(false);
    }
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
          Расскажи о себе
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="mt-3 text-center text-sm md:text-[15px]"
          style={{ color: '#a1a1aa' }}
        >
          {email ? <>Почта <strong style={{ color: '#fafafa' }}>{email}</strong> подтверждена через Google.</> : null}
          <br />
          Ещё пара полей, и приступим.
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
            <div className="grid grid-cols-2 gap-3">
              <Field label="Имя">
                <input
                  className="cp-input"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  autoFocus
                />
              </Field>
              <Field label="Фамилия">
                <input
                  className="cp-input"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                />
              </Field>
            </div>

            <Field label="Телефон">
              <div className="cp-phone-wrap">
                <span className="cp-phone-prefix">+380</span>
                <input
                  type="tel"
                  inputMode="numeric"
                  className="cp-input cp-phone-input"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 9))}
                  placeholder="501234567"
                  required
                />
              </div>
            </Field>

            {role !== 'salon_admin' && (
              <Field label="Дата рождения">
                <DobInput value={dob} onChange={setDob} />
              </Field>
            )}

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
        .cp-phone-wrap {
          display: flex; align-items: stretch; height: 46px;
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,0.08);
          background: #1a1a1d;
          overflow: hidden;
          transition: border-color .15s ease, background .15s ease;
        }
        .cp-phone-wrap:focus-within {
          border-color: rgba(45,212,191,0.7);
          background: #1f1f22;
        }
        .cp-phone-prefix {
          padding: 0 12px;
          display: flex; align-items: center;
          font-size: 13px; color: #a1a1aa;
          border-right: 1px solid rgba(255,255,255,0.08);
        }
        .cp-phone-input {
          border: none !important; border-radius: 0 !important;
          background: transparent !important;
          flex: 1; padding-left: 12px;
        }
        .cp-phone-input:focus { background: transparent !important; }
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

/** ДР input — DD.MM.YYYY → ISO. Локальный inline компонент. */
function DobInput({ value, onChange }: { value: string; onChange: (iso: string) => void }) {
  const isoToDmy = (iso: string) => {
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? `${m[3]}.${m[2]}.${m[1]}` : '';
  };
  const [text, setText] = useState(isoToDmy(value));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setText(isoToDmy(value)); }, [value]);

  function handleChange(raw: string) {
    const digits = raw.replace(/\D/g, '').slice(0, 8);
    let formatted = digits;
    if (digits.length > 4) formatted = `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`;
    else if (digits.length > 2) formatted = `${digits.slice(0, 2)}.${digits.slice(2)}`;
    setText(formatted);

    if (digits.length === 0) { setError(null); onChange(''); return; }
    const full = formatted.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (!full) { setError(null); onChange(''); return; }
    const [, d, m, y] = full;
    const day = +d, month = +m, year = +y;
    const currentYear = new Date().getFullYear();
    if (month < 1 || month > 12) { setError('Месяц 01–12'); onChange(''); return; }
    if (year < 1900 || year > currentYear) { setError(`Год 1900–${currentYear}`); onChange(''); return; }
    const cand = new Date(year, month - 1, day);
    const ok = cand.getFullYear() === year && cand.getMonth() === month - 1 && cand.getDate() === day;
    if (!ok) { setError(`В ${m}.${y} нет ${day}-го`); onChange(''); return; }
    if (cand.getTime() > Date.now()) { setError('Дата в будущем'); onChange(''); return; }
    setError(null);
    onChange(`${y}-${m}-${d}`);
  }

  return (
    <div>
      <input
        className="cp-input"
        type="text"
        inputMode="numeric"
        autoComplete="bday"
        placeholder="ДД.ММ.ГГГГ"
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        style={error ? { borderColor: '#ef4444' } : undefined}
        aria-invalid={!!error}
      />
      {error && (
        <p style={{ fontSize: 11, color: '#ef4444', marginTop: 4, lineHeight: 1.3 }}>{error}</p>
      )}
    </div>
  );
}
