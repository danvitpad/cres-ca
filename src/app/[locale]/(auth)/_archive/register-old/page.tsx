/** --- YAML
 * name: Register Page
 * description: Registration — client (simple card) or business (Fresha-style split layout with extended fields)
 * --- */

'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { REGEXP_ONLY_DIGITS } from 'input-otp';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { humanizeError } from '@/lib/format/error';

type Step = 'form' | 'otp';

export default function RegisterPage() {
  const t = useTranslations('auth');
  const tc = useTranslations('common');
  const router = useRouter();
  const searchParams = useSearchParams();
  const roleParam = searchParams.get('role');
  const emailParam = searchParams.get('email') || '';
  const isBusinessFlow = roleParam === 'business';

  const [step, setStep] = useState<Step>('form');
  const [loading, setLoading] = useState(false);
  const [otpValue, setOtpValue] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState(emailParam);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState(isBusinessFlow ? 'master' : 'client');

  const fullName = `${firstName} ${lastName}`.trim();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword && !isBusinessFlow) {
      toast.error(t('passwordMismatch'));
      return;
    }
    if (isBusinessFlow && password.length < 6) {
      toast.error(t('passwordTooShort'));
      return;
    }

    setLoading(true);
    const supabase = createClient();

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: isBusinessFlow ? fullName : firstName || fullName,
          role,
          phone: phone || undefined,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      },
    });

    setLoading(false);

    if (error) {
      toast.error(humanizeError(error));
      return;
    }

    if (data.user && data.user.identities?.length === 0) {
      toast.error(t('emailAlreadyRegistered'));
      router.push(`/login?role=${isBusinessFlow ? 'business' : 'client'}&email=${encodeURIComponent(email)}`);
      return;
    }

    setStep('otp');
  }

  async function handleVerifyOTP() {
    if (otpValue.length !== 8) return;
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
      router.push('/feed');
    } else {
      router.push('/onboarding/account-type');
    }
  }

  async function handleResendOTP() {
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    setLoading(false);
    if (error) toast.error(humanizeError(error));
    else toast.success(t('otpResent'));
  }

  const slideIn = {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10 },
    transition: { duration: 0.2 },
  };

  // ========================
  // BUSINESS REGISTRATION — Fresha-style split layout
  // ========================
  if (isBusinessFlow) {
    return (
      <div className="fixed inset-0 z-50 flex bg-background">
        {/* Left side — form */}
        <div className="relative flex w-full flex-col justify-between overflow-y-auto p-6 md:w-1/2 md:p-10 lg:p-16">
          {/* Back */}
          <div className="shrink-0">
            <Link
              href="/user-flow"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="size-4" />
              {tc('back')}
            </Link>
          </div>

          {/* Form */}
          <div className="flex flex-col gap-6 max-w-md mx-auto w-full py-8">
            <AnimatePresence mode="wait">
              {step === 'form' && (
                <motion.div key="biz-form" {...slideIn} className="flex flex-col gap-6">
                  <div>
                    <h1 className="text-2xl font-semibold tracking-tight">{t('createBusinessAccount')}</h1>
                    {emailParam && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {t('almostReady')}{' '}
                        <span className="font-medium text-foreground">{emailParam}</span>
                      </p>
                    )}
                  </div>

                  <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    {/* Name */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>{t('firstName')}</Label>
                        <Input
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          placeholder={t('firstNamePlaceholder')}
                          required
                          autoFocus
                          className="h-11"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>{t('lastName')}</Label>
                        <Input
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          placeholder={t('lastNamePlaceholder')}
                          required
                          className="h-11"
                        />
                      </div>
                    </div>

                    {/* Email */}
                    <div className="space-y-1.5">
                      <Label>{t('email')}</Label>
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        readOnly={!!emailParam}
                        className="h-11"
                      />
                    </div>

                    {/* Password */}
                    <div className="space-y-1.5">
                      <Label>{t('password')}</Label>
                      <div className="relative">
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder={t('newPasswordPlaceholder')}
                          required
                          minLength={6}
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

                    {/* Phone */}
                    <div className="space-y-1.5">
                      <Label>{t('phone')}</Label>
                      <Input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+380..."
                        className="h-11"
                      />
                    </div>

                    {/* Role */}
                    <div className="space-y-1.5">
                      <Label>{t('selectRole')}</Label>
                      <Select value={role} onValueChange={(v) => v && setRole(v)}>
                        <SelectTrigger className="w-full h-11">
                          <span>{role === 'master' ? t('roleMaster') : t('roleSalon')}</span>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="master">{t('roleMaster')}</SelectItem>
                          <SelectItem value="salon_admin">{t('roleSalon')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Terms */}
                    <div className="flex items-start gap-2 pt-1">
                      <Checkbox
                        id="terms"
                        checked={termsAccepted}
                        onCheckedChange={(v) => setTermsAccepted(v === true)}
                        className="mt-0.5"
                      />
                      <Label htmlFor="terms" className="text-xs text-muted-foreground font-normal leading-relaxed cursor-pointer">
                        {t('acceptTerms')}
                      </Label>
                    </div>

                    <Button
                      type="submit"
                      className="w-full h-11"
                      disabled={loading || !termsAccepted}
                    >
                      {loading ? tc('loading') : t('createAccount')}
                    </Button>
                  </form>

                  <p className="text-sm text-muted-foreground text-center">
                    {t('isClient')}{' '}
                    <Link href="/register?role=client" className="text-primary hover:underline">
                      {t('userFlowClient')}
                    </Link>
                  </p>
                </motion.div>
              )}

              {step === 'otp' && (
                <motion.div key="biz-otp" {...slideIn} className="flex flex-col gap-6 items-center">
                  <div className="text-center">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }}
                      className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-primary/10"
                    >
                      <Shield className="size-7 text-primary" />
                    </motion.div>
                    <h1 className="text-2xl font-semibold tracking-tight">{t('enterOTP')}</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                      {t('otpSentTo')} <span className="font-medium text-foreground">{email}</span>
                    </p>
                  </div>
                  <InputOTP
                    maxLength={8}
                    pattern={REGEXP_ONLY_DIGITS}
                    value={otpValue}
                    onChange={setOtpValue}
                    onComplete={handleVerifyOTP}
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                    </InputOTPGroup>
                    <InputOTPSeparator />
                    <InputOTPGroup>
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                      <InputOTPSlot index={6} />
                      <InputOTPSlot index={7} />
                    </InputOTPGroup>
                  </InputOTP>
                  <Button className="w-full h-11" onClick={handleVerifyOTP} disabled={loading || otpValue.length !== 8}>
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
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="shrink-0" />
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
              <p className="text-sm text-muted-foreground max-w-xs mx-auto">{t('platformDesc')}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ========================
  // CLIENT REGISTRATION — Fresha-style split layout
  // ========================
  return (
    <div className="fixed inset-0 z-50 flex bg-background">
      {/* Left side — form */}
      <div className="relative flex w-full flex-col justify-between overflow-y-auto p-6 md:w-1/2 md:p-10 lg:p-16">
        <div className="shrink-0">
          <Link
            href="/login?role=client"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-4" />
            {tc('back')}
          </Link>
        </div>

        <div className="flex flex-col gap-6 max-w-md mx-auto w-full py-8">
          <AnimatePresence mode="wait">
            {step === 'form' && (
              <motion.div key="client-form" {...slideIn} className="flex flex-col gap-6">
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight">{t('createAccount')}</h1>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t('almostReady')}
                    {emailParam && (
                      <>
                        {' '}
                        <span className="font-medium text-foreground">{emailParam}</span>
                      </>
                    )}
                    {emailParam ? '' : `, ${t('createAccountDesc')}`}
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  <div className="space-y-1.5">
                    <Label>{t('firstName')} *</Label>
                    <Input
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                      autoFocus
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t('lastName')} *</Label>
                    <Input
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required
                      className="h-11"
                    />
                  </div>

                  {!emailParam && (
                    <div className="space-y-1.5">
                      <Label>{t('email')} *</Label>
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="h-11"
                      />
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label>{t('password')} *</Label>
                    <div className="relative">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          setConfirmPassword(e.target.value);
                        }}
                        required
                        minLength={6}
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

                  <div className="space-y-1.5">
                    <Label>{t('phone')}</Label>
                    <Input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+380..."
                      className="h-11"
                    />
                  </div>

                  <div className="flex items-start gap-2 pt-1">
                    <Checkbox
                      id="terms-client"
                      checked={termsAccepted}
                      onCheckedChange={(v) => setTermsAccepted(v === true)}
                      className="mt-0.5"
                    />
                    <Label htmlFor="terms-client" className="text-xs text-muted-foreground font-normal leading-relaxed cursor-pointer">
                      {t('acceptTerms')}
                    </Label>
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-11"
                    disabled={loading || !termsAccepted}
                  >
                    {loading ? tc('loading') : t('continue')}
                  </Button>
                </form>

                <p className="text-sm text-muted-foreground text-center">
                  {t('hasAccount')}{' '}
                  <Link href="/login?role=client" className="text-primary hover:underline">
                    {t('signIn')}
                  </Link>
                </p>
              </motion.div>
            )}

            {step === 'otp' && (
              <motion.div key="client-otp" {...slideIn} className="flex flex-col gap-6 items-center">
                <div className="text-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }}
                    className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-primary/10"
                  >
                    <Shield className="size-7 text-primary" />
                  </motion.div>
                  <h1 className="text-2xl font-semibold tracking-tight">{t('enterOTP')}</h1>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t('otpSentTo')} <span className="font-medium text-foreground">{email}</span>
                  </p>
                </div>
                <InputOTP
                  maxLength={8}
                  pattern={REGEXP_ONLY_DIGITS}
                  value={otpValue}
                  onChange={setOtpValue}
                  onComplete={handleVerifyOTP}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                  </InputOTPGroup>
                  <InputOTPSeparator />
                  <InputOTPGroup>
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                    <InputOTPSlot index={6} />
                    <InputOTPSlot index={7} />
                  </InputOTPGroup>
                </InputOTP>
                <Button
                  className="w-full h-11"
                  onClick={handleVerifyOTP}
                  disabled={loading || otpValue.length !== 8}
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
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="shrink-0" />
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
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">{t('platformDesc')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
