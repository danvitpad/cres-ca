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
import { ImageCropDialog } from '@/components/ui/image-crop-dialog';
import { getVerticalCopy } from '@/lib/verticals/copy';

const AddressMap = dynamic(() => import('./address-map'), { ssr: false });

/**
 * Категории, привязанные к одной или нескольким вертикалям. На шаге выбора
 * категорий показываем только те, чья vertical совпадает с выбранной на
 * предыдущем шаге (или содержит '*' для «универсальных»).
 */
type CategoryDef = {
  key: string;
  icon: React.ComponentType<{ className?: string }>;
  verticals: readonly string[];
};

const CATEGORIES: readonly CategoryDef[] = [
  // Beauty
  { key: 'categoryHairdressing', icon: Scissors, verticals: ['beauty'] },
  { key: 'categoryNails', icon: Sparkles, verticals: ['beauty'] },
  { key: 'categoryBrowsLashes', icon: Eye, verticals: ['beauty'] },
  { key: 'categoryBeautySalon', icon: Star, verticals: ['beauty'] },
  { key: 'categoryBarber', icon: UserRound, verticals: ['beauty'] },
  { key: 'categoryWaxing', icon: Flame, verticals: ['beauty'] },
  { key: 'categorySpa', icon: Droplets, verticals: ['beauty'] },
  { key: 'categoryTanning', icon: Star, verticals: ['beauty'] },
  // Health (overlap with beauty for medspa/massage)
  { key: 'categoryMedspa', icon: Stethoscope, verticals: ['beauty', 'health'] },
  { key: 'categoryMassage', icon: HandHelping, verticals: ['beauty', 'health'] },
  { key: 'categoryPhysio', icon: Activity, verticals: ['health'] },
  { key: 'categoryMedical', icon: Heart, verticals: ['health'] },
  // Tattoo
  { key: 'categoryTattoo', icon: Sparkles, verticals: ['tattoo'] },
  // Fitness
  { key: 'categoryFitness', icon: Dumbbell, verticals: ['fitness'] },
  // Pets
  { key: 'categoryPets', icon: PawPrint, verticals: ['pets'] },
  // Education
  { key: 'categoryTutoring', icon: GraduationCap, verticals: ['education'] },
  // Craft / repair
  { key: 'categoryPlumbing', icon: Wrench, verticals: ['craft'] },
  { key: 'categoryCleaning', icon: SprayCan, verticals: ['craft'] },
  // Universal escape hatch
  { key: 'categoryOther', icon: MoreHorizontal, verticals: ['*'] },
];

function categoriesForVertical(vertical: string | null): readonly CategoryDef[] {
  if (!vertical) return CATEGORIES;
  return CATEGORIES.filter((c) => c.verticals.includes(vertical) || c.verticals.includes('*'));
}

// LOCATION_OPTIONS перенесены inline в step 5 — лейблы теперь приходят из
// getVerticalCopy() и зависят от выбранной ниши + роли. Оставлен константный
// набор ключей чтобы остальной код не сломался (используются как `locationType`).
const _LOCATION_KEYS = ['locationPhysical', 'locationMobile', 'locationOnline'] as const;
void _LOCATION_KEYS;
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

  // Detect user role from Supabase metadata to skip solo/team step.
  // For solo masters we also auto-fill the «business name» from their full name
  // and skip the cover/avatar step — they'll add those in the dashboard later.
  const [userRole, setUserRole] = useState<string | null>(null);
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      const role = data.user?.user_metadata?.role as string | undefined;
      if (role) setUserRole(role);
      // Pre-fill businessName with the user's full_name for solo flows so the
      // create-business endpoint always has something even if step 1 is skipped.
      const fullName = (data.user?.user_metadata?.full_name as string | undefined)
        ?? data.user?.email
        ?? '';
      if (fullName) setBusinessName((prev) => (prev ? prev : fullName));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  // Cropper state — какой kind кадрируем + raw URL выбранной картинки
  const [cropKind, setCropKind] = useState<'avatar' | 'cover' | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  // Свободный ввод когда выбран categoryOther — пишем в БД и показываем на публичке
  const [customCategoryText, setCustomCategoryText] = useState('');
  const [customSpecText, setCustomSpecText] = useState('');
  const [teamType, setTeamType] = useState<'solo' | 'team' | null>(null);
  const [teamMode, setTeamMode] = useState<TeamMode | null>(null);
  // Комиссия/аренда теперь опциональны — null значит «не указано», админ
  // настроит позже. Дефолты ниже применяются только если админ явно тапнул
  // соответствующий тумблер.
  const [defaultCommission, setDefaultCommission] = useState<number | null>(null);
  const [ownerRent, setOwnerRent] = useState<number | null>(null);
  const [locationType, setLocationType] = useState<string | null>(null);
  const [address, setAddress] = useState('');
  const [addressResults, setAddressResults] = useState<GeoResult[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<GeoResult | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  // Specializations derived from selected categories. Multi-select with one
  // primary (the first picked) — saved as comma-joined string in masters.specialization
  // and the full list in masters.specializations[] (when the column exists).
  const builtInSpecOptions = selectedCategories.length > 0
    ? getSpecializationsForCategories(selectedCategories)
    : getSpecializations(vertical);
  // Самообучение: подгружаем варианты, которые ввели руками другие мастера той
  // же ниши (vertical). Если те же варианты есть среди built-in — не дублируем.
  const [popularSpecs, setPopularSpecs] = useState<string[]>([]);
  useEffect(() => {
    if (!vertical) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/verticals/popular-specs?vertical=${encodeURIComponent(vertical)}`);
        const json = (await res.json()) as { items?: { text: string; count: number }[] };
        if (cancelled) return;
        const list = (json.items ?? []).map((i) => i.text);
        setPopularSpecs(list);
      } catch { /* noop */ }
    })();
    return () => { cancelled = true; };
  }, [vertical]);
  const specializationOptions = (() => {
    const seen = new Set<string>(builtInSpecOptions.map((s) => s.toLowerCase()));
    const merged = [...builtInSpecOptions];
    for (const s of popularSpecs) {
      const k = s.toLowerCase();
      if (!seen.has(k)) { merged.push(s); seen.add(k); }
    }
    return merged;
  })();
  const [specializations, setSpecializations] = useState<string[]>([]);
  const specialization = specializations[0] ?? null;
  function toggleSpec(s: string) {
    setSpecializations((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );
  }

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
      // Trim specialization picks that no longer match the new category set.
      const newSpecs = selectedCategories.length > 0
        ? getSpecializationsForCategories(selectedCategories)
        : getSpecializations(vertical);
      const allowed = new Set(newSpecs);
      setSpecializations((prev) => prev.filter((s) => allowed.has(s)));
    }
  }, [selectedCategories, vertical]);

  // Build the ordered list of visible steps (skipping where needed).
  // Шаг 1 (имя + аватар + баннер) показываем всем, включая solo-мастера —
  // у мастера тоже должно быть лицо (фото) и имя для публичной страницы.
  // Админ салона НЕ предоставляет услуги — шаг 5 (где принимаешь клиентов) для
  // него скрыт. Адрес салона он указывает через шаг 6 если включил «физическое
  // помещение» (locationType пропускается, locationPhysical считается дефолтом
  // для admin-флоу).
  const isAdminFlow = userRole === 'salon_admin';
  // Vertical+role-aware копирайт: «салон» / «СТО» / «клиника» / «студия» вместо
  // абстрактного «бизнес», тренировки / приёмы / сеансы вместо «услуги», и т.д.
  const copy = getVerticalCopy(vertical, isAdminFlow ? 'admin' : 'solo');
  const buildStepSequence = useCallback(() => {
    const steps: number[] = [1]; // name + photos (всем)
    steps.push(2, 3); // categories, specialization
    if (!skipTeamStep) steps.push(4); // solo/team
    const effectiveTeamType = skipTeamStep ? inferredTeamType : teamType;
    if (effectiveTeamType === 'team') steps.push(45); // team mode + commission
    if (!isAdminFlow) steps.push(5); // location type — только для мастера
    if (isAdminFlow || locationType === 'locationPhysical') steps.push(6); // address
    steps.push(7); // services
    return steps;
  }, [skipTeamStep, inferredTeamType, teamType, locationType, isAdminFlow]);

  const stepSequence = buildStepSequence();
  const totalVisibleSteps = stepSequence.length;
  const currentVisibleIndex = stepSequence.indexOf(step);
  const visibleStep = currentVisibleIndex >= 0 ? currentVisibleIndex + 1 : totalVisibleSteps;
  const isCompletion = step === 8;

  const canContinue = () => {
    switch (step) {
      case 1: return businessName.trim().length > 0;
      case 2: {
        if (selectedCategories.length === 0) return false;
        // Если выбрано «Другое» — требуем заполнить своё описание
        if (selectedCategories.includes('categoryOther') && customCategoryText.trim().length < 2) return false;
        return true;
      }
      case 3: return specialization !== null || customSpecText.trim().length >= 2;
      case 4: return teamType !== null;
      case 45: return teamMode !== null; // комиссия/аренда теперь опциональны
      case 5: return locationType !== null;
      case 6: return isAdminFlow ? true : selectedAddress !== null;
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

  // Когда пользователь выбрал файл — открываем кроппер (вместо мгновенной
  // подстановки сырой картинки). Вырезание + зум + позиционирование делаются
  // в общем диалоге ImageCropDialog → onCropApplied получает уже готовый Blob.
  const handleFileSelect = (kind: 'avatar' | 'cover', file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    if (file.size > 8 * 1024 * 1024) {
      setSubmitError('file_too_large');
      return;
    }
    const url = URL.createObjectURL(file);
    setCropKind(kind);
    setCropSrc(url);
  };

  const onCropApplied = (blob: Blob) => {
    if (!cropKind) return;
    const ext = blob.type.includes('webp') ? 'webp' : blob.type.includes('png') ? 'png' : 'jpg';
    const file = new File([blob], `${cropKind}-${Date.now()}.${ext}`, { type: blob.type });
    const url = URL.createObjectURL(blob);
    if (cropKind === 'avatar') {
      setAvatarFile(file);
      setAvatarPreview(url);
    } else {
      setCoverFile(file);
      setCoverPreview(url);
    }
  };

  const closeCropper = () => {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropKind(null);
    setCropSrc(null);
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
          defaultMasterCommission: effectiveTeamMode === 'unified' && defaultCommission !== null ? defaultCommission : undefined,
          ownerRentPerMaster: effectiveTeamMode === 'marketplace' && ownerRent !== null ? ownerRent : undefined,
          categories: selectedCategories,
          customCategoryText: selectedCategories.includes('categoryOther') ? customCategoryText.trim() || null : null,
          customSpecText: customSpecText.trim() || null,
          address: selectedAddress?.display_name ?? null,
          latitude: selectedAddress ? parseFloat(selectedAddress.lat) : null,
          longitude: selectedAddress ? parseFloat(selectedAddress.lon) : null,
          city: null,
          services,
          avatarUrl,
          coverUrl,
          specialization: customSpecText.trim() || specialization,
          specializations: [
            ...(customSpecText.trim() ? [customSpecText.trim()] : []),
            ...specializations,
          ],
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

  const handleMapMove = async (lat: number, lng: number) => {
    setMapCenter([lat, lng]);
    // Сразу подменим координаты, чтобы запись не зависла на старых
    if (selectedAddress) {
      setSelectedAddress({ ...selectedAddress, lat: String(lat), lon: String(lng) });
    }
    // Reverse geocoding — Nominatim вернёт точную улицу/дом по pin'у,
    // чтобы строка адреса соответствовала тому, куда мастер фактически указал.
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        { headers: { 'Accept-Language': 'ru' } }
      );
      const data = (await res.json()) as { display_name?: string; lat?: string; lon?: string };
      if (data.display_name) {
        setSelectedAddress({ display_name: data.display_name, lat: String(lat), lon: String(lng) });
        setAddress(data.display_name);
      }
    } catch { /* сетевая ошибка — оставляем уже подменённые координаты */ }
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
                  {userRole === 'master' ? 'Как тебя зовут?' : `Как называется ${copy.businessNomPossessive}?`}
                </h1>
                <p className="mt-2 text-muted-foreground">{userRole === 'master' ? 'Имя, которое будут видеть клиенты на твоей странице.' : t('businessNameDesc')}</p>

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
                    <label className="text-sm font-medium">{userRole === 'master' ? 'Имя' : t('businessName')}</label>
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
                  {categoriesForVertical(vertical).map(({ key, icon: Icon }) => {
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

                {/* Поле «своё» когда выбрано «Другое» — текст пишется на публичную страницу.
                    Placeholder подсказывает примеры из выбранной ниши, не общая каша. */}
                {selectedCategories.includes('categoryOther') && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-6 space-y-2"
                  >
                    <label className="block text-sm font-medium">
                      Опишите свою нишу одной строкой
                    </label>
                    <input
                      type="text"
                      value={customCategoryText}
                      onChange={(e) => setCustomCategoryText(e.target.value)}
                      placeholder={copy.customCategoryPlaceholder}
                      maxLength={80}
                      className="w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground outline-none focus:border-primary"
                    />
                    <p className="text-xs text-muted-foreground">
                      Будет показано на вашей публичной странице, чтобы клиенты понимали что вы делаете.
                    </p>
                  </motion.div>
                )}
              </StepWrapper>
            )}

            {/* Step 3: Specialization. Если есть варианты — pill-список + опц. инпут.
                Если вариантов нет — только инпут (без бесполезной таблетки «свой»). */}
            {step === 3 && (
              <StepWrapper key="step3">
                <p className="text-sm text-muted-foreground">{t('setupAccount')}</p>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">
                  {specializationOptions.length > 0 ? 'Специализация' : 'Чем занимаетесь?'}
                </h1>

                {specializationOptions.length > 0 ? (
                  <>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Можно несколько. Первая — основная для поиска.
                    </p>
                    <div className="mt-6 flex flex-wrap gap-2">
                      {specializationOptions.map((s) => {
                        const idx = specializations.indexOf(s);
                        const isPrimary = idx === 0;
                        const isSelected = idx !== -1;
                        return (
                          <button
                            key={s}
                            type="button"
                            onClick={() => toggleSpec(s)}
                            className={`rounded-full border px-4 py-2.5 text-sm font-medium transition-colors ${
                              isSelected
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground'
                            }`}
                          >
                            {isPrimary && <span className="mr-1.5 text-[10px] uppercase opacity-70">Осн.</span>}
                            {s}
                          </button>
                        );
                      })}
                    </div>
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-6"
                    >
                      <input
                        type="text"
                        value={customSpecText}
                        onChange={(e) => setCustomSpecText(e.target.value)}
                        placeholder={`Своя — например, ${copy.customSpecPlaceholder.replace('Например: ', '')}`}
                        maxLength={80}
                        className="w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground outline-none focus:border-primary"
                      />
                    </motion.div>
                  </>
                ) : (
                  <>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Чтобы клиенты понимали что вы делаете.
                    </p>
                    <input
                      type="text"
                      value={customSpecText}
                      onChange={(e) => setCustomSpecText(e.target.value)}
                      placeholder={copy.customSpecPlaceholder.replace('Например: ', '')}
                      maxLength={80}
                      autoFocus
                      className="mt-6 w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground outline-none focus:border-primary"
                    />
                  </>
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
                    className="mt-6 rounded-2xl border border-border bg-card p-4 space-y-3"
                  >
                    <div className="flex items-start gap-3">
                      <input
                        id="commission-toggle"
                        type="checkbox"
                        checked={defaultCommission !== null}
                        onChange={(e) => setDefaultCommission(e.target.checked ? 50 : null)}
                        className="mt-1 size-4 accent-primary"
                      />
                      <label htmlFor="commission-toggle" className="cursor-pointer">
                        <div className="text-sm font-medium">Указать стандартную комиссию мастеров</div>
                        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                          Нужно только для финансовой аналитики и автоматического расчёта зарплаты.
                          Можно оставить выключенным сейчас и настроить позже в Настройки → Команда —
                          до этого момента в финансовом разделе доход просто не будет делиться по мастерам.
                        </p>
                      </label>
                    </div>
                    {defaultCommission !== null && (
                      <div className="space-y-2 pl-7">
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Комиссия мастера</span>
                          <span className="text-sm font-semibold text-primary">{defaultCommission}%</span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={5}
                          value={defaultCommission}
                          onChange={(e) => setDefaultCommission(parseInt(e.target.value, 10))}
                          className="w-full accent-primary"
                        />
                        <p className="text-[11px] text-muted-foreground">
                          Можно потом настроить индивидуально для каждого мастера.
                        </p>
                      </div>
                    )}
                  </motion.div>
                )}

                {teamMode === 'marketplace' && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-6 rounded-2xl border border-border bg-card p-4 space-y-3"
                  >
                    <div className="flex items-start gap-3">
                      <input
                        id="rent-toggle"
                        type="checkbox"
                        checked={ownerRent !== null}
                        onChange={(e) => setOwnerRent(e.target.checked ? 0 : null)}
                        className="mt-1 size-4 accent-primary"
                      />
                      <label htmlFor="rent-toggle" className="cursor-pointer">
                        <div className="text-sm font-medium">Указать арендную плату с мастера</div>
                        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                          Нужно только для финансовой аналитики (доходы коворкинга). Если оставить выключенным —
                          в финансовом разделе арендный поток просто не считается, можно включить и заполнить
                          позже в Настройки → Команда.
                        </p>
                      </label>
                    </div>
                    {ownerRent !== null && (
                      <div className="space-y-2 pl-7">
                        <label className="block text-sm">Аренда с мастера в месяц (₴)</label>
                        <input
                          type="number"
                          min={0}
                          step={100}
                          value={ownerRent}
                          onChange={(e) => setOwnerRent(Math.max(0, parseInt(e.target.value || '0', 10)))}
                          className="w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground outline-none focus:border-primary"
                        />
                        <p className="text-[11px] text-muted-foreground">
                          Можно настроить индивидуально для каждого мастера.
                        </p>
                      </div>
                    )}
                  </motion.div>
                )}
              </StepWrapper>
            )}

            {/* Step 5: Location type */}
            {step === 5 && (
              <StepWrapper key="step5">
                <p className="text-sm text-muted-foreground">{t('setupAccount')}</p>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">
                  {copy.locationStepTitle}
                </h1>

                <div className="mt-8 flex flex-col gap-3">
                  {([
                    { key: 'locationPhysical', icon: Building2, label: copy.locationOptions.physical },
                    { key: 'locationMobile',   icon: Car,       label: copy.locationOptions.mobile },
                    { key: 'locationOnline',   icon: Monitor,   label: copy.locationOptions.online },
                  ] as const).map(({ key, icon: Icon, label }) => (
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
                      <Icon className="size-5 shrink-0 text-muted-foreground" />
                      <span className="font-medium">{label}</span>
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

      {/* Универсальный кроппер для аватара и баннера. Реальные границы:
          круг для аватара, прямоугольник 3:1 для баннера. Поддерживает зум
          (slider + колёсико), drag-to-pan, отдаёт Blob нужного размера. */}
      <ImageCropDialog
        open={!!cropSrc}
        src={cropSrc}
        onClose={closeCropper}
        onCropped={onCropApplied}
        title={cropKind === 'avatar' ? 'Аватар компании' : 'Обложка'}
        aspect={cropKind === 'avatar' ? 1 : 3}
        shape={cropKind === 'avatar' ? 'round' : 'rect'}
        outputSize={cropKind === 'avatar' ? 512 : 1600}
      />
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
