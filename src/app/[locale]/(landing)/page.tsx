/** --- YAML
 * name: Landing Page
 * description: Premium landing page — dual audience (clients + professionals), spotlight hero, bento features, pricing
 * --- */

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import {
  CalendarDays,
  Users,
  DollarSign,
  Globe,
  Megaphone,
  Package,
  Check,
  ArrowRight,
  Sparkles,
  Star,
  Shield,
  Zap,
} from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Spotlight } from '@/components/landing/spotlight';
import { AnimatedShinyText } from '@/components/landing/animated-shiny-text';
import { BentoGrid, type BentoItem } from '@/components/landing/bento-grid';
import { AnimatedSection, AnimatedStagger, AnimatedItem } from '@/components/shared/animated-section';
import { LanguageSwitcher } from '@/components/shared/language-switcher';
import { AnimatedThemeToggle } from '@/components/ui/animated-theme-toggle';
import { AuthHeaderButtons } from '@/components/landing/auth-header-buttons';

export default function LandingPage() {
  const t = useTranslations('landing');
  const tp = useTranslations('pricing');
  const ta = useTranslations('auth');

  const bentoItems: BentoItem[] = [
    {
      title: t('featCalendar'),
      description: t('featCalendarDesc'),
      icon: <CalendarDays className="size-5 text-blue-500" />,
      status: 'Core',
      tags: ['Drag&Drop', 'Auto'],
      colSpan: 1,
      hasPersistentHover: true,
    },
    {
      title: t('featClients'),
      description: t('featClientsDesc'),
      icon: <Users className="size-5 text-emerald-500" />,
      status: 'CRM',
      tags: ['Cards', 'History'],
    },
    {
      title: t('featBooking'),
      description: t('featBookingDesc'),
      icon: <Globe className="size-5 text-violet-500" />,
      tags: ['Telegram', 'Web'],
      colSpan: 1,
    },
    {
      title: t('featFinance'),
      description: t('featFinanceDesc'),
      icon: <DollarSign className="size-5 text-amber-500" />,
      status: 'Analytics',
      tags: ['Revenue', 'Costs'],
      colSpan: 1,
    },
    {
      title: t('featMarketing'),
      description: t('featMarketingDesc'),
      icon: <Megaphone className="size-5 text-pink-500" />,
      tags: ['Referrals', 'Auto'],
      colSpan: 1,
    },
    {
      title: t('featInventory'),
      description: t('featInventoryDesc'),
      icon: <Package className="size-5 text-sky-500" />,
      tags: ['Stock', 'Auto-deduct'],
      colSpan: 1,
    },
  ];

  const metrics = [
    { value: '10K+', label: t('metricClients'), icon: Users },
    { value: '50K+', label: t('metricBookings'), icon: CalendarDays },
    { value: '99.9%', label: t('metricUptime'), icon: Zap },
    { value: '4.9', label: t('metricRating'), icon: Star },
  ];

  const starterFeatures = [
    'clients50', 'masters1', 'basicCalendar', 'basicClientCards',
    'reminders', 'basicFinance',
  ];
  const proFeatures = [
    'clients300', 'masters3', ...starterFeatures.slice(2),
    'waitlist', 'autoUpsell', 'referral', 'inventory',
    'consent', 'allergies', 'extendedAnalytics', 'autoMessages',
  ];
  const businessFeatures = [
    'clientsUnlimited', 'mastersUnlimited', ...starterFeatures.slice(2),
    'waitlist', 'autoUpsell', 'referral', 'inventory',
    'consent', 'allergies', 'extendedAnalytics', 'autoMessages',
    'aiFeatures', 'behaviorIndicators', 'fileStorage', 'equipmentBooking',
    'crossMarketing', 'autoReports', 'currencyTracking',
    'beforeAfter', 'giftCertificates', 'prioritySupport',
  ];

  const howItWorks = [
    { icon: <Sparkles className="size-6" />, title: t('step1Title'), desc: t('step1Desc') },
    { icon: <CalendarDays className="size-6" />, title: t('step2Title'), desc: t('step2Desc') },
    { icon: <Star className="size-6" />, title: t('step3Title'), desc: t('step3Desc') },
  ];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'CRES-CA',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    description: 'Universal service platform for booking, client management, finance and marketing.',
    url: 'https://cres-ca.com',
    offers: {
      '@type': 'AggregateOffer',
      lowPrice: '0',
      highPrice: '49',
      priceCurrency: 'USD',
      offerCount: 3,
    },
  };

  return (
    <div className="flex flex-col min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ═══════════════════ HEADER ═══════════════════ */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/60 backdrop-blur-2xl">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <span className="text-xl font-bold tracking-tight">CRES-CA</span>
          <nav className="flex items-center gap-2">
            <LanguageSwitcher />
            <AnimatedThemeToggle />
            <AuthHeaderButtons />
          </nav>
        </div>
      </header>

      {/* ═══════════════════ HERO ═══════════════════ */}
      <section className="relative overflow-hidden bg-background">
        <Spotlight className="-top-40 left-0 md:left-60 md:-top-20" />

        <div className="absolute inset-0 -z-10 pointer-events-none">
          <div className="absolute left-1/4 top-0 h-[500px] w-[500px] rounded-full bg-primary/[0.07] blur-[150px]" />
          <div className="absolute right-1/3 bottom-0 h-[400px] w-[400px] rounded-full bg-violet-500/[0.05] blur-[120px]" />
        </div>

        <div aria-hidden className="absolute inset-0 pointer-events-none isolate opacity-50 hidden lg:block">
          <div className="w-[35rem] h-[80rem] -translate-y-[87.5%] absolute left-0 top-0 -rotate-45 rounded-full bg-[radial-gradient(68.54%_68.72%_at_55.02%_31.46%,hsla(0,0%,85%,.08)_0,hsla(0,0%,55%,.02)_50%,hsla(0,0%,45%,0)_80%)]" />
          <div className="h-[80rem] absolute left-0 top-0 w-56 -rotate-45 rounded-full bg-[radial-gradient(50%_50%_at_50%_50%,hsla(0,0%,85%,.06)_0,hsla(0,0%,45%,.02)_80%,transparent_100%)] [translate:5%_-50%]" />
        </div>

        <div className="relative mx-auto max-w-5xl px-6 py-28 lg:py-36">
          <div className="relative z-10 mx-auto max-w-3xl text-center">
            <AnimatedSection>
              <div className="mb-6 flex justify-center">
                <div className="group rounded-full border border-border/50 bg-muted/50 text-sm backdrop-blur transition-all ease-in hover:bg-muted">
                  <AnimatedShinyText className="inline-flex items-center justify-center px-5 py-1.5 transition ease-out hover:text-foreground hover:duration-300">
                    <Sparkles className="mr-2 size-3.5" />
                    <span>{t('freeTrial')}</span>
                    <ArrowRight className="ml-2 size-3 transition-transform duration-300 ease-in-out group-hover:translate-x-0.5" />
                  </AnimatedShinyText>
                </div>
              </div>
            </AnimatedSection>

            <AnimatedSection delay={0.1}>
              <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
                {t('heroTitle')}
              </h1>
            </AnimatedSection>

            <AnimatedSection delay={0.2}>
              <p className="mx-auto mt-6 mb-10 max-w-2xl text-lg text-muted-foreground leading-relaxed">
                {t('heroSubtitle')}
              </p>
            </AnimatedSection>

            <AnimatedSection delay={0.3}>
              <div className="flex items-center justify-center">
                <Link
                  href="/register"
                  className={cn(
                    buttonVariants({ size: 'lg' }),
                    'px-10 gap-2 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-shadow',
                  )}
                >
                  {t('getStarted')}
                  <ArrowRight className="size-4" />
                </Link>
              </div>
            </AnimatedSection>
          </div>
        </div>
      </section>

      {/* ═══════════════════ METRICS ═══════════════════ */}
      <section className="border-y bg-muted/20">
        <div className="container mx-auto px-4">
          <AnimatedStagger className="grid grid-cols-2 md:grid-cols-4 divide-x divide-border/50">
            {metrics.map((m) => (
              <AnimatedItem key={m.label}>
                <div className="flex flex-col items-center py-8 gap-1">
                  <m.icon className="size-5 text-primary mb-2" />
                  <span className="text-2xl sm:text-3xl font-bold tracking-tight">{m.value}</span>
                  <span className="text-xs text-muted-foreground">{m.label}</span>
                </div>
              </AnimatedItem>
            ))}
          </AnimatedStagger>
        </div>
      </section>

      {/* ═══════════════════ FEATURES ═══════════════════ */}
      <section id="features" className="relative py-24 px-4">
        <div className="absolute inset-0 -z-10">
          <div className="absolute right-0 top-1/4 h-[350px] w-[350px] rounded-full bg-primary/[0.04] blur-[120px]" />
        </div>
        <div className="container mx-auto">
          <AnimatedSection>
            <div className="text-center mb-14">
              <Badge variant="outline" className="mb-4 rounded-full px-4 py-1.5 text-xs uppercase tracking-widest">
                <Zap className="mr-1.5 size-3" />
                {t('features')}
              </Badge>
              <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">{t('featuresTitle')}</h2>
              <p className="mt-4 text-muted-foreground max-w-xl mx-auto">{t('featuresSubtitle')}</p>
            </div>
          </AnimatedSection>

          <AnimatedSection delay={0.2}>
            <BentoGrid items={bentoItems} />
          </AnimatedSection>
        </div>
      </section>

      {/* ═══════════════════ HOW IT WORKS ═══════════════════ */}
      <section className="py-24 px-4 bg-muted/20">
        <div className="container mx-auto max-w-5xl">
          <AnimatedSection>
            <div className="text-center mb-14">
              <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">{t('howItWorksTitle')}</h2>
            </div>
          </AnimatedSection>

          <AnimatedStagger className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {howItWorks.map((step, i) => (
              <AnimatedItem key={i}>
                <div className="group relative rounded-2xl border bg-card/80 backdrop-blur p-6 text-center transition-all duration-300 hover:shadow-lg hover:border-primary/30">
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                    {i + 1}
                  </div>
                  <div className="mt-4 mb-4 flex justify-center text-primary">{step.icon}</div>
                  <h3 className="font-semibold text-lg mb-2">{step.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
                </div>
              </AnimatedItem>
            ))}
          </AnimatedStagger>
        </div>
      </section>

      {/* ═══════════════════ PRICING ═══════════════════ */}
      <section id="pricing" className="relative py-24 px-4">
        <div className="absolute inset-0 -z-10">
          <div className="absolute left-1/4 bottom-0 h-[400px] w-[400px] rounded-full bg-violet-500/[0.04] blur-[120px]" />
        </div>
        <div className="container mx-auto">
          <AnimatedSection>
            <div className="text-center mb-14">
              <Badge variant="outline" className="mb-4 rounded-full px-4 py-1.5 text-xs uppercase tracking-widest">
                <Shield className="mr-1.5 size-3" />
                {t('pricing')}
              </Badge>
              <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">{t('pricingTitle')}</h2>
              <p className="mt-4 text-muted-foreground">{t('pricingSubtitle')}</p>
            </div>
          </AnimatedSection>

          <AnimatedStagger className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto items-stretch pt-4">
            <AnimatedItem>
              <PricingCard
                title={tp('starter')}
                price={tp('starterPrice')}
                features={starterFeatures}
                tp={tp}
                buttonLabel={tp('subscribe')}
              />
            </AnimatedItem>
            <AnimatedItem>
              <PricingCard
                title={tp('pro')}
                price={tp('proPrice')}
                features={proFeatures}
                tp={tp}
                buttonLabel={tp('subscribe')}
                highlighted
                badge={tp('popular')}
              />
            </AnimatedItem>
            <AnimatedItem>
              <PricingCard
                title={tp('business')}
                price={tp('businessPrice')}
                features={businessFeatures}
                tp={tp}
                buttonLabel={tp('subscribe')}
              />
            </AnimatedItem>
          </AnimatedStagger>
        </div>
      </section>

      {/* ═══════════════════ CTA ═══════════════════ */}
      <section className="py-24 px-4 bg-muted/20">
        <AnimatedSection>
          <div className="container mx-auto max-w-3xl text-center">
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight mb-4">{t('ctaTitle')}</h2>
            <p className="text-muted-foreground mb-8 text-lg">{t('ctaSubtitle')}</p>
            <Link
              href="/register"
              className={cn(
                buttonVariants({ size: 'lg' }),
                'px-10 gap-2 shadow-lg shadow-primary/20',
              )}
            >
              {t('getStarted')}
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </AnimatedSection>
      </section>

      {/* ═══════════════════ FOOTER ═══════════════════ */}
      <footer className="border-t py-10 px-4">
        <div className="container mx-auto text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} CRES-CA. All rights reserved.
        </div>
      </footer>
    </div>
  );
}

function PricingCard({
  title,
  price,
  features,
  tp,
  buttonLabel,
  highlighted,
  badge,
}: {
  title: string;
  price: string;
  features: string[];
  tp: (key: string) => string;
  buttonLabel: string;
  highlighted?: boolean;
  badge?: string;
}) {
  return (
    <Card className={cn(
      'h-full flex flex-col transition-all duration-300 hover:shadow-lg hover:-translate-y-1 bg-card/80 backdrop-blur overflow-visible',
      highlighted && 'border-primary ring-2 ring-primary/20 relative scale-[1.03]',
    )}>
      {badge && (
        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 shadow-sm">
          {badge}
        </Badge>
      )}
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        <p className="text-3xl font-bold tracking-tight">{price}</p>
      </CardHeader>
      <CardContent className="flex flex-col flex-1">
        <div className="flex-1 space-y-2.5">
          {features.map((f) => (
            <div key={f} className="flex items-center gap-2.5 text-sm">
              <Check className="size-4 text-emerald-500 shrink-0" />
              <span>{tp(f)}</span>
            </div>
          ))}
        </div>
        <Link
          href="/register"
          className={cn(
            buttonVariants({ variant: highlighted ? 'default' : 'outline' }),
            'w-full mt-6',
            highlighted && 'shadow-lg shadow-primary/20',
          )}
        >
          {buttonLabel}
        </Link>
      </CardContent>
    </Card>
  );
}
