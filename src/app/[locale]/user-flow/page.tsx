/** --- YAML
 * name: User Flow Page
 * description: Role selection page (Fresha-style) — choose between client or business login
 * --- */

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowLeft, ChevronRight, CalendarCheck, Briefcase } from 'lucide-react';

export default function UserFlowPage() {
  const t = useTranslations('auth');

  return (
    <div className="fixed inset-0 flex bg-background">
      {/* Left side — content */}
      <div className="relative flex w-full flex-col justify-between p-6 md:w-1/2 md:p-10 lg:p-16">
        {/* Back button */}
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-4" />
            {t('backToHome')}
          </Link>
        </div>

        {/* Main content — centered */}
        <div className="flex flex-col items-start gap-8 max-w-md mx-auto w-full">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            {t('userFlowTitle')}
          </h1>

          <div className="flex flex-col gap-4 w-full">
            {/* Client card */}
            <Link
              href="/login?role=client"
              className="group flex items-center gap-4 rounded-xl border border-border bg-card p-5 transition-all hover:border-primary/40 hover:shadow-md"
            >
              <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <CalendarCheck className="size-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground">{t('userFlowClient')}</p>
                <p className="text-sm text-muted-foreground mt-0.5">{t('userFlowClientDesc')}</p>
              </div>
              <ChevronRight className="size-5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>

            {/* Business card */}
            <Link
              href="/login?role=business"
              className="group flex items-center gap-4 rounded-xl border border-border bg-card p-5 transition-all hover:border-primary/40 hover:shadow-md"
            >
              <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Briefcase className="size-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground">{t('userFlowBusiness')}</p>
                <p className="text-sm text-muted-foreground mt-0.5">{t('userFlowBusinessDesc')}</p>
              </div>
              <ChevronRight className="size-5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>

        {/* Spacer to keep vertical centering */}
        <div />
      </div>

      {/* Right side — hero image area */}
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
