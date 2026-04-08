/** --- YAML
 * name: Register Page
 * description: Registration form with OTP email verification via 6-digit code input
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';
import { ArrowLeft, Mail, Shield, Eye, EyeOff } from 'lucide-react';

type Step = 'form' | 'otp';

export default function RegisterPage() {
  const t = useTranslations('auth');
  const tc = useTranslations('common');
  const router = useRouter();
  const [step, setStep] = useState<Step>('form');
  const [loading, setLoading] = useState(false);
  const [otpValue, setOtpValue] = useState('');

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState('client');
  const [phone, setPhone] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error(t('passwordMismatch'));
      return;
    }

    setLoading(true);
    const supabase = createClient();

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, role, phone: phone || undefined },
      },
    });

    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    if (data.user && data.user.identities?.length === 0) {
      toast.error(t('emailAlreadyRegistered'));
      return;
    }

    setStep('otp');
  }

  async function handleVerifyOTP() {
    if (otpValue.length !== 6) return;
    setLoading(true);
    const supabase = createClient();

    const { error } = await supabase.auth.verifyOtp({
      email,
      token: otpValue,
      type: 'signup',
    });

    setLoading(false);

    if (error) {
      toast.error(t('invalidOTP'));
      setOtpValue('');
      return;
    }

    toast.success(t('verificationSuccess'));

    if (role === 'client') {
      router.push('/book');
    } else {
      router.push('/calendar');
    }
  }

  async function handleResendOTP() {
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(t('otpResent'));
    }
  }

  return (
    <AnimatePresence mode="wait">
      {step === 'form' && (
        <motion.div
          key="form"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-center">{t('signUp')}</CardTitle>
              <CardDescription className="text-center">{t('createAccountDesc')}</CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">{t('fullName')}</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">{t('email')}</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">{t('password')}</Label>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      placeholder={t('password')}
                    />
                    <Input
                      id="confirmPassword"
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={6}
                      placeholder={t('confirmPassword')}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{t('selectRole')}</Label>
                  <Select value={role} onValueChange={(v) => v && setRole(v)}>
                    <SelectTrigger className="w-full">
                      <span>{role === 'client' ? t('roleClient') : role === 'master' ? t('roleMaster') : t('roleSalon')}</span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="client">{t('roleClient')}</SelectItem>
                      <SelectItem value="master">{t('roleMaster')}</SelectItem>
                      <SelectItem value="salon_admin">{t('roleSalon')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 pb-2">
                  <Label htmlFor="phone">
                    {t('phone')}{' '}
                    <span className="text-muted-foreground text-xs">({tc('optional')})</span>
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </CardContent>

              <CardFooter className="flex flex-col gap-4">
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? tc('loading') : t('signUp')}
                </Button>
                <p className="text-sm text-muted-foreground text-center">
                  {t('hasAccount')}{' '}
                  <Link href="/login" className="text-primary hover:underline">
                    {t('signIn')}
                  </Link>
                </p>
              </CardFooter>
            </form>
          </Card>
        </motion.div>
      )}

      {step === 'otp' && (
        <motion.div
          key="otp"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.3 }}
        >
          <Card>
            <CardHeader className="text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }}
                className="mx-auto mb-2 flex size-14 items-center justify-center rounded-full bg-primary/10"
              >
                <Shield className="size-7 text-primary" />
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
                onComplete={handleVerifyOTP}
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
                onClick={handleVerifyOTP}
                disabled={loading || otpValue.length !== 6}
              >
                {loading ? tc('loading') : tc('confirm')}
              </Button>

              <div className="flex items-center gap-4 text-sm">
                <button
                  type="button"
                  onClick={() => { setStep('form'); setOtpValue(''); }}
                  className="text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  <ArrowLeft className="size-3" />
                  {tc('back')}
                </button>
                <button
                  type="button"
                  onClick={handleResendOTP}
                  disabled={loading}
                  className="text-primary hover:underline flex items-center gap-1"
                >
                  <Mail className="size-3" />
                  {t('resendOTP')}
                </button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
