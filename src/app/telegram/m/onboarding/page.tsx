/** --- YAML
 * name: MasterMiniAppOnboarding
 * description: 4-step onboarding for masters in Mini App — Профіль → Спеціальність → Послуги → Готово.
 *   Matches master-onboarding mock design. Saves via /api/telegram/master-setup.
 *   Fullscreen — bottom nav hidden via /telegram/m/layout.tsx isFullscreen.
 * created: 2026-04-29
 * updated: 2026-05-16
 * --- */

'use client';

import { useEffect, useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight, Check, Loader2,
  User, Scissors, ListChecks,
  Dumbbell, Stethoscope, BookOpen, PawPrint, Wrench, Plus,
  Star, Pen, LayoutDashboard,
} from 'lucide-react';
import { T as THEME, R, FONT_BASE, SPRING } from '@/components/miniapp/design';
import { getDefaultServices, type DefaultService } from '@/lib/verticals/default-services';
import { useAuthStore } from '@/stores/auth-store';
import { useTelegram } from '@/components/miniapp/telegram-provider';
import { createClient as createAdminClient } from '@supabase/supabase-js';

// ─── i18n ────────────────────────────────────────────────────────────────────
type Lang = 'uk' | 'ru' | 'en';

const TX = {
  uk: {
    step1Title: 'Розкажи про себе',
    step1Sub: 'Це допоможе налаштувати кабінет під тебе',
    step2Title: 'Яка твоя спеціальність?',
    step2Sub: 'Оберіть — CRES налаштує шаблони',
    step3Title: 'Оберіть послуги',
    step3Sub: 'Можна додати або змінити пізніше',
    step4Title: 'Все готово!',
    step4Sub: 'Твій кабінет налаштовано. Перший клієнт може записатись вже сьогодні.',
    labelName: "Твоє ім'я",
    labelCity: 'Місто',
    labelPhone: 'Телефон',
    labelSummary: 'Ваш кабінет',
    labelServices: 'послуги додано',
    next: 'Далі',
    back: 'Назад',
    open: 'Відкрити кабінет',
    saving: 'Зберігаємо…',
    niches: {
      hairdresser: 'Перукар', beauty: 'Краса', fitness: 'Фітнес',
      health: 'Лікар', education: 'Репетитор', pets: 'Ветеринар',
      craft: 'Ремонт', tattoo: 'Татуювання', other: 'Інше',
    },
  },
  ru: {
    step1Title: 'Расскажи о себе',
    step1Sub: 'Это поможет настроить кабинет под тебя',
    step2Title: 'Какая твоя специальность?',
    step2Sub: 'Выберите — CRES настроит шаблоны',
    step3Title: 'Выберите услуги',
    step3Sub: 'Можно добавить или изменить позже',
    step4Title: 'Всё готово!',
    step4Sub: 'Твой кабинет настроен. Первый клиент может записаться уже сегодня.',
    labelName: 'Твоё имя',
    labelCity: 'Город',
    labelPhone: 'Телефон',
    labelSummary: 'Ваш кабинет',
    labelServices: 'услуги добавлены',
    next: 'Далее',
    back: 'Назад',
    open: 'Открыть кабинет',
    saving: 'Сохраняем…',
    niches: {
      hairdresser: 'Парикмахер', beauty: 'Красота', fitness: 'Фитнес',
      health: 'Врач', education: 'Репетитор', pets: 'Ветеринар',
      craft: 'Ремонт', tattoo: 'Татуировки', other: 'Другое',
    },
  },
  en: {
    step1Title: 'Tell us about you',
    step1Sub: 'This helps us set up your cabinet',
    step2Title: "What's your specialty?",
    step2Sub: 'Choose — CRES will set up templates',
    step3Title: 'Choose services',
    step3Sub: 'You can add or edit them later',
    step4Title: "All set!",
    step4Sub: 'Your cabinet is ready. Your first client can book today.',
    labelName: 'Your name',
    labelCity: 'City',
    labelPhone: 'Phone',
    labelSummary: 'Your cabinet',
    labelServices: 'services added',
    next: 'Next',
    back: 'Back',
    open: 'Open cabinet',
    saving: 'Saving…',
    niches: {
      hairdresser: 'Hairdresser', beauty: 'Beauty', fitness: 'Fitness',
      health: 'Doctor', education: 'Tutor', pets: 'Veterinarian',
      craft: 'Repair', tattoo: 'Tattoo', other: 'Other',
    },
  },
} as const;

// ─── Niche grid (matches mock: 3 columns, 9 buttons) ─────────────────────────
type NicheKey = keyof typeof TX.uk.niches;
type IconCmp = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

const NICHES: Array<{ key: NicheKey; vertical: string; Icon: IconCmp }> = [
  { key: 'hairdresser', vertical: 'beauty',    Icon: Scissors },
  { key: 'beauty',      vertical: 'beauty',    Icon: Star },
  { key: 'fitness',     vertical: 'fitness',   Icon: Dumbbell },
  { key: 'health',      vertical: 'health',    Icon: Stethoscope },
  { key: 'education',   vertical: 'education', Icon: BookOpen },
  { key: 'pets',        vertical: 'pets',      Icon: PawPrint },
  { key: 'craft',       vertical: 'craft',     Icon: Wrench },
  { key: 'tattoo',      vertical: 'tattoo',    Icon: Pen },
  { key: 'other',       vertical: 'other',     Icon: Plus },
];

// ─── Service item ─────────────────────────────────────────────────────────────
interface ServiceItem extends DefaultService { enabled: boolean }

// ─── Progress dots (matching mock: thin segments) ─────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function ProgressBar({ step, total }: { step: number; total: number }) {
  const successColor = '#22c55e';
  return (
    <div style={{ padding: '16px 20px 8px', flexShrink: 0 }}>
      <div style={{ display: 'flex', gap: 6 }}>
        {Array.from({ length: total }, (_, i) => {
          const n = i + 1;
          const bg = n < step ? successColor : n === step ? THEME.accent : '#e5e7eb';
          return (
            <motion.div
              key={n}
              animate={{ backgroundColor: bg }}
              transition={{ duration: 0.3 }}
              style={{ flex: 1, height: 4, borderRadius: 99 }}
            />
          );
        })}
      </div>
      <div style={{ fontSize: 11, color: THEME.textTertiary, marginTop: 6, fontWeight: 500 }}>
        Крок {step} з {total}
      </div>
    </div>
  );
}

// ─── Step icon wrap ───────────────────────────────────────────────────────────
function StepIcon({ Icon, bg, color }: { Icon: IconCmp; bg: string; color: string }) {
  return (
    <div style={{
      width: 56, height: 56, borderRadius: R.xl,
      background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      <Icon size={24} color={color} strokeWidth={2} />
    </div>
  );
}

// ─── Form input ───────────────────────────────────────────────────────────────
function FormInput({
  label, value, onChange, placeholder, type = 'text',
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  const [focused, setFocused] = useState(false);
  const filled = value.length > 0;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: THEME.textSecondary }}>{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          padding: '12px 14px',
          borderRadius: R.md,
          border: `1.5px solid ${focused ? THEME.accent : filled ? THEME.accentHover ?? '#93c5fd' : THEME.border}`,
          background: THEME.surface,
          color: THEME.text,
          fontSize: 14,
          fontFamily: 'inherit',
          outline: 'none',
          transition: 'border-color 0.15s',
        }}
      />
    </div>
  );
}

// ─── Bottom CTA ───────────────────────────────────────────────────────────────
function BottomCta({
  onNext, onBack, nextLabel, disabled, loading,
}: { onNext: () => void; onBack?: () => void; nextLabel: string; disabled?: boolean; loading?: boolean }) {
  return (
    <div style={{
      padding: '12px 20px',
      paddingBottom: 'max(20px, env(safe-area-inset-bottom, 0px))',
      borderTop: `1px solid ${THEME.borderSubtle}`,
      background: THEME.bg,
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}>
      <button
        type="button"
        onClick={onNext}
        disabled={disabled || loading}
        style={{
          width: '100%', padding: '15px 0',
          borderRadius: R.xl,
          background: THEME.accent,
          color: '#fff', fontSize: 15, fontWeight: 700,
          border: 'none', cursor: disabled || loading ? 'not-allowed' : 'pointer',
          opacity: disabled || loading ? 0.5 : 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          fontFamily: 'inherit',
        }}
      >
        {loading ? <Loader2 size={18} className="animate-spin" /> : (
          <>
            {nextLabel}
            <ArrowRight size={16} strokeWidth={2.5} />
          </>
        )}
      </button>
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          style={{
            width: '100%', padding: '8px 0',
            background: 'transparent', border: 'none',
            color: THEME.textTertiary, fontSize: 13,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Назад
        </button>
      )}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────
type Step = 1 | 2 | 3 | 4;
const TOTAL = 4;

export default function MasterOnboardingPage() {
  const router = useRouter();
  const userId = useAuthStore((s) => s.userId);
  const role   = useAuthStore((s) => s.role);
  const { haptic } = useTelegram();

  const [lang, setLang] = useState<Lang>('uk');
  const [step, setStep] = useState<Step>(1);
  const [dir, setDir] = useState(1);

  // Step 1: profile
  const [name, setName]   = useState('');
  const [city, setCity]   = useState('');
  const [phone, setPhone] = useState('');

  // Step 2: niche
  const [nicheKey, setNicheKey]     = useState<NicheKey | null>(null);
  const [vertical, setVertical]     = useState<string | null>(null);
  const [nicheLabel, setNicheLabel] = useState('');

  // Step 3: services
  const [services, setServices] = useState<ServiceItem[]>([]);

  // Step 4 / saving
  const [saving, setSaving] = useState(false);
  const [slug, setSlug]     = useState<string | null>(null);

  const t = TX[lang];

  // Load language + existing profile data
  useEffect(() => {
    try {
      const stored = localStorage.getItem('cres:locale') as Lang | null;
      if (stored && ['uk', 'ru', 'en'].includes(stored)) setLang(stored);
    } catch {}
  }, []);

  useEffect(() => {
    if (!userId) return;
    // Load profile (name, phone) and master (city, slug) for pre-fill
    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } },
    );
    Promise.all([
      admin.from('profiles').select('full_name, phone, slug').eq('id', userId).maybeSingle(),
      admin.from('masters').select('city, slug').eq('profile_id', userId).maybeSingle(),
    ]).then(([profileRes, masterRes]) => {
      const p = profileRes.data;
      const m = masterRes.data;
      if (p?.full_name) setName(p.full_name);
      if (p?.phone) setPhone(p.phone.replace(/^\+?380/, ''));
      if (m?.city) setCity(m.city);
      const s = m?.slug ?? p?.slug;
      if (s) setSlug(s);
    }).catch(() => {});
  }, [userId]);

  // salon_admin → skip to save immediately after niche
  const isSalonAdmin = role === 'salon_admin';

  const goNext = useCallback(() => { haptic('light'); setDir(1); setStep((s) => Math.min(TOTAL, s + 1) as Step); }, [haptic]);
  const goBack = useCallback(() => { haptic('light'); setDir(-1); setStep((s) => Math.max(1, s - 1) as Step); }, [haptic]);

  // Niche selection → auto-advance
  const selectNiche = useCallback((niche: (typeof NICHES)[0]) => {
    haptic('selection');
    setNicheKey(niche.key);
    setVertical(niche.vertical);
    setNicheLabel(t.niches[niche.key]);
    const defaults = getDefaultServices(niche.vertical);
    setServices(defaults.map((s) => ({ ...s, enabled: true })));
    setTimeout(() => { setDir(1); setStep(3); }, 250);
  }, [haptic, t.niches]);

  // Save everything and show step 4
  const handleFinish = useCallback(async () => {
    if (!userId) return;
    haptic('success');
    setSaving(true);
    try {
      await fetch('/api/telegram/master-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          fullName: name.trim() || undefined,
          phone: phone.trim() ? `+380${phone.replace(/\D/g, '')}` : undefined,
          city: city.trim() || undefined,
          vertical: vertical ?? undefined,
          services: services
            .filter((s) => s.enabled)
            .map((s) => ({ name: s.name, duration_minutes: s.duration_minutes, price: s.price })),
        }),
      });
    } catch { /* non-blocking */ }
    setSaving(false);
    setDir(1);
    setStep(4);
  }, [userId, haptic, name, phone, city, vertical, services]);

  const variants = {
    enter: (d: number) => ({ x: d * 60, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit:  (d: number) => ({ x: d * -60, opacity: 0 }),
  };

  const pageStyle: React.CSSProperties = {
    ...FONT_BASE,
    minHeight: '100dvh',
    background: THEME.bg,
    color: THEME.text,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  };

  // ── Step 4: Success ───────────────────────────────────────────────────────
  if (step === 4) {
    const count = services.filter((s) => s.enabled).length;
    const publicUrl = slug ? `cres-ca.app/${slug}` : null;
    const successGreen = '#22c55e';
    const successDim   = 'rgba(34,197,94,0.1)';
    return (
      <div style={pageStyle}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          {/* Success icon */}
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            padding: '32px 20px', gap: 16, textAlign: 'center',
          }}>
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={SPRING.snappy}
              style={{
                width: 80, height: 80, borderRadius: 40,
                background: successDim,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Check size={36} color={successGreen} strokeWidth={2.5} />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, ...SPRING.soft }}
              style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
            >
              <div style={{ fontSize: 24, fontWeight: 700 }}>{t.step4Title}</div>
              <div style={{ fontSize: 14, color: THEME.textSecondary, lineHeight: 1.6 }}>{t.step4Sub}</div>
            </motion.div>

            {/* Summary card */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, ...SPRING.soft }}
              style={{
                width: '100%', maxWidth: 340,
                background: THEME.surface,
                borderRadius: R.xl,
                padding: 16,
                border: `1px solid ${THEME.border}`,
                textAlign: 'left',
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, color: THEME.textTertiary, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
                {t.labelSummary}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {name && (
                  <SummaryRow Icon={User} text={name} color={THEME.accent} />
                )}
                {nicheLabel && (
                  <SummaryRow Icon={Scissors} text={`${nicheLabel}${city ? ` · ${city}` : ''}`} color={THEME.accent} />
                )}
                {count > 0 && (
                  <SummaryRow Icon={ListChecks} text={`${count} ${t.labelServices}`} color={THEME.accent} />
                )}
                {publicUrl && (
                  <SummaryRow Icon={Check} text={publicUrl} color={successGreen} textColor={successGreen} />
                )}
              </div>
            </motion.div>
          </div>
        </div>

        {/* Open cabinet button */}
        <div style={{
          padding: '12px 20px',
          paddingBottom: 'max(20px, env(safe-area-inset-bottom, 0px))',
          borderTop: `1px solid ${THEME.borderSubtle}`,
          background: THEME.bg,
          flexShrink: 0,
        }}>
          <button
            type="button"
            onClick={() => router.replace('/telegram/m/home')}
            style={{
              width: '100%', padding: '15px 0',
              borderRadius: R.xl,
              background: THEME.accent,
              color: '#fff', fontSize: 15, fontWeight: 700,
              border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              fontFamily: 'inherit',
            }}
          >
            <LayoutDashboard size={18} strokeWidth={2} />
            {t.open}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      {/* Progress bar (shown on steps 1–3) */}
      <ProgressBar step={step} total={TOTAL} />

      {/* Animated step content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <AnimatePresence mode="wait" custom={dir}>
          {/* ── Step 1: Profile ───────────────────────────────────────── */}
          {step === 1 && (
            <motion.div
              key="s1"
              custom={dir}
              variants={variants}
              initial="enter" animate="center" exit="exit"
              transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
            >
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 8px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <StepIcon Icon={User} bg={THEME.accentSoft} color={THEME.accent} />
                <div>
                  <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}>{t.step1Title}</div>
                  <div style={{ fontSize: 13, color: THEME.textSecondary, marginTop: 4, lineHeight: 1.6 }}>{t.step1Sub}</div>
                </div>
                <FormInput label={t.labelName} value={name} onChange={setName} />
                <FormInput label={t.labelCity} value={city} onChange={setCity} />
                <FormInput label={t.labelPhone} value={phone} onChange={setPhone} type="tel" placeholder="+38 (067) 000-00-00" />
              </div>
              <BottomCta
                onNext={goNext}
                nextLabel={t.next}
                disabled={!name.trim()}
              />
            </motion.div>
          )}

          {/* ── Step 2: Niche ─────────────────────────────────────────── */}
          {step === 2 && (
            <motion.div
              key="s2"
              custom={dir}
              variants={variants}
              initial="enter" animate="center" exit="exit"
              transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
            >
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 8px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <StepIcon Icon={Scissors} bg="rgba(245,158,11,0.1)" color="#f59e0b" />
                <div>
                  <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}>{t.step2Title}</div>
                  <div style={{ fontSize: 13, color: THEME.textSecondary, marginTop: 4, lineHeight: 1.6 }}>{t.step2Sub}</div>
                </div>
                {/* 3-column niche grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {NICHES.map(({ key, Icon }) => {
                    const sel = nicheKey === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => selectNiche({ key, vertical: NICHES.find(n => n.key === key)!.vertical, Icon })}
                        style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                          padding: '12px 8px', borderRadius: R.lg,
                          border: `1.5px solid ${sel ? THEME.accent : THEME.border}`,
                          background: sel ? THEME.accentSoft : THEME.surface,
                          cursor: 'pointer', fontSize: 11, fontWeight: 500,
                          color: sel ? THEME.accent : THEME.textSecondary,
                          fontFamily: 'inherit', textAlign: 'center',
                          transition: 'all 0.15s',
                          WebkitTapHighlightColor: 'transparent',
                        }}
                      >
                        <Icon size={20} color={sel ? THEME.accent : THEME.textSecondary} strokeWidth={2} />
                        {t.niches[key]}
                      </button>
                    );
                  })}
                </div>
              </div>
              <BottomCta
                onNext={goNext}
                onBack={goBack}
                nextLabel={t.next}
                disabled={!nicheKey}
              />
            </motion.div>
          )}

          {/* ── Step 3: Services ──────────────────────────────────────── */}
          {step === 3 && (
            <motion.div
              key="s3"
              custom={dir}
              variants={variants}
              initial="enter" animate="center" exit="exit"
              transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
            >
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 8px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <StepIcon Icon={ListChecks} bg="rgba(34,197,94,0.1)" color="#22c55e" />
                <div>
                  <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}>{t.step3Title}</div>
                  <div style={{ fontSize: 13, color: THEME.textSecondary, marginTop: 4, lineHeight: 1.6 }}>{t.step3Sub}</div>
                </div>
                {/* Service chips */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {services.map((svc, i) => {
                    const sel = svc.enabled;
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          haptic('selection');
                          setServices((prev) => prev.map((s, j) => j === i ? { ...s, enabled: !s.enabled } : s));
                        }}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '12px 14px',
                          borderRadius: R.md,
                          border: `1.5px solid ${sel ? THEME.accent : THEME.border}`,
                          background: sel ? THEME.accentSoft : THEME.surface,
                          cursor: 'pointer', fontSize: 13,
                          fontFamily: 'inherit',
                          transition: 'all 0.15s',
                          WebkitTapHighlightColor: 'transparent',
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left', gap: 2 }}>
                          <span style={{ fontWeight: 600, color: THEME.text }}>{svc.name}</span>
                          <span style={{ fontSize: 12, color: THEME.textSecondary }}>
                            {svc.price > 0 ? `₴${svc.price}` : ''}
                            {svc.price > 0 && svc.duration_minutes > 0 ? ' · ' : ''}
                            {svc.duration_minutes > 0 ? `${svc.duration_minutes} хв` : ''}
                          </span>
                        </div>
                        <div style={{
                          width: 22, height: 22, borderRadius: 11, flexShrink: 0,
                          border: `1.5px solid ${sel ? THEME.accent : THEME.border}`,
                          background: sel ? THEME.accent : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all 0.15s',
                        }}>
                          {sel && <Check size={11} color="#fff" strokeWidth={3} />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
              <BottomCta
                onNext={handleFinish}
                onBack={goBack}
                nextLabel={t.next}
                loading={saving}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Summary card row ─────────────────────────────────────────────────────────
function SummaryRow({ Icon, text, color, textColor }: { Icon: IconCmp; text: string; color: string; textColor?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <Icon size={13} color={color} strokeWidth={2} />
      <span style={{ fontSize: 13, fontWeight: 600, color: textColor ?? THEME.text }}>{text}</span>
    </div>
  );
}
