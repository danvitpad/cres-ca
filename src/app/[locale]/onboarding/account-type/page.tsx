/** --- YAML
 * name: Account Type Selection
 * description: Fresha-style post-registration — choose to create new business or join existing one
 * --- */

'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Building2, Users, ChevronRight } from 'lucide-react';

export default function AccountTypePage() {
  const t = useTranslations('onboarding');
  const router = useRouter();

  return (
    <div className="fixed inset-0 flex bg-background">
      {/* Left side — content */}
      <div className="relative flex w-full flex-col justify-center p-6 md:w-1/2 md:p-10 lg:p-16">
        <div className="max-w-md mx-auto w-full space-y-8">
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-2xl font-semibold tracking-tight md:text-3xl leading-tight"
          >
            {t('accountTypeTitle')}
          </motion.h1>

          <div className="flex flex-col gap-4">
            {/* Create new business */}
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              onClick={() => router.push('/onboarding/vertical')}
              className="group flex items-center gap-4 rounded-xl border border-border bg-card p-5 text-left transition-all hover:border-primary/40 hover:shadow-md"
            >
              <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Building2 className="size-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground">{t('createBusiness')}</p>
              </div>
              <ChevronRight className="size-5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </motion.button>

            {/* Join existing business */}
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              onClick={() => router.push('/onboarding/join-business')}
              className="group flex items-center gap-4 rounded-xl border border-border bg-card p-5 text-left transition-all hover:border-primary/40 hover:shadow-md"
            >
              <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Users className="size-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground">{t('joinBusiness')}</p>
                <p className="text-sm text-muted-foreground mt-0.5">{t('joinBusinessDesc')}</p>
              </div>
              <ChevronRight className="size-5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </motion.button>
          </div>
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
          </div>
        </div>
      </div>
    </div>
  );
}
