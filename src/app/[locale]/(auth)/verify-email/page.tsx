/** --- YAML
 * name: VerifyEmail
 * description: Сторінка підтвердження email — 8-значний OTP код. Читає ?email= з URL, дозволяє ввести код і перевірити через Supabase verifyOtp.
 * created: 2026-05-16
 * updated: 2026-05-16
 * --- */

'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { toast } from 'sonner';
import { ArrowLeft, Mail } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const ACCENT = '#2563eb';
const RESEND_SECONDS = 60;

export default function VerifyEmailPage() {
  const supabase = createClient();
  const router = useRouter();
  const locale = useLocale();
  const sp = useSearchParams();
  const email = sp.get('email') ?? '';

  const [digits, setDigits] = useState<string[]>(Array(8).fill(''));
  const [verifying, setVerifying] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(RESEND_SECONDS);
  const [resending, setResending] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = setInterval(() => setResendCountdown((n) => n - 1), 1000);
    return () => clearInterval(timer);
  }, [resendCountdown]);

  function handleInput(idx: number, value: string) {
    const char = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[idx] = char;
    setDigits(next);
    if (char && idx < 7) {
      inputRefs.current[idx + 1]?.focus();
    }
  }

  function handleKeyDown(idx: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[idx] && idx > 0) {
      inputRefs.current[idx - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 8);
    if (!text) return;
    const next = [...digits];
    for (let i = 0; i < text.length; i++) next[i] = text[i];
    setDigits(next);
    const focusIdx = Math.min(text.length, 7);
    inputRefs.current[focusIdx]?.focus();
  }

  async function verify() {
    const token = digits.join('');
    if (token.length < 8) { toast.error('Введіть всі 8 цифр'); return; }
    if (!email) { toast.error('Email не знайдено'); return; }
    setVerifying(true);
    const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
    setVerifying(false);
    if (error) { toast.error('Невірний або застарілий код'); return; }
    toast.success('Email підтверджено!');
    router.replace(`/${locale}/onboarding`);
  }

  async function resend() {
    if (!email || resendCountdown > 0) return;
    setResending(true);
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    setResending(false);
    if (error) { toast.error('Не вдалося надіслати'); return; }
    toast.success('Код надіслано повторно');
    setResendCountdown(RESEND_SECONDS);
    setDigits(Array(8).fill(''));
    inputRefs.current[0]?.focus();
  }

  return (
    <div style={{ minHeight: '100dvh', background: '#f8fafc', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 20px 40px' }}>
      <div style={{ width: '100%', maxWidth: 440 }}>
        {/* Back button */}
        <div style={{ padding: '20px 0 0' }}>
          <button
            type="button"
            onClick={() => router.back()}
            style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: '#f1f5f9', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <ArrowLeft style={{ width: 16, height: 16 }} />
          </button>
        </div>

        {/* Icon */}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 32 }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: `${ACCENT}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Mail style={{ width: 32, height: 32, color: ACCENT }} />
          </div>
        </div>

        {/* Headline */}
        <div style={{ textAlign: 'center', marginTop: 20, marginBottom: 32 }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#0f172a' }}>Підтвердь email</div>
          <div style={{ fontSize: 14, color: '#64748b', marginTop: 8, lineHeight: 1.5 }}>
            Ми надіслали 8-значний код на<br />
            {email && <strong style={{ color: '#0f172a' }}>{email}</strong>}
          </div>
        </div>

        {/* OTP inputs */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 12 }} onPaste={handlePaste}>
          {digits.map((d, idx) => (
            <input
              key={idx}
              ref={(el) => { inputRefs.current[idx] = el; }}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={1}
              value={d}
              onChange={(e) => handleInput(idx, e.target.value)}
              onKeyDown={(e) => handleKeyDown(idx, e)}
              style={{
                width: 44,
                height: 52,
                borderRadius: 12,
                border: `2px solid ${d ? ACCENT : '#e2e8f0'}`,
                background: d ? `${ACCENT}08` : '#fff',
                textAlign: 'center',
                fontSize: 20,
                fontWeight: 700,
                color: '#0f172a',
                outline: 'none',
                caretColor: ACCENT,
                transition: 'border-color 150ms',
              }}
            />
          ))}
        </div>

        {/* Countdown */}
        <div style={{ textAlign: 'center', fontSize: 12, color: '#64748b', marginBottom: 24 }}>
          {resendCountdown > 0 ? (
            <>Повторно надіслати через <strong style={{ color: ACCENT }}>{String(Math.floor(resendCountdown / 60)).padStart(2, '0')}:{String(resendCountdown % 60).padStart(2, '0')}</strong></>
          ) : (
            <>Не отримали лист? </>
          )}
        </div>

        {/* Verify button */}
        <button
          type="button"
          onClick={verify}
          disabled={verifying || digits.join('').length < 8}
          style={{ width: '100%', padding: '14px 0', borderRadius: 14, border: 'none', background: ACCENT, color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer', opacity: verifying || digits.join('').length < 8 ? 0.6 : 1 }}
        >
          {verifying ? 'Перевірка…' : 'Підтвердити'}
        </button>

        {/* Resend */}
        <div style={{ textAlign: 'center', fontSize: 13, color: '#64748b', marginTop: 16 }}>
          {resendCountdown <= 0 && (
            <button
              type="button"
              onClick={resend}
              disabled={resending}
              style={{ background: 'none', border: 'none', color: ACCENT, fontSize: 13, fontWeight: 500, cursor: 'pointer', textDecoration: 'underline' }}
            >
              {resending ? 'Надсилаємо…' : 'Надіслати знову'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
