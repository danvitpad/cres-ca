/** --- YAML
 * name: Booking Page
 * description: Multi-step client booking flow — select service, date, time, confirm
 * --- */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { useSubscription } from '@/hooks/use-subscription';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { WaitlistButton } from '@/components/booking/waitlist-button';
import { LiqPayButton } from '@/components/booking/liqpay-button';
import { ConsentForm, getConsentFormText } from '@/components/shared/consent-form';
import { format } from 'date-fns';
import { ru, uk, enUS } from 'date-fns/locale';
import { formatMoney } from '@/lib/format/money';
import { ArrowLeft, Clock, Check, Plus, User, Users, Info } from 'lucide-react';

type Step = 'service' | 'date' | 'time' | 'consent' | 'confirm';

interface FamilyMember {
  id: string;
  member_name: string;
  relationship: string;
}

interface ServiceItem {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
  currency: string;
  color: string;
  requires_prepayment: boolean;
  prepayment_amount: number;
  upsell_services: string[];
  category: { name: string } | null;
}

interface MasterInfo {
  id: string;
  working_hours: Record<string, { start: string; end: string; break_start?: string; break_end?: string } | null> | null;
  display_name: string | null;
  booking_important_info: string | null;
  profile: { full_name: string } | null;
}

const DEFAULT_WORKING_HOURS: NonNullable<MasterInfo['working_hours']> = {
  sunday: null,
  monday: { start: '10:00', end: '19:00' },
  tuesday: { start: '10:00', end: '19:00' },
  wednesday: { start: '10:00', end: '19:00' },
  thursday: { start: '10:00', end: '19:00' },
  friday: { start: '10:00', end: '19:00' },
  saturday: { start: '11:00', end: '18:00' },
};

export default function BookPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const t = useTranslations('booking');
  const tc = useTranslations('common');
  const locale = useLocale();
  const dateFnsLocale = useMemo(() => {
    if (locale === 'uk') return uk;
    if (locale === 'en') return enUS;
    return ru;
  }, [locale]);
  const { userId } = useAuthStore();
  const { canUse } = useSubscription();

  const preselectedMasterId = searchParams.get('master_id') ?? searchParams.get('master');
  const preselectedServiceId = searchParams.get('service_id') ?? searchParams.get('service');
  const preselectedFamilyLinkId = searchParams.get('for');
  const rescheduleId = searchParams.get('reschedule');
  const salonId = searchParams.get('salon');

  const [step, setStep] = useState<Step>('service');
  const [master, setMaster] = useState<MasterInfo | null>(null);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [selectedService, setSelectedService] = useState<ServiceItem | null>(null);
  const [selectedUpsells, setSelectedUpsells] = useState<ServiceItem[]>([]);
  const [upsellOptions, setUpsellOptions] = useState<ServiceItem[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [slots, setSlots] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [paymentData, setPaymentData] = useState<{ data: string; signature: string } | null>(null);
  const [masterTier, setMasterTier] = useState<string | null>(null);
  const [clientAllergies, setClientAllergies] = useState<string[]>([]);
  const [clientName, setClientName] = useState('');
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [bookingFor, setBookingFor] = useState<FamilyMember | null>(null);
  // Per-master loyalty balance (loyalty_balances). Replaces the cross-master
  // profiles.bonus_points pool which was retired in migration 00102.
  const [bonusPoints, setBonusPoints] = useState(0);
  const [useBonuses, setUseBonuses] = useState(false);

  // Promo code (validated against /api/promo-codes/validate before submit).
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<{
    promo_id: string;
    code: string;
    discount_amount: number;
    final_price: number;
  } | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoBusy, setPromoBusy] = useState(false);

  // Salon → pick first active master and redirect (keeps /book?salon=<id> CTA working).
  useEffect(() => {
    if (!salonId || preselectedMasterId) return;
    (async () => {
      const supabase = createClient();
      // Try solo masters first (salon_id=salon), then salon_members (status=active).
      const { data: solo } = await supabase
        .from('masters')
        .select('id')
        .eq('salon_id', salonId)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();
      let mId = solo?.id ?? null;
      if (!mId) {
        const { data: mem } = await supabase
          .from('salon_members')
          .select('master_id')
          .eq('salon_id', salonId)
          .eq('status', 'active')
          .limit(1)
          .maybeSingle();
        mId = mem?.master_id ?? null;
      }
      if (mId) {
        router.replace(`/book?master_id=${mId}`);
      } else {
        toast.error('В этом салоне нет активных мастеров');
      }
    })();
  }, [salonId, preselectedMasterId, router]);

  // Load master + services
  useEffect(() => {
    if (!preselectedMasterId) return;
    async function load() {
      const supabase = createClient();
      const { data: masterData } = await supabase
        .from('masters')
        .select('id, working_hours, display_name, booking_important_info, profile:profiles!masters_profile_id_fkey(full_name)')
        .eq('id', preselectedMasterId!)
        .single();

      if (masterData) {
        setMaster(masterData as unknown as MasterInfo);
        // Get master's subscription tier for consent gating
        const { data: masterRow } = await supabase
          .from('masters')
          .select('profile_id')
          .eq('id', preselectedMasterId!)
          .single();
        if (masterRow?.profile_id) {
          const { data: sub } = await supabase
            .from('subscriptions')
            .select('tier')
            .eq('profile_id', masterRow.profile_id)
            .single();
          if (sub) setMasterTier(sub.tier);
        }
      }

      const { data: serviceData } = await supabase
        .from('services')
        .select('id, name, duration_minutes, price, currency, color, requires_prepayment, prepayment_amount, upsell_services, category:service_categories(name)')
        .eq('master_id', preselectedMasterId!)
        .eq('is_active', true)
        .order('name');

      if (serviceData) {
        const typed = serviceData as unknown as ServiceItem[];
        setServices(typed);
        if (preselectedServiceId) {
          const pre = typed.find((s) => s.id === preselectedServiceId);
          if (pre) {
            setSelectedService(pre);
            setStep('date');
          }
        }
      }
      setLoading(false);
    }
    load();
  }, [preselectedMasterId, preselectedServiceId]);

  // Load client info for consent form
  useEffect(() => {
    if (!userId || !preselectedMasterId) return;
    async function loadClientInfo() {
      const supabase = createClient();
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', userId!)
        .single();
      if (profile?.full_name) setClientName(profile.full_name);

      // Unified loyalty: per-master balance instead of cross-master profiles.bonus_points
      const { data: balanceRow } = await supabase
        .from('loyalty_balances')
        .select('balance')
        .eq('master_id', preselectedMasterId!)
        .eq('profile_id', userId!)
        .maybeSingle();
      setBonusPoints(Number(balanceRow?.balance ?? 0));

      const { data: client } = await supabase
        .from('clients')
        .select('allergies')
        .eq('profile_id', userId!)
        .eq('master_id', preselectedMasterId!)
        .is('family_link_id', null)
        .maybeSingle();
      if (client?.allergies) setClientAllergies(client.allergies);
    }
    loadClientInfo();
  }, [userId, preselectedMasterId]);

  // Load family members for "book for whom" selector
  useEffect(() => {
    if (!userId) return;
    async function loadFamily() {
      const supabase = createClient();
      const { data } = await supabase
        .from('family_links')
        .select('id, member_name, relationship')
        .eq('parent_profile_id', userId!)
        .order('created_at');
      const list = (data ?? []) as FamilyMember[];
      setFamilyMembers(list);
      if (preselectedFamilyLinkId) {
        const preselected = list.find((m) => m.id === preselectedFamilyLinkId);
        if (preselected) setBookingFor(preselected);
      }
    }
    loadFamily();
  }, [userId, preselectedFamilyLinkId]);

  // Load upsell options when service selected
  // Manual-configured upsells first; fallback to auto-suggest (top-3 cheapest other services)
  useEffect(() => {
    if (!selectedService) {
      setUpsellOptions([]);
      return;
    }
    if (selectedService.upsell_services?.length) {
      const ups = services.filter((s) => selectedService.upsell_services.includes(s.id));
      setUpsellOptions(ups);
      return;
    }
    const auto = services
      .filter((s) => s.id !== selectedService.id)
      .sort((a, b) => Number(a.price) - Number(b.price))
      .slice(0, 3);
    setUpsellOptions(auto);
  }, [selectedService, services]);

  // Load slots when date selected
  const loadSlots = useCallback(async () => {
    if (!selectedDate || !selectedService || !preselectedMasterId) return;
    setSlotsLoading(true);
    const dateStr = selectedDate.toISOString().split('T')[0];
    const res = await fetch(
      `/api/slots?master_id=${preselectedMasterId}&date=${dateStr}&service_id=${selectedService.id}`,
    );
    const data = await res.json();
    setSlots(data.slots ?? []);
    setSlotsLoading(false);
  }, [selectedDate, selectedService, preselectedMasterId]);

  useEffect(() => {
    if (selectedDate && selectedService) {
      setSelectedTime(null);
      loadSlots();
    }
  }, [selectedDate, selectedService, loadSlots]);

  // Determine which weekdays are off
  const disabledDays = useCallback(
    (date: Date) => {
      if (date < new Date(new Date().setHours(0, 0, 0, 0))) return true;
      const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const dayName = weekdays[date.getDay()];
      const wh = master?.working_hours ?? DEFAULT_WORKING_HOURS;
      return !wh[dayName];
    },
    [master],
  );

  function handleSelectService(service: ServiceItem) {
    setSelectedService(service);
    setSelectedUpsells([]);
    setSelectedDate(undefined);
    setSelectedTime(null);
    setStep('date');
  }

  function toggleUpsell(upsell: ServiceItem) {
    setSelectedUpsells((prev) =>
      prev.some((u) => u.id === upsell.id)
        ? prev.filter((u) => u.id !== upsell.id)
        : [...prev, upsell],
    );
  }

  function handleSelectDate(date: Date | undefined) {
    setSelectedDate(date);
    if (date) setStep('time');
  }

  const consentRequired = masterTier === 'pro' || masterTier === 'business' || masterTier === 'trial';

  function handleSelectTime(time: string) {
    setSelectedTime(time);
    if (consentRequired) {
      setStep('consent');
    } else {
      setStep('confirm');
    }
  }

  function goBack() {
    if (step === 'confirm') setStep(consentRequired ? 'consent' : 'time');
    else if (step === 'consent') setStep('time');
    else if (step === 'time') setStep('date');
    else if (step === 'date') setStep('service');
  }

  async function handleConsentAgree() {
    if (!selectedService || !preselectedMasterId || !userId) return;
    // Save consent form to DB
    const supabase = createClient();
    const today = format(new Date(), 'dd.MM.yyyy');
    const formText = getConsentFormText({
      serviceName: selectedService.name,
      masterName: master?.display_name ?? master?.profile?.full_name ?? '',
      clientName: bookingFor?.member_name ?? clientName,
      allergies: bookingFor ? [] : clientAllergies,
      date: today,
    });

    // Get client ID if exists (family-aware)
    let consentLookup = supabase
      .from('clients')
      .select('id')
      .eq('profile_id', userId)
      .eq('master_id', preselectedMasterId);
    consentLookup = bookingFor
      ? consentLookup.eq('family_link_id', bookingFor.id)
      : consentLookup.is('family_link_id', null);
    const { data: existingClient } = await consentLookup.maybeSingle();

    if (existingClient) {
      await supabase.from('consent_forms').insert({
        client_id: existingClient.id,
        master_id: preselectedMasterId,
        form_text: formText,
        client_agreed: true,
        agreed_at: new Date().toISOString(),
      });
    }

    setStep('confirm');
  }

  async function handleConfirm() {
    if (!selectedService || !selectedDate || !selectedTime || !preselectedMasterId) return;
    if (!userId) {
      // Guest → send to register with current booking URL as return destination
      const returnUrl = encodeURIComponent(window.location.href);
      router.push(`/${locale}/register?redirect=${returnUrl}`);
      return;
    }
    setSubmitting(true);

    const supabase = createClient();
    const dateStr = selectedDate.toISOString().split('T')[0];
    const startsAt = `${dateStr}T${selectedTime}:00`;
    const totalDuration = selectedService.duration_minutes + selectedUpsells.reduce((s, u) => s + u.duration_minutes, 0);
    const [h, m] = selectedTime.split(':').map(Number);
    const endMinutes = h * 60 + m + totalDuration;
    const endH = Math.floor(endMinutes / 60).toString().padStart(2, '0');
    const endM = (endMinutes % 60).toString().padStart(2, '0');
    const endsAt = `${dateStr}T${endH}:${endM}:00`;
    const basePrice = Number(selectedService.price) + selectedUpsells.reduce((s, u) => s + Number(u.price), 0);
    const bonusCandidate = useBonuses ? Math.min(bonusPoints, Math.floor(basePrice)) : 0;
    const promoDiscount = appliedPromo?.discount_amount ?? 0;
    // Шаг 10.3: applies whichever discount is larger — promo OR bonuses, not both.
    // When both are active, promo wins if it's bigger; otherwise bonuses win.
    const useBonusInstead = bonusCandidate > promoDiscount;
    const bonusToSpend = useBonusInstead ? bonusCandidate : 0;
    const effectivePromoDiscount = useBonusInstead ? 0 : promoDiscount;
    const totalPrice = Math.max(0, basePrice - bonusToSpend - effectivePromoDiscount);

    // Find or create client record for self or selected family member
    let clientId: string | null = null;
    let existingClientQuery = supabase
      .from('clients')
      .select('id')
      .eq('profile_id', userId)
      .eq('master_id', preselectedMasterId);
    existingClientQuery = bookingFor
      ? existingClientQuery.eq('family_link_id', bookingFor.id)
      : existingClientQuery.is('family_link_id', null);
    const { data: existingClient } = await existingClientQuery.maybeSingle();

    let isNewClient = false;
    if (existingClient) {
      clientId = existingClient.id;
    } else {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, phone')
        .eq('id', userId)
        .single();
      const { data: newClient } = await supabase
        .from('clients')
        .insert({
          profile_id: userId,
          master_id: preselectedMasterId,
          family_link_id: bookingFor?.id ?? null,
          full_name: bookingFor?.member_name ?? profile?.full_name ?? '',
          phone: bookingFor ? null : (profile?.phone ?? null),
        })
        .select('id')
        .single();
      clientId = newClient?.id ?? null;
      isNewClient = !!clientId && !bookingFor;
    }

    if (isNewClient && typeof window !== 'undefined') {
      const refKey = `cres-ref:${preselectedMasterId}`;
      const referrerProfileId = window.localStorage.getItem(refKey);
      if (referrerProfileId && referrerProfileId !== userId) {
        const { data: referrerClient } = await supabase
          .from('clients')
          .select('id')
          .eq('profile_id', referrerProfileId)
          .eq('master_id', preselectedMasterId)
          .maybeSingle();
        if (referrerClient && clientId) {
          await supabase.from('referrals').insert({
            referrer_client_id: referrerClient.id,
            referred_client_id: clientId,
            bonus_points: 50,
          });
        }
        window.localStorage.removeItem(refKey);
      }
    }

    if (!clientId) {
      toast.error(tc('error'));
      setSubmitting(false);
      return;
    }

    const referrerProfileId = typeof window !== 'undefined' ? window.sessionStorage.getItem('cres_ref') : null;
    const { data: insertedApt, error } = await supabase.from('appointments').insert({
      client_id: clientId,
      master_id: preselectedMasterId,
      service_id: selectedService.id,
      booked_via: 'client_web',
      starts_at: startsAt,
      ends_at: endsAt,
      status: 'booked',
      price: totalPrice,
      price_base: basePrice,
      currency: selectedService.currency,
      referrer_profile_id: referrerProfileId,
      promo_code_id: effectivePromoDiscount > 0 ? appliedPromo?.promo_id ?? null : null,
      promo_discount_amount: effectivePromoDiscount,
      bonus_redeemed: bonusToSpend,
    }).select('id').single();
    const newAppointmentId: string | null = (insertedApt as { id?: string } | null)?.id ?? null;

    // Persist referrer link for award_referral_reward to use after first paid visit completes.
    if (referrerProfileId && userId && referrerProfileId !== userId) {
      await supabase.from('referrals').upsert(
        {
          referrer_profile_id: referrerProfileId,
          referred_profile_id: userId,
          bonus_points: 0,
        },
        { onConflict: 'referred_profile_id', ignoreDuplicates: false },
      );
    }

    if (error) {
      toast.error(tc('error'));
      setSubmitting(false);
      return;
    }

    // If this was a reschedule, cancel the original appointment
    if (rescheduleId) {
      await supabase
        .from('appointments')
        .update({
          status: 'cancelled_by_client',
          cancelled_at: new Date().toISOString(),
          cancelled_by: userId,
          cancellation_reason: 'rescheduled',
        })
        .eq('id', rescheduleId);
    }

    // Notify master + confirm to client via unified notify endpoint (in-app + TG)
    if (newAppointmentId) {
      fetch(`/api/appointments/${newAppointmentId}/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ triggeredBy: 'client' }),
      }).catch(() => undefined);
    }

    // If prepayment required, get LiqPay form data
    if (selectedService.requires_prepayment && Number(selectedService.prepayment_amount) > 0) {
      const { data: apt } = await supabase
        .from('appointments')
        .select('id')
        .eq('client_id', clientId)
        .eq('master_id', preselectedMasterId)
        .eq('service_id', selectedService.id)
        .eq('starts_at', startsAt)
        .single();

      if (apt) {
        const res = await fetch('/api/payments/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'prepayment',
            appointmentId: apt.id,
            amount: Number(selectedService.prepayment_amount),
            currency: selectedService.currency,
            description: `${selectedService.name} - prepayment`,
          }),
        });
        if (res.ok) {
          const formData = await res.json();
          setPaymentData(formData);
          setSubmitting(false);
          return;
        }
      }
    }

    if (bonusToSpend > 0 && preselectedMasterId && userId) {
      // Unified loyalty: server-side RPC writes the audit row + decrements
      // loyalty_balances atomically. Links the spend to the new appointment
      // for downstream analytics («куда ушли мои баллы»).
      await supabase.rpc('redeem_loyalty_bonus', {
        p_master_id: preselectedMasterId,
        p_profile_id: userId,
        p_amount: bonusToSpend,
        p_appointment_id: newAppointmentId,
      });
    }

    // Bump promo uses_count after a successful insert so the next validate call
    // sees the right counter. RLS allows update on the row when master_id ===
    // promo's master_id; for clients we go through service role via the redeem
    // endpoint to avoid leaking the table — but the existing schema lets the
    // owning master read/write their own row, so this update is also safe via
    // direct call from the booking client. If RLS rejects, the booking still
    // succeeds — we just lose accurate counter (acceptable degradation).
    if (appliedPromo && newAppointmentId && effectivePromoDiscount > 0) {
      try {
        await supabase.rpc('bump_promo_uses', { p_promo_id: appliedPromo.promo_id });
      } catch { /* RLS reject is acceptable — counter is best-effort */ }
    }

    toast.success(t('bookingSuccess'));

    // 7.12 — On first booking for self, prompt the client to fill the intake form
    if (!bookingFor) {
      const { data: intakeRow } = await supabase
        .from('client_health_profiles')
        .select('profile_id')
        .eq('profile_id', userId)
        .maybeSingle();
      if (!intakeRow) {
        router.push('/forms?prompt=intake');
        return;
      }
    }

    router.push('/appointments');
  }

  if (!preselectedMasterId) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <p>{t('selectService')}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  const basePrice = (selectedService ? Number(selectedService.price) : 0)
    + selectedUpsells.reduce((s, u) => s + Number(u.price), 0);
  const bonusCandidatePreview = useBonuses ? Math.min(bonusPoints, Math.floor(basePrice)) : 0;
  const promoCandidatePreview = appliedPromo?.discount_amount ?? 0;
  // Шаг 10.3: only the larger of (bonus, promo) is applied — never both.
  const bonusWinsPreview = bonusCandidatePreview > promoCandidatePreview;
  const bonusPreview = bonusWinsPreview ? bonusCandidatePreview : 0;
  const promoPreview = bonusWinsPreview ? 0 : promoCandidatePreview;
  const showStackingHint = bonusCandidatePreview > 0 && promoCandidatePreview > 0;
  const totalPrice = Math.max(0, basePrice - bonusPreview - promoPreview);

  async function applyPromo() {
    setPromoError(null);
    setAppliedPromo(null);
    const code = promoCode.trim();
    if (!code || !preselectedMasterId || !selectedService) return;
    setPromoBusy(true);
    try {
      const res = await fetch('/api/promo-codes/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          masterId: preselectedMasterId,
          serviceId: selectedService.id,
          basePrice,
        }),
      });
      const json = await res.json().catch(() => ({} as { error?: string }));
      if (!res.ok) {
        const errMap: Record<string, string> = {
          not_found: 'Такого промокода нет',
          inactive: 'Промокод выключен',
          expired: 'Срок действия истёк',
          not_started: 'Промокод ещё не активен',
          max_uses_reached: 'Лимит использований исчерпан',
          service_not_applicable: 'Этот промокод не действует на выбранную услугу',
          wrong_master: 'Промокод от другого мастера',
        };
        setPromoError(errMap[json.error ?? ''] ?? 'Не удалось применить');
        return;
      }
      setAppliedPromo(json as typeof appliedPromo extends infer T ? NonNullable<T> : never);
    } finally {
      setPromoBusy(false);
    }
  }
  function clearPromo() {
    setAppliedPromo(null);
    setPromoError(null);
    setPromoCode('');
  }
  const totalDuration = (selectedService?.duration_minutes ?? 0)
    + selectedUpsells.reduce((s, u) => s + u.duration_minutes, 0);

  return (
    <div className="p-4 space-y-4 pb-24">
      {/* Header */}
      {step !== 'service' && (
        <button onClick={goBack} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" />
          {tc('back')}
        </button>
      )}

      {master && (
        <p className="text-sm text-muted-foreground">{(master.display_name ?? master.profile?.full_name ?? '')}</p>
      )}

      {/* Step indicator — Fresha-style breadcrumb */}
      {(() => {
        const labels: Record<Step, string> = {
          service: 'Услуги',
          date: 'Дата',
          time: 'Время',
          consent: 'Согласие',
          confirm: 'Подтверждение',
        };
        const allSteps: Step[] = consentRequired
          ? ['service', 'date', 'time', 'consent', 'confirm']
          : ['service', 'date', 'time', 'confirm'];
        const currentIdx = allSteps.indexOf(step);
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-medium">
              {allSteps.map((s, i) => (
                <div key={s} className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      'transition-colors',
                      i < currentIdx && 'text-muted-foreground',
                      i === currentIdx && 'text-foreground font-semibold',
                      i > currentIdx && 'text-muted-foreground/50',
                    )}
                  >
                    {labels[s]}
                  </span>
                  {i < allSteps.length - 1 && (
                    <span className="text-muted-foreground/40">/</span>
                  )}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2">
              {allSteps.map((s, i) => (
                <div
                  key={s}
                  className={cn(
                    'h-1 flex-1 rounded-full transition-colors',
                    i <= currentIdx ? 'bg-primary' : 'bg-muted',
                  )}
                />
              ))}
            </div>
          </div>
        );
      })()}

      {/* Step 1: Service */}
      {step === 'service' && (
        <div className="space-y-3">
          {familyMembers.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">{t('bookingFor')}</h3>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setBookingFor(null)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors',
                    bookingFor === null
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background hover:bg-muted',
                  )}
                >
                  <User className="size-3.5" />
                  {t('myself')}
                </button>
                {familyMembers.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setBookingFor(m)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors',
                      bookingFor?.id === m.id
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background hover:bg-muted',
                    )}
                  >
                    <Users className="size-3.5" />
                    {m.member_name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <h2 className="text-lg font-semibold">{t('selectService')}</h2>
          {services.map((service) => (
            <Card
              key={service.id}
              size="sm"
              className={cn('cursor-pointer transition-colors hover:bg-muted/50', selectedService?.id === service.id && 'ring-2 ring-primary')}
              onClick={() => handleSelectService(service)}
            >
              <CardContent className="flex items-center justify-between gap-3 pt-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: service.color }} />
                    <span className="font-medium">{service.name}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="size-3" />
                      {service.duration_minutes} {t('min')}
                    </span>
                    <span className="font-medium text-foreground">
                      {formatMoney(service.price, service.currency)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Step 2: Date + Upsell */}
      {step === 'date' && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">{t('selectDate')}</h2>

          {/* Upsell options */}
          {upsellOptions.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">{t('addUpsell')}</p>
              {upsellOptions.map((upsell) => {
                const isSelected = selectedUpsells.some((u) => u.id === upsell.id);
                return (
                  <Card
                    key={upsell.id}
                    size="sm"
                    className={cn('cursor-pointer', isSelected && 'ring-2 ring-primary')}
                    onClick={() => toggleUpsell(upsell)}
                  >
                    <CardContent className="flex items-center justify-between pt-3">
                      <div>
                        <span className="text-sm font-medium">{upsell.name}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          +{upsell.duration_minutes} {t('min')} · +{formatMoney(upsell.price, upsell.currency)}
                        </span>
                      </div>
                      {isSelected ? <Check className="size-4 text-primary" /> : <Plus className="size-4 text-muted-foreground" />}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleSelectDate}
            disabled={disabledDays}
            locale={dateFnsLocale}
            weekStartsOn={1}
          />
        </div>
      )}

      {/* Step 3: Time */}
      {step === 'time' && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">{t('selectTime')}</h2>
          <p className="text-sm text-muted-foreground">
            {selectedDate
              ? format(selectedDate, 'EEEE, d MMMM', { locale: dateFnsLocale })
              : ''}
          </p>
          {slotsLoading ? (
            <div className="grid grid-cols-4 gap-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10 rounded-md" />
              ))}
            </div>
          ) : slots.length > 0 ? (
            <div className="grid grid-cols-4 gap-2">
              {slots.map((time) => (
                <Button
                  key={time}
                  variant={selectedTime === time ? 'default' : 'outline'}
                  onClick={() => handleSelectTime(time)}
                  className="text-sm"
                >
                  {time}
                </Button>
              ))}
            </div>
          ) : (
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground text-center">{t('noSlots')}</p>
              {preselectedMasterId && selectedDate && (
                <WaitlistButton
                  masterId={preselectedMasterId}
                  desiredDate={selectedDate.toISOString().split('T')[0]}
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* Step 3.5: Consent (Pro+ tier) */}
      {step === 'consent' && selectedService && master && (
        <div className="space-y-4">
          <ConsentForm
            serviceName={selectedService.name}
            masterName={master.display_name ?? master.profile?.full_name ?? ''}
            clientName={clientName}
            allergies={clientAllergies}
            onAgree={handleConsentAgree}
            onDecline={goBack}
          />
        </div>
      )}

      {/* Step 4: Confirm */}
      {step === 'confirm' && selectedService && selectedDate && selectedTime && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">{t('confirmBooking')}</h2>
          <Card>
            <CardContent className="pt-4 space-y-3">
              {bookingFor && (
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">{t('bookingFor')}</span>
                  <span className="text-sm font-medium">{bookingFor.member_name}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">{t('service')}</span>
                <span className="text-sm font-medium">{selectedService.name}</span>
              </div>
              {selectedUpsells.map((u) => (
                <div key={u.id} className="flex justify-between">
                  <span className="text-sm text-muted-foreground">+ {u.name}</span>
                  <span className="text-sm">+{formatMoney(u.price, u.currency)}</span>
                </div>
              ))}
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">{t('date')}</span>
                <span className="text-sm font-medium">{selectedDate.toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">{t('time')}</span>
                <span className="text-sm font-medium">{selectedTime}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">{t('duration')}</span>
                <span className="text-sm font-medium">{totalDuration} {t('min')}</span>
              </div>
              {bonusPoints > 0 && (
                <label className="flex items-center gap-3 pt-1 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={useBonuses}
                    onChange={(e) => setUseBonuses(e.target.checked)}
                    className="size-4 rounded border-input accent-primary"
                  />
                  <span className="flex-1 text-sm">
                    Использовать {formatMoney(Math.min(bonusPoints, Math.floor(basePrice)), selectedService.currency)} бонусов у этого мастера
                  </span>
                </label>
              )}
              {bonusPreview > 0 && (
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Скидка бонусами</span>
                  <span className="text-sm font-medium text-emerald-600 dark:text-emerald-300">−{formatMoney(bonusPreview, selectedService.currency)}</span>
                </div>
              )}
              {showStackingHint && (
                <div className="rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/30 px-2.5 py-1.5 text-[11px] text-amber-700 dark:text-amber-300">
                  {bonusWinsPreview
                    ? 'Применены бонусы — они выгоднее промокода. Промокод сохранится для другой записи.'
                    : 'Применён промокод — он выгоднее бонусов. Бонусы останутся на счёте.'}
                </div>
              )}

              {/* Promo code field */}
              <div className="space-y-1.5 pt-1 border-t">
                {appliedPromo ? (
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm">
                      <span className="font-medium text-emerald-700 dark:text-emerald-300">{appliedPromo.code}</span>
                      <span className="ml-2 text-muted-foreground">−{formatMoney(appliedPromo.discount_amount, selectedService.currency)}</span>
                    </div>
                    <button
                      type="button"
                      onClick={clearPromo}
                      className="text-xs text-muted-foreground hover:text-foreground underline"
                    >
                      убрать
                    </button>
                  </div>
                ) : (
                  <>
                    <label className="text-xs text-muted-foreground">Промокод</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={promoCode}
                        onChange={(e) => { setPromoCode(e.target.value); setPromoError(null); }}
                        placeholder="Введите код"
                        className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm uppercase outline-none focus:border-primary"
                        maxLength={32}
                      />
                      <button
                        type="button"
                        onClick={applyPromo}
                        disabled={promoBusy || !promoCode.trim()}
                        className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                      >
                        {promoBusy ? '...' : 'Применить'}
                      </button>
                    </div>
                    {promoError && (
                      <p className="text-[11px] text-red-500">{promoError}</p>
                    )}
                  </>
                )}
              </div>

              <div className="border-t pt-2 flex justify-between">
                <span className="font-medium">{t('totalLabel')}</span>
                <span className="font-bold">{formatMoney(totalPrice, selectedService.currency)}</span>
              </div>
              {selectedService.requires_prepayment && (
                <Badge variant="secondary">{t('prepaymentRequired')}: {formatMoney(selectedService.prepayment_amount, selectedService.currency)}</Badge>
              )}
            </CardContent>
          </Card>
          {master?.booking_important_info && master.booking_important_info.trim().length > 0 && (
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
                    <Info className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold">Важная информация</h3>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                      {master.booking_important_info}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          {paymentData ? (
            <LiqPayButton
              data={paymentData.data}
              signature={paymentData.signature}
              label={`${t('prepaymentRequired')} — ${formatMoney(selectedService.prepayment_amount, selectedService.currency)}`}
              className="w-full"
            />
          ) : (
            <Button
              className="w-full"
              size="lg"
              onClick={handleConfirm}
              disabled={submitting}
            >
              {submitting ? tc('loading') : t('confirmBooking')}
            </Button>
          )}
        </div>
      )}

      {/* Sticky bottom summary bar — Fresha-style. Visible only after a service is selected
          and not on the confirm step (which has its own full-width primary CTA). */}
      {selectedService && step !== 'confirm' && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:left-[72px]">
          <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs text-muted-foreground">
                {selectedService.name}
                {totalDuration ? ` · ${totalDuration} ${t('min')}` : ''}
              </div>
              <div className="text-base font-semibold tabular-nums">
                {t('totalLabel')}: {formatMoney(totalPrice, selectedService.currency)}
              </div>
            </div>
            <Button
              size="lg"
              className="shrink-0 rounded-full px-6"
              disabled={
                (step === 'service' && !selectedService) ||
                (step === 'date' && !selectedDate) ||
                (step === 'time' && !selectedTime)
              }
              onClick={() => {
                if (step === 'service') setStep('date');
                else if (step === 'date' && selectedDate) setStep('time');
                else if (step === 'time' && selectedTime) {
                  if (consentRequired) setStep('consent');
                  else setStep('confirm');
                }
                else if (step === 'consent') setStep('confirm');
              }}
            >
              {tc('next')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
