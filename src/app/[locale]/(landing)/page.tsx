/** --- YAML
 * name: Landing Page
 * description: Public landing page with hero, features, pricing sections. Entry point for new users.
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
} from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const featureIcons = {
  featCalendar: CalendarDays,
  featClients: Users,
  featFinance: DollarSign,
  featBooking: Globe,
  featMarketing: Megaphone,
  featInventory: Package,
} as const;

const featureKeys = Object.keys(featureIcons) as (keyof typeof featureIcons)[];

export default function LandingPage() {
  const t = useTranslations('landing');
  const tp = useTranslations('pricing');

  const starterFeatures = [
    'clients50', 'masters1', 'basicCalendar', 'basicClientCards',
    'reminders', 'basicFinance',
  ];
  const proFeatures = [
    'clients300', 'masters3', 'basicCalendar', 'basicClientCards',
    'reminders', 'basicFinance', 'waitlist', 'autoUpsell',
    'referral', 'inventory', 'consent', 'allergies',
    'extendedAnalytics', 'autoMessages',
  ];
  const businessFeatures = [
    'clientsUnlimited', 'mastersUnlimited', 'basicCalendar',
    'basicClientCards', 'reminders', 'basicFinance', 'waitlist',
    'autoUpsell', 'referral', 'inventory', 'consent', 'allergies',
    'extendedAnalytics', 'autoMessages', 'aiFeatures',
    'behaviorIndicators', 'fileStorage', 'equipmentBooking',
    'crossMarketing', 'autoReports', 'currencyTracking',
    'beforeAfter', 'giftCertificates', 'prioritySupport',
  ];

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <span className="text-xl font-bold tracking-tight">CRES-CA</span>
          <nav className="flex items-center gap-4">
            <Link href="#features" className="text-sm text-muted-foreground hover:text-foreground">
              {t('features')}
            </Link>
            <Link href="#pricing" className="text-sm text-muted-foreground hover:text-foreground">
              {t('pricing')}
            </Link>
            <Link href="/login" className={cn(buttonVariants({ size: 'sm', variant: 'outline' }))}>
              {tp('subscribe')}
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="flex flex-col items-center justify-center gap-6 py-24 px-4 text-center">
        <Badge variant="secondary" className="text-sm">
          {t('freeTrial')}
        </Badge>
        <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
          {t('heroTitle')}
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          {t('heroSubtitle')}
        </p>
        <div className="flex gap-4">
          <Link href="/register" className={cn(buttonVariants({ size: 'lg' }))}>
            {t('getStarted')}
          </Link>
          <Link href="#features" className={cn(buttonVariants({ size: 'lg', variant: 'outline' }))}>
            {t('learnMore')}
          </Link>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-4 bg-muted/50">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">{t('features')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featureKeys.map((key) => {
              const Icon = featureIcons[key];
              return (
                <Card key={key}>
                  <CardHeader>
                    <Icon className="h-8 w-8 mb-2 text-primary" />
                    <CardTitle>{t(key)}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      {t(`${key}Desc`)}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-4">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">{t('pricing')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {/* Starter */}
            <PricingCard
              title={tp('starter')}
              price={tp('starterPrice')}
              features={starterFeatures}
              tp={tp}
              buttonLabel={tp('subscribe')}
            />

            {/* Pro */}
            <PricingCard
              title={tp('pro')}
              price={tp('proPrice')}
              features={proFeatures}
              tp={tp}
              buttonLabel={tp('subscribe')}
              highlighted
              badge={tp('popular')}
            />

            {/* Business */}
            <PricingCard
              title={tp('business')}
              price={tp('businessPrice')}
              features={businessFeatures}
              tp={tp}
              buttonLabel={tp('subscribe')}
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 px-4 mt-auto">
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
    <Card className={cn(highlighted && 'border-primary ring-2 ring-primary relative')}>
      {badge && (
        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
          {badge}
        </Badge>
      )}
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <p className="text-3xl font-bold">{price}</p>
      </CardHeader>
      <CardContent className="space-y-2">
        {features.map((f) => (
          <div key={f} className="flex items-center gap-2 text-sm">
            <Check className="h-4 w-4 text-green-500 shrink-0" />
            <span>{tp(f)}</span>
          </div>
        ))}
        <Link
          href="/register"
          className={cn(buttonVariants(), 'w-full mt-4')}
        >
          {buttonLabel}
        </Link>
      </CardContent>
    </Card>
  );
}
