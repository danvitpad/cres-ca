/** --- YAML
 * name: Register Page
 * description: Unified registration — 3 role buttons, per-role forms, shared OTP verification
 * created: 2026-04-15
 * updated: 2026-04-15
 * --- */

'use client';

import { useEffect, useState } from 'react';
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
  ArrowLeft,
  Mail,
  Shield,
  Eye,
  EyeOff,
  CalendarCheck,
  User as UserIcon,
  Building2,
  ChevronRight,
} from 'lucide-react';

type Role = 'client' | 'master' | 'salon_admin';
type Step = 'role' | 'form' | 'otp';

export default function RegisterPage() {
  const t = useTranslations('auth');
  const tc = useTranslations('common');
  const router = useRouter();
  const searchParams = useSearchParams();

  const urlRole = searchParams.get('role') as Role | null;
  const emailParam = searchParams.get('email') || '';

  const [role, setRole] = useState<Role | null>(urlRole);
  const [step, setStep] = useState<Step>(urlRole ? 'form' : 'role');
  const [loading, setLoading] = useState(false);
  const [otpValue, setOtpValue] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [salonName, setSalonName] = useState('');
  const [email, setEmail] = useState(emailParam);
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    if (urlRole && ['client', 'master', 'salon_admin'].includes(urlRole)) {
      setRole(urlRole);
      setStep('form');
    }
  }, [urlRole]);

  function pickRole(r: Role) {
    setRole(r);
    setStep('form');
  }

  const displayName = `${firstName} ${lastName}`.trim();
  const metaFullName = role === 'salon_admin' ? salonName.trim() : displayName || firstName;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      toast.error(t('passwordTooShort'));
      return;
    }
    if (!role) {
      toast.error(t('selectRole'));
      return;
    }

    setLoading(true);
    const supabase = createClient();

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: metaFullName,
          role,
          phone: phone || undefined,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      },
    });

    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    if (data.user && data.user.identities?.length === 0) {
      toast.error(t('emailAlreadyRegistered'));
      router.push(`/login?email=${encodeURIComponent(email)}`);
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
    if (error) toast.error(error.message);
    else toast.success(t('otpResent'));
  }

  const slideIn = {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10 },
    transition: { duration: 0.2 },
  };

  const roleCards: Array<{
    value: Role;
    icon: typeof UserIcon;
    labelKey: string;
    descKey: string;
    tone: string;
  }> = [
    { value: 'client', icon: CalendarCheck, labelKey: 'roleClient', descKey: 'userFlowClientDesc', tone: 'primary' },
    { value: 'master', icon: UserIcon, labelKey: 'roleMaster', descKey: 'userFlowBusinessDesc', tone: 'amber' },
    { value: 'salon_admin', icon: Building2, labelKey: 'roleSalon', descKey: 'userFlowBusinessDesc', tone: 'emerald' },
  ];

  const toneClasses: Record<string, string> = {
    primary: 'bg-primary/10 text-primary',
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  };

  const isSalon = role === 'salon_admin';

  return (
    <div className="fixed inset-0 z-50 flex bg-background">
      {/* Left side — form */}
      <div className="relative flex w-full flex-col justify-between overflow-y-auto p-6 md:w-1/2 md:p-10 lg:p-16">
        <div className="shrink-0">
          {step === 'role' ? (
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="size-4" />
              {t('backToHome')}
            </Link>
          ) : step === 'form' ? (
            <button
              type="button"
              onClick={() => setStep('role')}
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="size-4" />
              {tc('back')}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setStep('form');
                setOtpValue('');
              }}
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="size-4" />
              {tc('back')}
            </button>
          )}
        </div>

        <div className="flex flex-col gap-6 max-w-md mx-auto w-full py-8">
          <AnimatePresence mode="wait">
            {/* STEP: Role picker */}
            {step === 'role' && (
              <motion.div key="role" {...slideIn} className="flex flex-col gap-6">
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight">{t('createAccount')}</h1>
                  <p className="text-sm text-muted-foreground mt-1">{t('selectRole')}</p>
                </div>

                <div className="flex flex-col gap-3">
                  {roleCards.map(({ value, icon: Icon, labelKey, descKey, tone }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => pickRole(value)}
                      className="group flex items-center gap-4 rounded-xl border border-border bg-card p-5 text-left transition-all hover:border-primary/40 hover:shadow-md"
                    >
                      <div className={`flex size-11 shrink-0 items-center justify-center rounded-full ${toneClasses[tone]}`}>
                        <Icon className="size-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground">{t(labelKey)}</p>
                        <p className="text-sm text-muted-foreground mt-0.5 truncate">{t(descKey)}</p>
                      </div>
                      <ChevronRight className="size-5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </button>
                  ))}
                </div>

                <p className="text-sm text-muted-foreground text-center">
                  {t('hasAccount')}{' '}
                  <Link href="/login" className="text-primary hover:underline">
                    {t('signIn')}
                  </Link>
                </p>
              </motion.div>
            )}

            {/* STEP: Form (unified across roles, with role-specific tweaks) */}
            {step === 'form' && role && (
              <motion.div key="form" {...slideIn} className="flex flex-col gap-6">
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight">
                    {isSalon ? t('createBusinessAccount') : t('createAccount')}
                  </h1>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t(role === 'client' ? 'roleClient' : role === 'master' ? 'roleMaster' : 'roleSalon')}
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  {/* Salon name (only for salon_admin) */}
                  {isSalon && (
                    <div className="space-y-1.5">
                      <Label>{t('teamName')}</Label>
                      <Input
                        value={salonName}
                        onChange={(e) => setSalonName(e.target.value)}
                        placeholder={t('teamNamePlaceholder')}
                        required
                        autoFocus
                        className="h-11"
                      />
                      <p className="text-xs text-muted-foreground pt-1">{t('teamNameHint')}</p>
                    </div>
                  )}

                  {/* Personal name — hidden for salon_admin (owner can fill in profile later) */}
                  {!isSalon && (
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
                  )}

                  {/* Email — always editable (URL param only prefills) */}
                  <div className="space-y-1.5">
                    <Label>{t('email')}</Label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
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

                  {/* Terms */}
                  <div className="flex items-start gap-2 pt-1">
                    <Checkbox
                      id="terms"
                      checked={termsAccepted}
                      onCheckedChange={(v) => setTermsAccepted(v === true)}
                      className="mt-0.5"
                    />
                    <Label
                      htmlFor="terms"
                      className="text-xs text-muted-foreground font-normal leading-relaxed cursor-pointer"
                    >
                      {t('acceptTerms')}
                    </Label>
                  </div>

                  <Button type="submit" className="w-full h-11" disabled={loading || !termsAccepted}>
                    {loading ? tc('loading') : t('createAccount')}
                  </Button>
                </form>

                <p className="text-sm text-muted-foreground text-center">
                  {t('hasAccount')}{' '}
                  <Link href="/login" className="text-primary hover:underline">
                    {t('signIn')}
                  </Link>
                </p>
              </motion.div>
            )}

            {/* STEP: OTP */}
            {step === 'otp' && (
              <motion.div key="otp" {...slideIn} className="flex flex-col gap-6 items-center">
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
                <button
                  type="button"
                  onClick={handleResendOTP}
                  disabled={loading}
                  className="text-sm text-primary hover:underline flex items-center gap-1"
                >
                  <Mail className="size-3" />
                  {t('resendOTP')}
                </button>
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
