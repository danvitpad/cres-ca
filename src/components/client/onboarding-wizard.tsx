/** --- YAML
 * name: ClientOnboardingWizard
 * description: First-run wizard for new clients — captures name, phone, birthday and introduces the key app sections. Writes client_onboarded_at on finish.
 * created: 2026-04-13
 * updated: 2026-04-13
 * --- */

'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Sparkles, User, Calendar as CalendarIcon, Gift, ChevronRight, ChevronLeft, X, Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { Button } from '@/components/ui/button';
import { DateWheelPicker, fromISODay, toISODay } from '@/components/ui/date-wheel-picker';
import { humanizeError } from '@/lib/format/error';

interface Props {
  open: boolean;
  onClose: (completed: boolean) => void;
  initial: {
    full_name: string | null;
    phone: string | null;
    date_of_birth: string | null;
  };
}

export function ClientOnboardingWizard({ open, onClose, initial }: Props) {
  if (!open) return null;
  return <WizardBody onClose={onClose} initial={initial} />;
}

function WizardBody({ onClose, initial }: Omit<Props, 'open'>) {
  const t = useTranslations('clientOnboarding');
  const { userId } = useAuthStore();
  const [step, setStep] = useState(0);
  const [fullName, setFullName] = useState(initial.full_name ?? '');
  const [phone, setPhone] = useState(initial.phone ?? '');
  const [dob, setDob] = useState(initial.date_of_birth ?? '');
  const [busy, setBusy] = useState(false);

  const steps = [
    { icon: Sparkles, key: 'welcome' as const },
    { icon: User, key: 'profile' as const },
    { icon: CalendarIcon, key: 'birthday' as const },
    { icon: Gift, key: 'rewards' as const },
  ];

  const isLast = step === steps.length - 1;
  const current = steps[step];

  async function finish() {
    if (!userId) return;
    setBusy(true);
    const supabase = createClient();
    const patch: Record<string, string | null> = {
      client_onboarded_at: new Date().toISOString(),
    };
    if (fullName.trim()) patch.full_name = fullName.trim();
    if (phone.trim()) patch.phone = phone.trim();
    if (dob) patch.date_of_birth = dob;
    const { error } = await supabase.from('profiles').update(patch).eq('id', userId);
    setBusy(false);
    if (error) {
      toast.error(humanizeError(error));
      return;
    }
    toast.success(t('finishedToast'));
    onClose(true);
  }

  async function skip() {
    if (!userId) return onClose(false);
    const supabase = createClient();
    await supabase
      .from('profiles')
      .update({ client_onboarded_at: new Date().toISOString() })
      .eq('id', userId);
    onClose(false);
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      >
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.98 }}
          transition={{ type: 'spring', damping: 22, stiffness: 260 }}
          className="relative w-full max-w-md overflow-hidden rounded-[28px] border bg-card shadow-2xl"
        >
          {/* Close */}
          <button
            onClick={skip}
            className="absolute right-4 top-4 z-10 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            aria-label={t('skip')}
          >
            <X className="size-4" />
          </button>

          {/* Header with animated gradient */}
          <div className="relative h-36 overflow-hidden bg-[#0b0b14]">
            <motion.div
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 40, ease: 'linear', repeat: Infinity }}
              className="pointer-events-none absolute -inset-[40%] opacity-70"
              style={{
                background:
                  'conic-gradient(from 90deg at 50% 50%, #0f766e 0%, #db2777 25%, #f59e0b 50%, #0f766e 75%, #0f766e 100%)',
                filter: 'blur(80px)',
              }}
            />
            <div className="absolute inset-0 bg-[#0b0b14]/50" />
            <div className="relative flex h-full items-center justify-center">
              <motion.div
                key={current.key}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', damping: 18 }}
                className="flex size-16 items-center justify-center rounded-2xl bg-white/15 backdrop-blur ring-1 ring-white/20"
              >
                <current.icon className="size-8 text-white" />
              </motion.div>
            </div>
          </div>

          {/* Body */}
          <div className="px-6 pb-6 pt-5">
            <AnimatePresence mode="wait">
              <motion.div
                key={current.key}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.2 }}
              >
                <h2 className="text-xl font-bold tracking-tight">{t(`${current.key}_title`)}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{t(`${current.key}_desc`)}</p>

                {current.key === 'profile' && (
                  <div className="mt-5 space-y-3">
                    <input
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder={t('namePh')}
                      className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                    />
                    <input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder={t('phonePh')}
                      className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                )}

                {current.key === 'birthday' && (
                  <div className="mt-5 rounded-xl border bg-background px-3 py-2">
                    <DateWheelPicker
                      size="md"
                      value={fromISODay(dob)}
                      onChange={(d) => setDob(toISODay(d))}
                    />
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            {/* Progress dots */}
            <div className="mt-6 flex items-center justify-center gap-1.5">
              {steps.map((s, i) => (
                <div
                  key={s.key}
                  className={`h-1.5 rounded-full transition-all ${
                    i === step ? 'w-6 bg-primary' : i < step ? 'w-1.5 bg-primary/60' : 'w-1.5 bg-muted'
                  }`}
                />
              ))}
            </div>

            {/* Actions */}
            <div className="mt-5 flex gap-2">
              {step > 0 && (
                <Button variant="ghost" onClick={() => setStep((s) => s - 1)} disabled={busy}>
                  <ChevronLeft className="size-4" /> {t('back')}
                </Button>
              )}
              <div className="flex-1" />
              {isLast ? (
                <Button onClick={finish} disabled={busy}>
                  {busy ? '…' : (<><Check className="mr-1 size-4" /> {t('finish')}</>)}
                </Button>
              ) : (
                <Button onClick={() => setStep((s) => s + 1)}>
                  {t('next')} <ChevronRight className="size-4" />
                </Button>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
