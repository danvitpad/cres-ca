/** --- YAML
 * name: Create Business Wizard
 * description: Fresha-style onboarding wizard for creating a new business with map and completion screen. Steps adapt based on user role and location type.
 * created: 2026-04-13
 * updated: 2026-04-16
 * --- */

'use client';

import { useState, useCallback, useRef, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { getDefaultServices, getServicesForCategories, type DefaultService } from '@/lib/verticals/default-services';
import { getSpecializations, getSpecializationsForCategories } from '@/lib/verticals/specializations';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  ImagePlus,
  X as XIcon,
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
} from 'lucide-react';

import TeamModePicker, { type TeamMode } from '@/components/onboarding/TeamModePicker';

const AddressMap = dynamic(() => import('./address-map'), { ssr: false });

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

/**
 * Steps in the wizard (logical step numbers):
 * 1 — Business name + photos + website
 * 2 — Categories (sub-categories within vertical)
 * 3 — Specialization (derived from selected categories)
 * 4 — Account type: solo / team (SKIPPED if role known from registration)
 * 5 — Location type
 * 6 — Address + map (SKIPPED if not physical)
 * 7 — Popular services (derived from selected categories)
 * 8 — Completion / invite screen
 */

export default function CreateBusinessPage() {
  return (
    <Suspense fallback={null}>
      <CreateBusinessWizard />
    </Suspense>
  );
}

function CreateBusinessWizard() {
  const t = useTranslations('onboarding');
  const router = useRouter();
  const searchParams = useSearchParams();
  const vertical = searchParams.get('vertical');

  // Detect user role from Supabase metadata to skip solo/team step
  const [userRole, setUserRole] = useState<string | null>(null);
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      const role = data.user?.user_metadata?.role as string | undefined;
      if (role) setUserRole(role);
    });
  }, []);

  const skipTeamStep = userRole === 'master' || userRole === 'salon_admin';
  const inferredTeamType = userRole === 'salon_admin' ? 'team' : 'solo';

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Form state
  const [businessName, setBusinessName] = useState('');
  const [website, setWebsite] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [teamType, setTeamType] = useState<'solo' | 'team' | null>(null);
  const [teamMode, setTeamMode] = useState<TeamMode | null>(null);
  const [defaultCommission, setDefaultCommission] = useState<number>(50);
  const [ownerRent, setOwnerRent] = useState<number>(0);
  const [locationType, setLocationType] = useState<string | null>(null);
  const [address, setAddress] = useState('');
  const [addressResults, setAddressResults] = useState<GeoResult[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<GeoResult | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  // Specializations derived from selected categories
  const specializationOptions = selectedCategories.length > 0
    ? getSpecializationsForCategories(selectedCategories)
    : getSpecializations(vertical);
  const [specialization, setSpecialization] = useState<string | null>(null);

  // Services derived from selected categories
  const categoryServices = selectedCategories.length > 0
    ? getServicesForCategories(selectedCategories)
    : getDefaultServices(vertical);
  const [selectedServiceKeys, setSelectedServiceKeys] = useState<Set<string>>(new Set());

  // Re-sync selected services when categories change
  const prevCategoriesRef = useRef<string[]>([]);
  useEffect(() => {
    const prev = prevCategoriesRef.current;
    const changed = prev.length !== selectedCategories.length || prev.some((c, i) => c !== selectedCategories[i]);
    if (changed) {
      prevCategoriesRef.current = selectedCategories;
      const newServices = selectedCategories.length > 0
        ? getServicesForCategories(selectedCategories)
        : getDefaultServices(vertical);
      setSelectedServiceKeys(new Set(newServices.map((s) => s.name)));
      // Reset specialization when categories change
      const newSpecs = selectedCategories.length > 0
        ? getSpecializationsForCategories(selectedCategories)
        : getSpecializations(vertical);
      if (newSpecs.length > 0 && (!specialization || !newSpecs.includes(specialization))) {
        setSpecialization(newSpecs[0]);
      }
    }
  }, [selectedCategories, vertical, specialization]);

  // Build the ordered list of visible steps (skipping where needed)
  const buildStepSequence = useCallback(() => {
    const steps: number[] = [1, 2, 3]; // name, categories, specialization
    if (!skipTeamStep) steps.push(4); // solo/team
    const effectiveTeamType = skipTeamStep ? inferredTeamType : teamType;
    if (effectiveTeamType === 'team') steps.push(45); // team mode (unified/marketplace) + commission
    steps.push(5); // location type
    if (locationType === 'locationPhysical') steps.push(6); // address
    steps.push(7); // services
    return steps;
  }, [skipTeamStep, inferredTeamType, teamType, locationType]);

  const stepSequence = buildStepSequence();
  const totalVisibleSteps = stepSequence.length;
  const currentVisibleIndex = stepSequence.indexOf(step);
  const visibleStep = currentVisibleIndex >= 0 ? currentVisibleIndex + 1 : totalVisibleSteps;
  const isCompletion = step === 8;

  const canContinue = () => {
    switch (step) {
      case 1: return businessName.trim().length > 0;
      case 2: return selectedCategories.length > 0;
      case 3: return specialization !== null;
      case 4: return teamType !== null;
      case 45: return teamMode !== null;
      case 5: return locationType !== null;
      case 6: return selectedAddress !== null;
      case 7: return true;
      default: return false;
    }
  };

  const getNextStep = (current: number): number => {
    const idx = stepSequence.indexOf(current);
    if (idx === -1 || idx >= stepSequence.length - 1) return 8; // completion
    return stepSequence[idx + 1];
  };

  const getPrevStep = (current: number): number | null => {
    const idx = stepSequence.indexOf(current);
    if (idx <= 0) return null;
    return stepSequence[idx - 1];
  };

  const handleContinue = () => {
    if (step === 7) {
      // Last content step -> submit, then completion
      return;
    }
    setStep(getNextStep(step));
  };

  const toggleService = (name: string) => {
    setSelectedServiceKeys((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const handleBack = () => {
    if (isCompletion) {
      setStep(7);
      return;
    }
    const prev = getPrevStep(step);
    if (prev !== null) {
      setStep(prev);
    } else {
      router.back();
    }
  };

  const handleFileSelect = (kind: 'avatar' | 'cover', file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    if (file.size > 8 * 1024 * 1024) {
      setSubmitError('file_too_large');
      return;
    }
    const url = URL.createObjectURL(file);
    if (kind === 'avatar') {
      setAvatarFile(file);
      setAvatarPreview(url);
    } else {
      setCoverFile(file);
      setCoverPreview(url);
    }
  };

  const uploadMedia = async (): Promise<{ avatarUrl: string | null; coverUrl: string | null }> => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { avatarUrl: null, coverUrl: null };

    let avatarUrl: string | null = null;
    let coverUrl: string | null = null;

    if (avatarFile) {
      const ext = avatarFile.name.split('.').pop() || 'jpg';
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('avatars').upload(path, avatarFile, {
        cacheControl: '3600',
        upsert: false,
      });
      if (!error) {
        avatarUrl = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
      }
    }
    if (coverFile) {
      const ext = coverFile.name.split('.').pop() || 'jpg';
      const path = `${user.id}/cover-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('avatars').upload(path, coverFile, {
        cacheControl: '3600',
        upsert: false,
      });
      if (!error) {
        coverUrl = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
      }
    }
    return { avatarUrl, coverUrl };
  };

  const handleFinish = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const { avatarUrl, coverUrl } = await uploadMedia();
      const services: DefaultService[] = categoryServices.filter((s) => selectedServiceKeys.has(s.name));
      const effectiveTeamType = skipTeamStep ? inferredTeamType : (teamType ?? 'solo');
      const effectiveTeamMode = effectiveTeamType === 'team' ? (teamMode ?? 'unified') : undefined;
      const res = await fetch('/api/business/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: businessName,
          vertical,
          teamType: effectiveTeamType,
          teamMode: effectiveTeamMode,
          defaultMasterCommission: effectiveTeamMode === 'unified' ? defaultCommission : undefined,
          ownerRentPerMaster: effectiveTeamMode === 'marketplace' ? ownerRent : undefined,
          categories: selectedCategories,
          address: selectedAddress?.display_name ?? null,
          latitude: selectedAddress ? parseFloat(selectedAddress.lat) : null,
          longitude: selectedAddress ? parseFloat(selectedAddress.lon) : null,
          city: null,
          services,
          avatarUrl,
          coverUrl,
          specialization,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(j.error ?? 'failed');
      }
      if (j.inviteCode) setInviteCode(j.inviteCode);
      setStep(8); // show completion / invite screen
      setSubmitting(false);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'unknown');
      setSubmitting(false);
    }
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

  // Suppress unused var warning
  void isSearching;

  return (
    <div className="fixed inset-0 flex flex-col bg-background">
      {/* Top bar with progress — hidden on completion */}
      {!isCompletion && (
        <div className="shrink-0 border-b border-border">
          {/* Segmented progress bar */}
          <div className="flex h-1 gap-0.5 bg-muted px-0.5 pt-0.5">
            {Array.from({ length: totalVisibleSteps }, (_, i) => (
              <motion.div
                key={i}
                className={`h-full flex-1 rounded-full ${
                  i < visibleStep ? 'bg-primary' : 'bg-muted-foreground/15'
                }`}
                initial={{ opacity: 0.5 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              />
            ))}
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
              {t('step', { current: visibleStep, total: totalVisibleSteps })}
            </span>

            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push('/onboarding/account-type')}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {t('close')}
              </button>
              {step !== 7 && (
                <button
                  onClick={handleContinue}
                  disabled={!canContinue()}
                  className="flex items-center gap-1.5 rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background transition-opacity disabled:opacity-40"
                >
                  {t('continue')}
                  <ArrowRight className="size-3.5" />
                </button>
              )}
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
                  {/* Cover + avatar uploaders */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => coverInputRef.current?.click()}
                      className="group relative block h-36 w-full overflow-hidden rounded-xl border border-dashed border-border bg-muted/30 transition-colors hover:border-primary/40"
                    >
                      {coverPreview ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={coverPreview} alt="" className="h-full w-full object-cover" />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/20">
                            <Camera className="size-6 text-white opacity-0 transition-opacity group-hover:opacity-100" />
                          </div>
                        </>
                      ) : (
                        <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
                          <ImagePlus className="size-6" />
                          <span className="text-xs">{t('coverUploadHint')}</span>
                        </div>
                      )}
                    </button>
                    {coverPreview && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setCoverFile(null); setCoverPreview(null); }}
                        className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-colors hover:bg-black/80"
                      >
                        <XIcon className="size-3.5" />
                      </button>
                    )}
                    <input
                      ref={coverInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleFileSelect('cover', e.target.files?.[0] ?? null)}
                    />

                    {/* Avatar circle overlapping cover bottom-left */}
                    <div className="absolute -bottom-8 left-4">
                      <button
                        type="button"
                        onClick={() => avatarInputRef.current?.click()}
                        className="group relative flex size-20 items-center justify-center overflow-hidden rounded-full border-4 border-background bg-muted shadow-md transition-transform hover:scale-[1.02]"
                      >
                        {avatarPreview ? (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={avatarPreview} alt="" className="h-full w-full object-cover" />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/30">
                              <Camera className="size-4 text-white opacity-0 transition-opacity group-hover:opacity-100" />
                            </div>
                          </>
                        ) : (
                          <Camera className="size-5 text-muted-foreground" />
                        )}
                      </button>
                      <input
                        ref={avatarInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleFileSelect('avatar', e.target.files?.[0] ?? null)}
                      />
                    </div>
                  </div>
                  <div className="h-6" />

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

            {/* Step 3: Specialization (derived from selected categories) */}
            {step === 3 && (
              <StepWrapper key="step3">
                <p className="text-sm text-muted-foreground">{t('setupAccount')}</p>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">
                  {t('specializationLabel')}
                </h1>
                <p className="mt-2 text-muted-foreground">{t('specializationDesc')}</p>

                {specializationOptions.length > 0 && (
                  <div className="mt-8 flex flex-wrap gap-2">
                    {specializationOptions.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSpecialization(s)}
                        className={`rounded-full border px-4 py-2.5 text-sm font-medium transition-colors ${
                          specialization === s
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </StepWrapper>
            )}

            {/* Step 4: Account type (SKIPPED if role known from registration) */}
            {step === 4 && (
              <StepWrapper key="step4">
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

            {/* Step 4.5: Team mode (unified / marketplace) */}
            {step === 45 && (
              <StepWrapper key="step45">
                <p className="text-sm text-muted-foreground">{t('setupAccount')}</p>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">
                  Режим команды
                </h1>
                <p className="mt-2 text-muted-foreground">
                  Выберите, как вы работаете с мастерами. Это нельзя изменить после создания салона.
                </p>

                <div className="mt-8">
                  <TeamModePicker value={teamMode} onChange={setTeamMode} />
                </div>

                {teamMode === 'unified' && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-6 space-y-3"
                  >
                    <label className="block text-sm font-medium">
                      Комиссия мастера по умолчанию: <span className="text-primary">{defaultCommission}%</span>
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={defaultCommission}
                      onChange={(e) => setDefaultCommission(parseInt(e.target.value, 10))}
                      className="w-full accent-primary"
                    />
                    <p className="text-xs text-muted-foreground">
                      Процент от выручки, который получает мастер. Можно настроить индивидуально для каждого.
                    </p>
                  </motion.div>
                )}

                {teamMode === 'marketplace' && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-6 space-y-3"
                  >
                    <label className="block text-sm font-medium">Аренда с мастера в месяц (₴)</label>
                    <input
                      type="number"
                      min={0}
                      step={100}
                      value={ownerRent}
                      onChange={(e) => setOwnerRent(Math.max(0, parseInt(e.target.value || '0', 10)))}
                      className="w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground outline-none focus:border-primary"
                    />
                    <p className="text-xs text-muted-foreground">
                      Фиксированная сумма аренды. Можно оставить 0 и настроить индивидуально для каждого мастера.
                    </p>
                  </motion.div>
                )}
              </StepWrapper>
            )}

            {/* Step 5: Location type */}
            {step === 5 && (
              <StepWrapper key="step5">
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

            {/* Step 6: Address with map */}
            {step === 6 && (
              <StepWrapper key="step6">
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

            {/* Step 7: Default services preview (derived from selected categories) */}
            {step === 7 && (
              <StepWrapper key="step7">
                <p className="text-sm text-muted-foreground">{t('setupAccount')}</p>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">
                  {t('servicesTitle')}
                </h1>
                <p className="mt-2 text-muted-foreground">
                  {categoryServices.length > 0
                    ? t('servicesDesc')
                    : t('servicesEmpty')}
                </p>

                {categoryServices.length > 0 && (
                  <div className="mt-8 space-y-2">
                    {categoryServices.map((s) => {
                      const checked = selectedServiceKeys.has(s.name);
                      return (
                        <button
                          key={s.name}
                          type="button"
                          onClick={() => toggleService(s.name)}
                          className={`flex w-full items-center justify-between rounded-xl border p-4 text-left transition-all ${
                            checked
                              ? 'border-primary bg-primary/5'
                              : 'border-border bg-card hover:border-primary/30'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 ${
                                checked ? 'border-primary bg-primary' : 'border-muted-foreground/30'
                              }`}
                            >
                              {checked && <Check className="size-3 text-primary-foreground" />}
                            </div>
                            <span className="font-medium">{s.name}</span>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {s.duration_minutes > 0 && `${s.duration_minutes} ${t('serviceMinutes')} · `}
                            {s.price > 0 ? `${s.price}${t('serviceCurrency')}` : t('serviceOnRequest')}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="mt-8 flex justify-end">
                  <button
                    onClick={handleFinish}
                    disabled={submitting}
                    className="rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition-opacity disabled:opacity-40"
                  >
                    {submitting ? t('servicesCreating') : t('servicesFinish')}
                  </button>
                </div>
                {submitError && (
                  <p className="mt-3 text-right text-xs text-rose-500">{t('servicesError')}: {submitError}</p>
                )}
              </StepWrapper>
            )}

            {/* Completion / invite-first-clients screen */}
            {isCompletion && (
              <InviteScreen
                inviteCode={inviteCode}
                copied={copied}
                setCopied={setCopied}
                onGoDashboard={() => router.push('/today')}
                t={t}
              />
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function InviteScreen({
  inviteCode,
  copied,
  setCopied,
  onGoDashboard,
  t,
}: {
  inviteCode: string | null;
  copied: boolean;
  setCopied: (v: boolean) => void;
  onGoDashboard: () => void;
  t: (key: string) => string;
}) {
  const appUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const webLink = inviteCode ? `${appUrl}/invite/${inviteCode}` : '';
  const tgBot = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'cres_ca_bot';
  const tgLink = inviteCode ? `https://t.me/${tgBot}?start=master_${inviteCode}` : '';

  const copy = async () => {
    if (!webLink) return;
    try {
      await navigator.clipboard.writeText(webLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const shareTelegram = () => {
    if (!tgLink) return;
    const text = encodeURIComponent(t('inviteShareText'));
    window.open(`https://t.me/share/url?url=${encodeURIComponent(tgLink)}&text=${text}`, '_blank');
  };

  return (
    <motion.div
      key="completion"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="flex flex-col items-center py-14 text-center"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 15 }}
        className="flex size-16 items-center justify-center rounded-full bg-gradient-to-br from-primary/80 to-violet-500"
      >
        <Check className="size-8 text-white" strokeWidth={3} />
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="mt-6 text-2xl font-semibold md:text-3xl"
      >
        {t('inviteTitle')}
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="mt-3 max-w-md text-muted-foreground"
      >
        {t('inviteDesc')}
      </motion.p>

      {inviteCode && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mt-8 w-full max-w-md space-y-3"
        >
          <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/30 p-3">
            <div className="flex-1 truncate text-left text-sm text-muted-foreground">{webLink}</div>
            <button
              type="button"
              onClick={copy}
              className="shrink-0 rounded-lg bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-90"
            >
              {copied ? t('inviteCopied') : t('inviteCopy')}
            </button>
          </div>

          <button
            type="button"
            onClick={shareTelegram}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#229ED9] px-4 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295l.213-3.053 5.56-5.022c.24-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.64-.203-.658-.643.135-.953l11.566-4.458c.538-.196 1.006.128.832.938z" />
            </svg>
            {t('inviteShareTelegram')}
          </button>
        </motion.div>
      )}

      <motion.button
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        onClick={onGoDashboard}
        className="mt-8 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        {t('inviteSkip')}
      </motion.button>
    </motion.div>
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
