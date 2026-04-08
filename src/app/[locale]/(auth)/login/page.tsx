/** --- YAML
 * name: Login Page
 * description: Login form with email + password, forgot password OTP flow, role-based redirect
 * --- */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { REGEXP_ONLY_DIGITS } from 'input-otp';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from '@/components/ui/input-otp';
import { ArrowLeft, KeyRound, Mail } from 'lucide-react';

type Step = 'login' | 'forgot' | 'reset-otp' | 'new-password';

export default function LoginPage() {
  const t = useTranslations('auth');
  const tc = useTranslations('common');
  const router = useRouter();
  const [step, setStep] = useState<Step>('login');
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpValue, setOtpValue] = useState('');
  const [newPassword, setNewPassword] = useState('');

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const supabase = createClient();

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setLoading(false);
      toast.error(error.message);
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

    if (profile?.role === 'client') {
      router.push('/book');
    } else {
      router.push('/calendar');
    }
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!email) {
      toast.error(t('enterEmail'));
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(t('resetEmailSent'));
    setStep('reset-otp');
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

    // First verify OTP
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: otpValue,
      type: 'recovery',
    });

    if (verifyError) {
      toast.error(t('invalidOTP'));
      setLoading(false);
      setStep('reset-otp');
      setOtpValue('');
      return;
    }

    // Then update password
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(t('passwordUpdated'));
    setStep('login');
    setPassword('');
    setOtpValue('');
    setNewPassword('');
  }

  const slideIn = {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
    transition: { duration: 0.25 },
  };

  return (
    <AnimatePresence mode="wait">
      {step === 'login' && (
        <motion.div key="login" {...slideIn}>
          <Card>
            <CardHeader>
              <CardTitle className="text-center">{t('signIn')}</CardTitle>
            </CardHeader>
            <form onSubmit={handleLogin}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">{t('email')}</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
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
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-4">
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? tc('loading') : t('signIn')}
                </Button>
                <p className="text-sm text-muted-foreground text-center">
                  {t('noAccount')}{' '}
                  <Link href="/register" className="text-primary hover:underline">
                    {t('signUp')}
                  </Link>
                </p>
              </CardFooter>
            </form>
          </Card>
        </motion.div>
      )}

      {step === 'forgot' && (
        <motion.div key="forgot" {...slideIn}>
          <Card>
            <CardHeader className="text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }}
                className="mx-auto mb-2 flex size-14 items-center justify-center rounded-full bg-primary/10"
              >
                <KeyRound className="size-7 text-primary" />
              </motion.div>
              <CardTitle>{t('forgotPassword')}</CardTitle>
              <CardDescription>{t('forgotPasswordDesc')}</CardDescription>
            </CardHeader>
            <form onSubmit={handleForgotPassword}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email">{t('email')}</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-3">
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? tc('loading') : t('sendResetCode')}
                </Button>
                <button
                  type="button"
                  onClick={() => setStep('login')}
                  className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mx-auto"
                >
                  <ArrowLeft className="size-3" />
                  {t('backToLogin')}
                </button>
              </CardFooter>
            </form>
          </Card>
        </motion.div>
      )}

      {step === 'reset-otp' && (
        <motion.div key="reset-otp" {...slideIn}>
          <Card>
            <CardHeader className="text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }}
                className="mx-auto mb-2 flex size-14 items-center justify-center rounded-full bg-primary/10"
              >
                <Mail className="size-7 text-primary" />
              </motion.div>
              <CardTitle>{t('enterOTP')}</CardTitle>
              <CardDescription>
                {t('otpSentTo')} <span className="font-medium text-foreground">{email}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-6">
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

              <Button
                className="w-full"
                onClick={handleVerifyResetOTP}
                disabled={otpValue.length !== 6}
              >
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
            </CardContent>
          </Card>
        </motion.div>
      )}

      {step === 'new-password' && (
        <motion.div key="new-password" {...slideIn}>
          <Card>
            <CardHeader className="text-center">
              <CardTitle>{t('newPassword')}</CardTitle>
              <CardDescription>{t('newPasswordDesc')}</CardDescription>
            </CardHeader>
            <form onSubmit={handleSetNewPassword}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">{t('password')}</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                    autoFocus
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit" className="w-full" disabled={loading || newPassword.length < 6}>
                  {loading ? tc('loading') : t('updatePassword')}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
