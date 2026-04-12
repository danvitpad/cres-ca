/** --- YAML
 * name: Create Business Wizard
 * description: Fresha-style 5-step onboarding wizard for creating a new business with map and completion screen
 * --- */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';
import {
  ArrowLeft,
  ArrowRight,
  Scissors,
  Sparkles,
  Eye,
  Star,
  Stethoscope,
  UserRound,
  HandHelping,
  Flame,
  Droplets,
  Dumbbell,
  Activity,
  Heart,
  PawPrint,
  GraduationCap,
  Wrench,
  SprayCan,
  MoreHorizontal,
  Building2,
  Users,
  Car,
  Monitor,
  Search,
  Check,
  MapPin,
  Pencil,
} from 'lucide-react';

const AddressMap = dynamic(() => import('./address-map'), { ssr: false });

const TOTAL_STEPS = 5;

const CATEGORIES = [
  { key: 'categoryHairdressing', icon: Scissors },
  { key: 'categoryNails', icon: Sparkles },
  { key: 'categoryBrowsLashes', icon: Eye },
  { key: 'categoryBeautySalon', icon: Star },
  { key: 'categoryMedspa', icon: Stethoscope },
  { key: 'categoryBarber', icon: UserRound },
  { key: 'categoryMassage', icon: HandHelping },
  { key: 'categorySpa', icon: Droplets },
  { key: 'categoryWaxing', icon: Flame },
  { key: 'categoryTattoo', icon: Sparkles },
  { key: 'categoryTanning', icon: Star },
  { key: 'categoryFitness', icon: Dumbbell },
  { key: 'categoryPhysio', icon: Activity },
  { key: 'categoryMedical', icon: Heart },
  { key: 'categoryPets', icon: PawPrint },
  { key: 'categoryTutoring', icon: GraduationCap },
  { key: 'categoryPlumbing', icon: Wrench },
  { key: 'categoryCleaning', icon: SprayCan },
  { key: 'categoryOther', icon: MoreHorizontal },
] as const;

const LOCATION_OPTIONS = [
  { key: 'locationPhysical', icon: Building2 },
  { key: 'locationMobile', icon: Car },
  { key: 'locationOnline', icon: Monitor },
] as const;

interface GeoResult {
  display_name: string;
  lat: string;
  lon: string;
}

export default function CreateBusinessPage() {
  const t = useTranslations('onboarding');
  const tc = useTranslations('common');
  const router = useRouter();
  const [step, setStep] = useState(1);

  // Form state
  const [businessName, setBusinessName] = useState('');
  const [website, setWebsite] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [teamType, setTeamType] = useState<'solo' | 'team' | null>(null);
  const [locationType, setLocationType] = useState<string | null>(null);
  const [address, setAddress] = useState('');
  const [addressResults, setAddressResults] = useState<GeoResult[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<GeoResult | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  const effectiveSteps = locationType === 'locationPhysical' ? TOTAL_STEPS : TOTAL_STEPS - 1;

  const canContinue = () => {
    switch (step) {
      case 1: return businessName.trim().length > 0;
      case 2: return selectedCategories.length > 0;
      case 3: return teamType !== null;
      case 4: return locationType !== null;
      case 5: return selectedAddress !== null;
      default: return false;
    }
  };

  const handleContinue = () => {
    if (step === 4 && locationType !== 'locationPhysical') {
      setStep(TOTAL_STEPS + 1); // go to completion
      return;
    }
    if (step < TOTAL_STEPS) {
      setStep(step + 1);
    } else {
      setStep(TOTAL_STEPS + 1); // completion
    }
  };

  const handleBack = () => {
    if (step === TOTAL_STEPS + 1) {
      // From completion, go back to last real step
      setStep(locationType === 'locationPhysical' ? TOTAL_STEPS : 4);
    } else if (step > 1) {
      setStep(step - 1);
    } else {
      router.back();
    }
  };

  const handleFinish = () => {
    // TODO: Save business data to Supabase
    router.push('/calendar');
  };

  const toggleCategory = (key: string) => {
    setSelectedCategories((prev) => {
      if (prev.includes(key)) return prev.filter((k) => k !== key);
      if (prev.length >= 4) return prev;
      return [...prev, key];
    });
  };

  // Address search with Nominatim (debounced)
  const searchAddress = useCallback(async (query: string) => {
    if (query.length < 3) {
      setAddressResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`,
        { headers: { 'Accept-Language': 'ru' } }
      );
      const data: GeoResult[] = await res.json();
      setAddressResults(data);
    } catch {
      setAddressResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleAddressInput = (value: string) => {
    setAddress(value);
    setSelectedAddress(null);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => searchAddress(value), 400);
  };

  const selectAddress = (result: GeoResult) => {
    setSelectedAddress(result);
    setAddress(result.display_name);
    setMapCenter([parseFloat(result.lat), parseFloat(result.lon)]);
    setAddressResults([]);
  };

  const handleMapMove = (lat: number, lng: number) => {
    setMapCenter([lat, lng]);
    if (selectedAddress) {
      setSelectedAddress({ ...selectedAddress, lat: String(lat), lon: String(lng) });
    }
  };

  const progress = step <= TOTAL_STEPS ? (step / effectiveSteps) * 100 : 100;
  const isCompletion = step === TOTAL_STEPS + 1;

  return (
    <div className="fixed inset-0 flex flex-col bg-background">
      {/* Top bar with progress — hidden on completion */}
      {!isCompletion && (
        <div className="shrink-0 border-b border-border">
          {/* Progress bar */}
          <div className="h-1 bg-muted">
            <motion.div
              className="h-full bg-primary"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            />
          </div>

          {/* Navigation bar */}
          <div className="flex items-center justify-between px-4 py-3 md:px-8">
            <button
              onClick={handleBack}
              className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
              <span className="hidden sm:inline">{t('back')}</span>
            </button>

            <span className="text-sm text-muted-foreground">
              {t('step', { current: Math.min(step, effectiveSteps), total: effectiveSteps })}
            </span>

            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push('/onboarding/account-type')}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {t('close')}
              </button>
              <button
                onClick={handleContinue}
                disabled={!canContinue()}
                className="flex items-center gap-1.5 rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background transition-opacity disabled:opacity-40"
              >
                {t('continue')}
                <ArrowRight className="size-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step content */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-6 py-10 md:py-16">
          <AnimatePresence mode="wait">
            {/* Step 1: Business Name */}
            {step === 1 && (
              <StepWrapper key="step1">
                <p className="text-sm text-muted-foreground">{t('setupAccount')}</p>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">
                  {t('businessNameTitle')}
                </h1>
                <p className="mt-2 text-muted-foreground">{t('businessNameDesc')}</p>

                <div className="mt-8 space-y-5">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">{t('businessName')}</label>
                    <input
                      type="text"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      className="w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground outline-none transition-colors focus:border-primary"
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      {t('website')}{' '}
                      <span className="text-muted-foreground">({t('websiteOptional')})</span>
                    </label>
                    <input
                      type="text"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      placeholder={t('websitePlaceholder')}
                      className="w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground/50 outline-none transition-colors focus:border-primary"
                    />
                  </div>
                </div>
              </StepWrapper>
            )}

            {/* Step 2: Categories with "Primary" badge + numbering */}
            {step === 2 && (
              <StepWrapper key="step2">
                <p className="text-sm text-muted-foreground">{t('setupAccount')}</p>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">
                  {t('categoriesTitle')}
                </h1>
                <p className="mt-2 text-muted-foreground">{t('categoriesDesc')}</p>

                <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                  {CATEGORIES.map(({ key, icon: Icon }) => {
                    const selIndex = selectedCategories.indexOf(key);
                    const isSelected = selIndex !== -1;
                    const isPrimary = selIndex === 0;

                    return (
                      <button
                        key={key}
                        onClick={() => toggleCategory(key)}
                        className={`relative flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-all ${
                          isSelected
                            ? 'border-primary bg-primary/5 text-foreground'
                            : 'border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground'
                        }`}
                      >
                        {isSelected && (
                          <div className="absolute right-2 top-2">
                            {isPrimary ? (
                              <span className="rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                                {t('categoryPrimary')}
                              </span>
                            ) : (
                              <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                                {selIndex + 1}
                              </span>
                            )}
                          </div>
                        )}
                        <Icon className="size-6" />
                        <span className="text-xs font-medium leading-tight">{t(key)}</span>
                      </button>
                    );
                  })}
                </div>
              </StepWrapper>
            )}

            {/* Step 3: Account type */}
            {step === 3 && (
              <StepWrapper key="step3">
                <p className="text-sm text-muted-foreground">{t('setupAccount')}</p>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">
                  {t('accountTypeStepTitle')}
                </h1>
                <p className="mt-2 text-muted-foreground">{t('accountTypeStepDesc')}</p>

                <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                  <button
                    onClick={() => setTeamType('solo')}
                    className={`flex flex-1 flex-col items-center gap-3 rounded-xl border p-6 transition-all ${
                      teamType === 'solo'
                        ? 'border-primary bg-primary/5'
                        : 'border-border bg-card hover:border-primary/30'
                    }`}
                  >
                    <UserRound className="size-8 text-muted-foreground" />
                    <span className="font-medium">{t('soloWorker')}</span>
                  </button>

                  <button
                    onClick={() => setTeamType('team')}
                    className={`flex flex-1 flex-col items-center gap-3 rounded-xl border p-6 transition-all ${
                      teamType === 'team'
                        ? 'border-primary bg-primary/5'
                        : 'border-border bg-card hover:border-primary/30'
                    }`}
                  >
                    <Users className="size-8 text-muted-foreground" />
                    <span className="font-medium">{t('hasTeam')}</span>
                  </button>
                </div>
              </StepWrapper>
            )}

            {/* Step 4: Location type */}
            {step === 4 && (
              <StepWrapper key="step4">
                <p className="text-sm text-muted-foreground">{t('setupAccount')}</p>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">
                  {t('locationTitle')}
                </h1>

                <div className="mt-8 flex flex-col gap-3">
                  {LOCATION_OPTIONS.map(({ key, icon: Icon }) => (
                    <button
                      key={key}
                      onClick={() => setLocationType(key)}
                      className={`flex items-center gap-4 rounded-xl border p-5 text-left transition-all ${
                        locationType === key
                          ? 'border-primary bg-primary/5'
                          : 'border-border bg-card hover:border-primary/30'
                      }`}
                    >
                      {locationType === key ? (
                        <div className="flex size-5 items-center justify-center rounded-full bg-primary">
                          <Check className="size-3 text-primary-foreground" />
                        </div>
                      ) : (
                        <div className="size-5 rounded-full border-2 border-muted-foreground/30" />
                      )}
                      <span className="font-medium">{t(key)}</span>
                    </button>
                  ))}
                </div>
              </StepWrapper>
            )}

            {/* Step 5: Address with map */}
            {step === 5 && (
              <StepWrapper key="step5">
                <p className="text-sm text-muted-foreground">{t('setupAccount')}</p>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">
                  {t('addressTitle')}
                </h1>
                <p className="mt-2 text-muted-foreground">{t('addressDesc')}</p>

                <div className="mt-8 space-y-6">
                  {/* Selected address display */}
                  {selectedAddress && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-start justify-between rounded-lg border border-border p-4"
                    >
                      <div className="flex gap-3">
                        <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
                        <p className="text-sm leading-relaxed">{selectedAddress.display_name}</p>
                      </div>
                      <button
                        onClick={() => { setSelectedAddress(null); setMapCenter(null); setAddress(''); }}
                        className="ml-3 shrink-0 text-sm text-primary hover:underline"
                      >
                        {t('addressChange')}
                      </button>
                    </motion.div>
                  )}

                  {/* Search input — hidden once address is selected */}
                  {!selectedAddress && (
                    <div className="relative">
                      <label className="mb-2 block text-sm font-medium">{t('addressSearch')}</label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <input
                          type="text"
                          value={address}
                          onChange={(e) => handleAddressInput(e.target.value)}
                          placeholder={t('addressPlaceholder')}
                          className="w-full rounded-lg border border-border bg-background py-3 pl-10 pr-4 text-foreground placeholder:text-muted-foreground/50 outline-none transition-colors focus:border-primary"
                          autoFocus
                        />
                      </div>

                      {/* Search results dropdown */}
                      {addressResults.length > 0 && (
                        <div className="absolute left-0 right-0 top-full z-10 mt-1 rounded-lg border border-border bg-card shadow-lg">
                          {addressResults.map((result, i) => (
                            <button
                              key={i}
                              onClick={() => selectAddress(result)}
                              className="flex w-full items-start gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-muted first:rounded-t-lg last:rounded-b-lg"
                            >
                              <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                              <span className="line-clamp-2">{result.display_name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Map */}
                  {mapCenter && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-2"
                    >
                      <p className="text-sm font-medium">{t('addressMapHint')}</p>
                      <div className="h-64 overflow-hidden rounded-xl border border-border">
                        <AddressMap
                          center={mapCenter}
                          onMove={handleMapMove}
                        />
                      </div>
                    </motion.div>
                  )}
                </div>
              </StepWrapper>
            )}

            {/* Completion screen */}
            {isCompletion && (
              <motion.div
                key="completion"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                className="flex flex-col items-center justify-center py-20 text-center"
              >
                {/* Animated check circle */}
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 15 }}
                  className="flex size-20 items-center justify-center rounded-full bg-gradient-to-br from-primary/80 to-violet-500"
                >
                  <motion.div
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ delay: 0.5, duration: 0.4 }}
                  >
                    <Check className="size-10 text-white" strokeWidth={3} />
                  </motion.div>
                </motion.div>

                <motion.h1
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                  className="mt-8 text-2xl font-semibold md:text-3xl"
                >
                  {t('onboardingComplete')}
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 }}
                  className="mt-3 text-muted-foreground"
                >
                  {t('onboardingCompleteDesc')}
                </motion.p>

                <motion.button
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.9 }}
                  onClick={handleFinish}
                  className="mt-8 rounded-full bg-foreground px-8 py-3 font-medium text-background transition-opacity hover:opacity-90"
                >
                  {t('goToDashboard')}
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function StepWrapper({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}
