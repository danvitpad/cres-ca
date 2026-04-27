/** --- YAML
 * name: Login Page
 * description: Fresha-style login — split layout with OAuth buttons, email input, and password step
 * --- */

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { REGEXP_ONLY_DIGITS } from 'input-otp';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from '@/components/ui/input-otp';
import { ArrowLeft, Eye, EyeOff, Mail } from 'lucide-react';
import { humanizeError } from '@/lib/format/error';

type Step = 'email' | 'password' | 'forgot' | 'reset-sent' | 'reset-otp' | 'new-password';

const REMEMBER_KEY = 'cres-ca-remember';

export default function LoginPage() {
  const t = useTranslations('auth');
  const tc = useTranslations('common');
  const router = useRouter();
  const searchParams = useSearchParams();
  const role = searchParams.get('role');

  const [step, setStep] = useState<Step>('email');
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [otpValue, setOtpValue] = useState('');
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    const urlEmail = searchParams.get('email');
    if (urlEmail) {
      setEmail(urlEmail);
      return;
    }
    try {
      const saved = localStorage.getItem(REMEMBER_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.email) setEmail(parsed.email);
      }
    } catch {}
  }, [searchParams]);

  async function handleEmailContinue(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    try {
      const res = await fetch('/api/auth/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const json = (await res.json()) as { exists: boolean; role?: string | null };
      if (json.exists) {
        setStep('password');
      } else {
        router.push(`/register?role=${role ?? 'client'}&email=${encodeURIComponent(email)}`);
      }
    } catch {
      setStep('password');
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    localStorage.setItem(REMEMBER_KEY, JSON.stringify({ email }));
    const supabase = createClient();

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setLoading(false);
      toast.error(humanizeError(error));
      return;
    }

    const user = data.user;
    if (!user) {
      setLoading(false);
      toast.error(tc('error'));
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    // Claim any pending invite stashed by /invite/[code]
    if (profile?.role === 'client') {
      try {
        const res = await fetch('/api/invite/claim', { method: 'POST' });
        const body = (await res.json()) as { master_id?: string };
        if (body.master_id) {
          router.push(`/masters/${body.master_id}`);
          return;
        }
      } catch {}
      router.push('/feed');
    } else {
      router.push('/calendar');
    }
  }

  async function handleOAuthLogin(provider: 'google' | 'facebook') {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/api/auth/callback` },
    });
    if (error) toast.error(humanizeError(error));
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!email) { toast.error(t('enterEmail')); return; }
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    setLoading(false);
    if (error) { toast.error(humanizeError(error)); return; }
    setStep('reset-sent');
  }

  async function handleVerifyResetOTP() {
    if (otpValue.length !== 6) return;
    setStep('new-password');
  }

  async function handleSetNewPassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 6) return;
    setLoading(true);
    const supabase = createClient();

    const { error: verifyError } = await supabase.auth.verifyOtp({
      email, token: otpValue, type: 'recovery',
    });
    if (verifyError) {
      toast.error(t('invalidOTP'));
      setLoading(false);
      setStep('reset-otp');
      setOtpValue('');
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);
    if (error) { toast.error(humanizeError(error)); return; }
    toast.success(t('passwordUpdated'));
    setStep('email');
    setPassword('');
    setOtpValue('');
    setNewPassword('');
  }

  const slideIn = {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10 },
    transition: { duration: 0.2 },
  };

  const isBusinessFlow = role === 'business';
  const title = isBusinessFlow ? t('userFlowBusiness') : t('userFlowClient');
  const desc = isBusinessFlow ? t('userFlowBusinessDesc') : t('userFlowClientDesc');
  const switchRole = isBusinessFlow ? 'client' : 'business';
  const switchLabel = isBusinessFlow ? t('userFlowClient') : t('userFlowBusiness');

  return (
    <div className="fixed inset-0 z-50 flex bg-background">
      {/* Left side — form */}
      <div className="relative flex w-full flex-col justify-between p-6 md:w-1/2 md:p-10 lg:p-16">
        {/* Back */}
        <div>
          <Link
            href="/user-flow"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-4" />
            {tc('back')}
          </Link>
        </div>

        {/* Form — centered */}
        <div className="flex flex-col gap-6 max-w-sm mx-auto w-full">
          <AnimatePresence mode="wait">
            {/* STEP: Email (client) or Email+Password (business) */}
            {step === 'email' && !isBusinessFlow && (
              <motion.div key="email" {...slideIn} className="flex flex-col gap-6">
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
                  <p className="text-sm text-muted-foreground mt-1">{desc}</p>
                </div>

                {/* OAuth buttons */}
                <div className="flex flex-col gap-3">
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-3 h-11"
                    onClick={() => handleOAuthLogin('facebook')}
                  >
                    <svg className="size-5" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                    {t('continueWithFacebook')}
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-3 h-11"
                    onClick={() => handleOAuthLogin('google')}
                  >
                    <svg className="size-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                    {t('continueWithGoogle')}
                  </Button>
                </div>

                {/* Divider */}
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs text-muted-foreground uppercase">{tc('or')}</span>
                  <div className="h-px flex-1 bg-border" />
                </div>

                {/* Email */}
                <form onSubmit={handleEmailContinue} className="flex flex-col gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">{t('email')}</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder={t('email')}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoFocus
                      className="h-11"
                    />
                  </div>
                  <Button type="submit" className="w-full h-11" disabled={loading}>
                    {loading ? tc('loading') : t('continue')}
                  </Button>
                </form>

                {/* Register link */}
                <p className="text-sm text-muted-foreground text-center">
                  {t('noAccount')}{' '}
                  <Link href={`/register?role=client&email=${encodeURIComponent(email)}`} className="text-primary hover:underline">
                    {t('signUp')}
                  </Link>
                </p>
              </motion.div>
            )}

            {/* STEP: Business — email + password upfront, OAuth below */}
            {step === 'email' && isBusinessFlow && (
              <motion.div key="business-email" {...slideIn} className="flex flex-col gap-6">
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
                  <p className="text-sm text-muted-foreground mt-1">{desc}</p>
                </div>

                <form onSubmit={handleLogin} className="flex flex-col gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">{t('email')}</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder={t('email')}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoFocus
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">{t('password')}</Label>
                      <button
                        type="button"
                        onClick={() => setStep('forgot')}
                        className="text-xs text-muted-foreground hover:text-primary transition-colors"
                      >
                        {t('forgotPassword')}
                      </button>
                    </div>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="h-11 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>
                  <Button type="submit" className="w-full h-11" disabled={loading}>
                    {loading ? tc('loading') : t('continue')}
                  </Button>
                </form>

                {/* Divider */}
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs text-muted-foreground uppercase">{tc('or')}</span>
                  <div className="h-px flex-1 bg-border" />
                </div>

                {/* OAuth */}
                <div className="flex flex-col gap-3">
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-3 h-11"
                    onClick={() => handleOAuthLogin('facebook')}
                  >
                    <svg className="size-5" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                    {t('continueWithFacebook')}
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-3 h-11"
                    onClick={() => handleOAuthLogin('google')}
                  >
                    <svg className="size-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                    {t('continueWithGoogle')}
                  </Button>
                </div>

                {/* Register link */}
                <p className="text-sm text-muted-foreground text-center">
                  {t('noAccount')}{' '}
                  <Link href={`/register?role=business&email=${encodeURIComponent(email)}`} className="text-primary hover:underline">
                    {t('signUp')}
                  </Link>
                </p>
              </motion.div>
            )}

            {/* STEP: Password */}
            {step === 'password' && (
              <motion.div key="password" {...slideIn} className="flex flex-col gap-6">
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight">{t('signIn')}</h1>
                  <p className="text-sm text-muted-foreground mt-1">{email}</p>
                </div>

                <form onSubmit={handleLogin} className="flex flex-col gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">{t('password')}</Label>
                      <button
                        type="button"
                        onClick={() => setStep('forgot')}
                        className="text-xs text-muted-foreground hover:text-primary transition-colors"
                      >
                        {t('forgotPassword')}
                      </button>
                    </div>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        autoFocus
                        className="h-11 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>
                  <Button type="submit" className="w-full h-11" disabled={loading}>
                    {loading ? tc('loading') : t('signIn')}
                  </Button>
                </form>

                <button
                  type="button"
                  onClick={() => setStep('email')}
                  className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mx-auto"
                >
                  <ArrowLeft className="size-3" />
                  {t('differentEmail')}
                </button>
              </motion.div>
            )}

            {/* STEP: Forgot password — Fresha-style centered card */}
            {step === 'forgot' && (
              <motion.div key="forgot" {...slideIn} className="flex flex-col gap-6 text-center">
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight">{t('forgotPasswordTitle')}</h1>
                  <p className="text-sm text-muted-foreground mt-2">
                    {t('forgotPasswordHint')}{' '}
                    <span className="font-medium text-foreground">{email || t('email')}</span>
                  </p>
                </div>
                <form onSubmit={handleForgotPassword} className="flex flex-col gap-4 text-left">
                  {!email && (
                    <div className="space-y-2">
                      <Label htmlFor="reset-email">{t('email')}</Label>
                      <Input
                        id="reset-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        autoFocus
                        className="h-11"
                      />
                    </div>
                  )}
                  <Button type="submit" className="w-full h-11" disabled={loading}>
                    {loading ? tc('loading') : t('sendResetCode')}
                  </Button>
                </form>
                <div className="border-t pt-4 text-sm">
                  <p className="font-medium">{t('businessAccountQ')}</p>
                  <Link href="/login?role=business" className="text-primary hover:underline">
                    {t('signInAsBusiness')}
                  </Link>
                </div>
                <button
                  type="button"
                  onClick={() => setStep('password')}
                  className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mx-auto"
                >
                  <ArrowLeft className="size-3" />
                  {t('backToLogin')}
                </button>
              </motion.div>
            )}

            {/* STEP: Reset email sent confirmation */}
            {step === 'reset-sent' && (
              <motion.div key="reset-sent" {...slideIn} className="flex flex-col gap-6 text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 18 }}
                  className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10"
                >
                  <Mail className="size-7 text-primary" />
                </motion.div>
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight leading-snug">
                    {t('resetSentTitle')}
                  </h1>
                  <p className="text-sm font-medium text-foreground mt-2">{email}</p>
                  <p className="text-sm text-muted-foreground mt-3">
                    {t('resetSentDesc')}
                  </p>
                </div>
                <Button onClick={() => setStep('email')} className="w-full h-11">
                  {t('continueLogin')}
                </Button>
                <button
                  type="button"
                  onClick={() => setStep('reset-otp')}
                  className="text-sm text-primary hover:underline"
                >
                  {t('enterOTP')}
                </button>
              </motion.div>
            )}

            {/* STEP: Reset OTP */}
            {step === 'reset-otp' && (
              <motion.div key="reset-otp" {...slideIn} className="flex flex-col gap-6 items-center">
                <div className="text-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }}
                    className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-primary/10"
                  >
                    <Mail className="size-7 text-primary" />
                  </motion.div>
                  <h1 className="text-2xl font-semibold tracking-tight">{t('enterOTP')}</h1>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t('otpSentTo')} <span className="font-medium text-foreground">{email}</span>
                  </p>
                </div>
                <InputOTP
                  maxLength={6}
                  pattern={REGEXP_ONLY_DIGITS}
                  value={otpValue}
                  onChange={setOtpValue}
                  onComplete={handleVerifyResetOTP}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                  </InputOTPGroup>
                  <InputOTPSeparator />
                  <InputOTPGroup>
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
                <Button className="w-full h-11" onClick={handleVerifyResetOTP} disabled={otpValue.length !== 6}>
                  {tc('next')}
                </Button>
                <button
                  type="button"
                  onClick={() => { setStep('forgot'); setOtpValue(''); }}
                  className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  <ArrowLeft className="size-3" />
                  {tc('back')}
                </button>
              </motion.div>
            )}

            {/* STEP: New password */}
            {step === 'new-password' && (
              <motion.div key="new-password" {...slideIn} className="flex flex-col gap-6">
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight">{t('newPassword')}</h1>
                  <p className="text-sm text-muted-foreground mt-1">{t('newPasswordDesc')}</p>
                </div>
                <form onSubmit={handleSetNewPassword} className="flex flex-col gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-password">{t('password')}</Label>
                    <div className="relative">
                      <Input
                        id="new-password"
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        minLength={6}
                        autoFocus
                        className="h-11 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        tabIndex={-1}
                      >
                        {showNewPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>
                  <Button type="submit" className="w-full h-11" disabled={loading || newPassword.length < 6}>
                    {loading ? tc('loading') : t('updatePassword')}
                  </Button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Bottom — switch role link */}
        <div className="text-center text-sm text-muted-foreground">
          {isBusinessFlow ? t('isClient') : t('hasBusinessAccount')}{' '}
          <Link href={`/login?role=${switchRole}`} className="text-primary hover:underline">
            {switchLabel}
          </Link>
        </div>
      </div>

      {/* Right side — hero */}
      <div className="hidden md:block md:w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-primary/10 to-amber-500/20" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center space-y-4 px-8">
            <div className="mx-auto flex size-20 items-center justify-center rounded-2xl bg-white/90 shadow-lg backdrop-blur-sm">
              <span className="text-3xl font-bold text-primary">C</span>
            </div>
            <h2 className="text-xl font-semibold text-foreground/80">CRES-CA</h2>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              {t('platformDesc')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
