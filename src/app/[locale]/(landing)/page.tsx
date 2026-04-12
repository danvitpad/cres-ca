/** --- YAML
 * name: Landing Page
 * description: Premium landing page — Fresha-style design with animated gradient, pill search bar, carousels, stats
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
  Star,
  Shield,
  Zap,
  Search,
  MapPin,
  Smartphone,
  Clock,
  BarChart3,
  Heart,
  Scissors,
  Stethoscope,
  Wrench,
  GraduationCap,
  Dumbbell,
  Sparkles,
  ChevronRight,
} from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { AnimatedSection, AnimatedStagger, AnimatedItem, AnimatedCounter } from '@/components/shared/animated-section';
import { LanguageSwitcher } from '@/components/shared/language-switcher';
import { AnimatedThemeToggle } from '@/components/ui/animated-theme-toggle';
import { AuthHeaderButtons } from '@/components/landing/auth-header-buttons';
import { AnimatedSpotlight } from '@/components/landing/animated-spotlight';
import { HeroSearchBar } from '@/components/landing/hero-search-bar';

export default function LandingPage() {
  const t = useTranslations('landing');
  const tp = useTranslations('pricing');

  const industries = [
    { icon: Scissors, label: t('indBeauty') },
    { icon: Stethoscope, label: t('indHealth') },
    { icon: Wrench, label: t('indHome') },
    { icon: GraduationCap, label: t('indEducation') },
    { icon: Dumbbell, label: t('indFitness') },
  ];

  const features = [
    { icon: CalendarDays, title: t('featCalendar'), desc: t('featCalendarDesc'), color: 'bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400' },
    { icon: Users, title: t('featClients'), desc: t('featClientsDesc'), color: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400' },
    { icon: Globe, title: t('featBooking'), desc: t('featBookingDesc'), color: 'bg-violet-50 text-violet-600 dark:bg-violet-950 dark:text-violet-400' },
    { icon: DollarSign, title: t('featFinance'), desc: t('featFinanceDesc'), color: 'bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400' },
    { icon: Megaphone, title: t('featMarketing'), desc: t('featMarketingDesc'), color: 'bg-pink-50 text-pink-600 dark:bg-pink-950 dark:text-pink-400' },
    { icon: Package, title: t('featInventory'), desc: t('featInventoryDesc'), color: 'bg-sky-50 text-sky-600 dark:bg-sky-950 dark:text-sky-400' },
  ];

  const steps = [
    { num: '01', title: t('step1Title'), desc: t('step1Desc'), icon: Sparkles },
    { num: '02', title: t('step2Title'), desc: t('step2Desc'), icon: Search },
    { num: '03', title: t('step3Title'), desc: t('step3Desc'), icon: Star },
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
    <div className="flex min-h-screen flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Animated spotlight — background layer behind all content */}
      <AnimatedSpotlight />

      {/* ═══════════════════ HEADER — Fresha style ═══════════════════ */}
      <header className="sticky top-0 z-50 w-full">
        <nav className="mx-auto grid max-w-[1440px] items-center px-8 py-3" style={{ height: 72, gridTemplateColumns: 'auto 1fr auto' }}>
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600">
              <span className="text-xs font-black text-white">C</span>
            </div>
            <span className="text-xl font-bold tracking-tight">CRES-CA</span>
          </Link>

          {/* Center nav — hidden on mobile */}
          <div className="hidden justify-center md:flex" />

          {/* Right side */}
          <nav className="flex items-center gap-2">
            <Link
              href="/register"
              className="mr-2 hidden items-center rounded-full bg-white/80 px-4 py-2.5 text-sm font-medium text-foreground backdrop-blur-sm transition-all hover:bg-white dark:bg-zinc-800/80 dark:hover:bg-zinc-800 sm:flex"
            >
              {t('createBusiness')}
            </Link>
            <div className="hidden rounded-full bg-white/80 backdrop-blur-sm transition-all hover:bg-white dark:bg-zinc-800/80 dark:hover:bg-zinc-800 sm:block">
              <LanguageSwitcher />
            </div>
            <div className="rounded-full bg-white/80 backdrop-blur-sm transition-all hover:bg-white dark:bg-zinc-800/80 dark:hover:bg-zinc-800">
              <AnimatedThemeToggle />
            </div>
            <AuthHeaderButtons />
          </nav>
        </nav>
      </header>

      {/* ═══════════════════ HERO — Fresha gradient + search ═══════════════════ */}
      <section className="relative px-6 pb-16 pt-12 sm:pt-20 lg:pt-28">

        <div className="relative mx-auto max-w-[960px] text-center">
          <AnimatedSection>
            <h1
              className="text-balance font-bold tracking-tight text-zinc-900 dark:text-zinc-50"
              style={{ fontSize: 'clamp(32px, 5vw, 64px)', lineHeight: 1.06 }}
            >
              {t('heroTitle')}
            </h1>
          </AnimatedSection>

          <AnimatedSection delay={0.1}>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-zinc-600 dark:text-zinc-400 sm:text-xl" style={{ lineHeight: '28px' }}>
              {t('heroSubtitle')}
            </p>
          </AnimatedSection>

          {/* Search bar */}
          <AnimatedSection delay={0.2}>
            <div className="mt-10">
              <HeroSearchBar />
            </div>
          </AnimatedSection>

          {/* Bookings counter */}
          <AnimatedSection delay={0.3}>
            <p className="mt-6 text-center text-lg text-zinc-600 dark:text-zinc-400">
              <AnimatedCounter value="205 748" className="font-semibold text-zinc-900 dark:text-zinc-100" />{' '}
              {t('bookingsToday')}
            </p>
          </AnimatedSection>

          {/* Industry pills */}
          <AnimatedSection delay={0.4}>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
              {industries.map((ind) => (
                <span key={ind.label} className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white/60 px-4 py-2 text-sm text-zinc-600 backdrop-blur-sm dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300">
                  <ind.icon className="size-4" />
                  {ind.label}
                </span>
              ))}
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ═══════════════════ STATS — large numbers ═══════════════════ */}
      <section className="px-6 py-16">
        <AnimatedStagger className="mx-auto grid max-w-5xl grid-cols-2 gap-8 sm:grid-cols-4">
          {[
            { value: '1M+', label: t('statBookings') },
            { value: '130K+', label: t('statPartners') },
            { value: '120+', label: t('statCountries') },
            { value: '4.9', label: t('statRating'), showStars: true },
          ].map((stat) => (
            <AnimatedItem key={stat.label}>
              <div className="text-center">
                <AnimatedCounter
                  value={stat.value}
                  className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-4xl lg:text-5xl"
                />
                {stat.showStars && (
                  <div className="mt-2 flex items-center justify-center gap-0.5">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="size-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                )}
                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{stat.label}</p>
              </div>
            </AnimatedItem>
          ))}
        </AnimatedStagger>
      </section>

      {/* ═══════════════════ FEATURES ═══════════════════ */}
      <section id="features" className="px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <AnimatedSection>
            <div className="text-center">
              <p className="text-sm font-semibold uppercase tracking-widest text-violet-600 dark:text-violet-400">{t('features')}</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{t('featuresTitle')}</h2>
              <p className="mx-auto mt-4 max-w-xl text-muted-foreground">{t('featuresSubtitle')}</p>
            </div>
          </AnimatedSection>

          <AnimatedStagger className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feat) => (
              <AnimatedItem key={feat.title}>
                <div className="group rounded-2xl bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
                  <div className={cn('flex size-11 items-center justify-center rounded-xl', feat.color)}>
                    <feat.icon className="size-5" />
                  </div>
                  <h3 className="mt-4 text-[15px] font-semibold">{feat.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{feat.desc}</p>
                </div>
              </AnimatedItem>
            ))}
          </AnimatedStagger>
        </div>
      </section>

      {/* ═══════════════════ HOW IT WORKS ═══════════════════ */}
      <section id="how-it-works" className="px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-5xl">
          <AnimatedSection>
            <div className="text-center">
              <p className="text-sm font-semibold uppercase tracking-widest text-violet-600 dark:text-violet-400">{t('howItWorksTitle')}</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{t('howItWorksTitle')}</h2>
            </div>
          </AnimatedSection>

          <AnimatedStagger className="mt-14 grid grid-cols-1 gap-8 md:grid-cols-3">
            {steps.map((step, i) => (
              <AnimatedItem key={i}>
                <div className="relative text-center">
                  {i < steps.length - 1 && (
                    <div className="absolute -right-4 top-8 hidden w-8 border-t-2 border-dashed border-border md:block" />
                  )}
                  <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-lg shadow-violet-500/20">
                    <step.icon className="size-7" />
                  </div>
                  <span className="mt-4 block text-xs font-bold uppercase tracking-widest text-violet-600 dark:text-violet-400">{step.num}</span>
                  <h3 className="mt-2 text-lg font-bold">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.desc}</p>
                </div>
              </AnimatedItem>
            ))}
          </AnimatedStagger>
        </div>
      </section>

      {/* ═══════════════════ PLATFORM HIGHLIGHTS ═══════════════════ */}
      <section className="px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <AnimatedSection>
              <div>
                <p className="text-sm font-semibold uppercase tracking-widest text-violet-600 dark:text-violet-400">{t('platformLabel')}</p>
                <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{t('platformTitle')}</h2>
                <p className="mt-4 leading-relaxed text-muted-foreground">{t('platformDesc')}</p>

                <div className="mt-8 space-y-4">
                  {[
                    { icon: Smartphone, text: t('platformTelegram') },
                    { icon: MapPin, text: t('platformMap') },
                    { icon: Clock, text: t('platformReminders') },
                    { icon: BarChart3, text: t('platformAnalytics') },
                  ].map((item) => (
                    <div key={item.text} className="flex items-start gap-3">
                      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600 dark:bg-violet-950 dark:text-violet-400">
                        <item.icon className="size-4" />
                      </div>
                      <span className="text-sm leading-relaxed">{item.text}</span>
                    </div>
                  ))}
                </div>

                <Link
                  href="/register"
                  className="mt-8 inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background transition-colors hover:bg-foreground/90"
                >
                  {t('getStarted')}
                  <ArrowRight className="size-4" />
                </Link>
              </div>
            </AnimatedSection>

            <AnimatedSection delay={0.2}>
              <div className="relative rounded-3xl bg-gradient-to-br from-violet-50 via-white to-pink-50 p-8 dark:from-violet-950/30 dark:via-background dark:to-pink-950/20">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="h-3 w-3 rounded-full bg-red-400" />
                    <div className="h-3 w-3 rounded-full bg-amber-400" />
                    <div className="h-3 w-3 rounded-full bg-emerald-400" />
                    <div className="ml-auto h-3 w-20 rounded-full bg-muted" />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: t('metricBookings'), value: '247', trend: '+18%', color: 'text-emerald-600' },
                      { label: t('metricClients'), value: '1,204', trend: '+12%', color: 'text-blue-600' },
                      { label: t('featFinance'), value: '$8.4K', trend: '+24%', color: 'text-violet-600' },
                    ].map((stat) => (
                      <div key={stat.label} className="rounded-xl bg-background/80 p-3">
                        <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                        <p className="mt-1 text-lg font-bold">{stat.value}</p>
                        <p className={cn('text-[10px] font-medium', stat.color)}>{stat.trend}</p>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2">
                    {[0.85, 0.62, 0.45, 0.78].map((w, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="h-2 w-2 rounded-full bg-violet-400" />
                        <div className="h-2.5 flex-1 rounded-full bg-muted">
                          <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500" style={{ width: `${w * 100}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </AnimatedSection>
          </div>
        </div>
      </section>

      {/* ═══════════════════ STATS GRADIENT (Fresha-style "Лучшая платформа") ═══════════════════ */}
      <section className="relative overflow-hidden px-6 py-20">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-600 via-indigo-600 to-purple-700" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.15),transparent_60%)]" />
        <div className="relative mx-auto max-w-4xl text-center text-white">
          <AnimatedSection>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{t('bestPlatform')}</h2>
            <p className="mx-auto mt-4 max-w-xl text-white/70">{t('bestPlatformDesc')}</p>
          </AnimatedSection>
          <AnimatedStagger className="mt-12 grid grid-cols-2 gap-8 sm:grid-cols-4">
            <AnimatedItem>
              <div>
                <AnimatedCounter value="130K+" className="text-4xl font-bold sm:text-5xl" />
                <p className="mt-2 text-sm text-white/60">{t('statsProfessionals')}</p>
              </div>
            </AnimatedItem>
            <AnimatedItem>
              <div>
                <AnimatedCounter value="120+" className="text-4xl font-bold sm:text-5xl" />
                <p className="mt-2 text-sm text-white/60">{t('metricCities')}</p>
              </div>
            </AnimatedItem>
            <AnimatedItem>
              <div>
                <AnimatedCounter value="1M+" className="text-4xl font-bold sm:text-5xl" />
                <p className="mt-2 text-sm text-white/60">{t('statsBookingsTotal')}</p>
              </div>
            </AnimatedItem>
            <AnimatedItem>
              <div>
                <AnimatedCounter value="4.9★" className="text-4xl font-bold sm:text-5xl" />
                <p className="mt-2 text-sm text-white/60">{t('metricRating')}</p>
              </div>
            </AnimatedItem>
          </AnimatedStagger>
        </div>
      </section>

      {/* ═══════════════════ FOR BUSINESS (Fresha-style CTA) ═══════════════════ */}
      <section className="px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-5xl">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <AnimatedSection>
              <div>
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{t('forBusiness')}</h2>
                <p className="mt-4 leading-relaxed text-muted-foreground">{t('forBusinessDesc')}</p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link
                    href="/register"
                    className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 transition-all hover:shadow-xl hover:shadow-violet-500/30 hover:brightness-110"
                  >
                    {t('getStarted')}
                    <ArrowRight className="size-4" />
                  </Link>
                  <Link
                    href="/#pricing"
                    className="inline-flex items-center gap-2 rounded-full border border-border px-8 py-3.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                  >
                    {t('pricing')}
                  </Link>
                </div>
              </div>
            </AnimatedSection>

            <AnimatedSection delay={0.2}>
              <div className="flex items-center justify-center gap-6">
                {/* Trust badges — like Fresha's Capterra/G2 logos */}
                <div className="space-y-4">
                  {[
                    { icon: Shield, title: t('trustSecure'), desc: t('trustSecureDesc') },
                    { icon: Zap, title: t('trustUptime'), desc: t('trustUptimeDesc') },
                    { icon: Heart, title: t('trustSupport'), desc: t('trustSupportDesc') },
                    { icon: Globe, title: t('trustPrivacy'), desc: t('trustPrivacyDesc') },
                  ].map((item) => (
                    <div key={item.title} className="flex items-start gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-950 dark:text-violet-400">
                        <item.icon className="size-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{item.title}</p>
                        <p className="text-xs text-muted-foreground">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </AnimatedSection>
          </div>
        </div>
      </section>

      {/* ═══════════════════ PRICING ═══════════════════ */}
      <section id="pricing" className="px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-5xl">
          <AnimatedSection>
            <div className="text-center">
              <p className="text-sm font-semibold uppercase tracking-widest text-violet-600 dark:text-violet-400">{t('pricing')}</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{t('pricingTitle')}</h2>
              <p className="mt-4 text-muted-foreground">{t('pricingSubtitle')}</p>
            </div>
          </AnimatedSection>

          <AnimatedStagger className="mt-14 grid grid-cols-1 items-stretch gap-6 pt-4 md:grid-cols-3">
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
      <section className="px-6 py-20 sm:py-28">
        <AnimatedSection>
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">{t('ctaTitle')}</h2>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground sm:text-lg">{t('ctaSubtitle')}</p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 px-10 py-4 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 transition-all hover:shadow-xl hover:shadow-violet-500/30 hover:brightness-110"
              >
                {t('ctaButton')}
                <ArrowRight className="size-4" />
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 rounded-full border border-border px-8 py-4 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                {t('contactUs')}
              </Link>
            </div>
            <p className="mt-6 text-sm text-muted-foreground">
              {t('freeTrial')} · {t('noCard')}
            </p>
          </div>
        </AnimatedSection>
      </section>
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
    <div className={cn(
      'relative flex h-full flex-col rounded-2xl bg-card p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl',
      highlighted
        ? 'ring-2 ring-violet-500/30 scale-[1.03]'
        : '',
    )}>
      {badge && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-1 text-xs font-semibold text-white shadow-md">
          {badge}
        </span>
      )}
      <div>
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="mt-2 text-4xl font-bold tracking-tight">{price}</p>
      </div>
      <div className="mt-6 flex-1 space-y-2.5">
        {features.map((f) => (
          <div key={f} className="flex items-center gap-2.5 text-sm">
            <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950">
              <Check className="size-3 text-emerald-600 dark:text-emerald-400" />
            </div>
            <span>{tp(f)}</span>
          </div>
        ))}
      </div>
      <Link
        href="/register"
        className={cn(
          'mt-6 block w-full rounded-full py-3 text-center text-sm font-semibold transition-all',
          highlighted
            ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/20 hover:shadow-xl hover:brightness-110'
            : 'border border-border bg-background text-foreground hover:bg-muted',
        )}
      >
        {buttonLabel}
      </Link>
    </div>
  );
}
