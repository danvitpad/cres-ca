/** --- YAML
 * name: MasterMiniAppOnboarding
 * description: 3-step post-registration onboarding for masters inside Mini App.
 *   Step 1 — vertical (industry selection, 10 tiles, auto-advance).
 *   Step 2 — specialization (filtered list, single-select).
 *   Step 3 — first services (pre-suggested, toggle + inline price edit).
 *   Saves via /api/telegram/master-setup → redirects to /telegram/m/home.
 *   Reads cres:locale from localStorage. Fullscreen (no bottom nav).
 * created: 2026-04-29
 * --- */

'use client';

import { useEffect, useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Check, ChevronRight, Loader2 } from 'lucide-react';
import { T as THEME, R, FONT_BASE, SHADOW, SPRING } from '@/components/miniapp/design';
import { getDefaultServices, type DefaultService } from '@/lib/verticals/default-services';
import { getSpecializations } from '@/lib/verticals/specializations';
import { useAuthStore } from '@/stores/auth-store';

// ─── i18n ────────────────────────────────────────────────────────────────────
type Lang = 'uk' | 'ru' | 'en';

const T = {
  uk: {
    step1Title: 'Чим ви займаєтесь?',
    step1Sub: 'Оберіть свою нішу — ми підготуємо послуги',
    step2Title: 'Ваша спеціалізація',
    step2Sub: 'Допомагає клієнтам зрозуміти, з ким вони працюють',
    step2Skip: 'Пропустити',
    step2Next: 'Далі',
    step3Title: 'Перші послуги',
    step3Sub: 'Відредагуйте ціни або приберіть зайве',
    step3Start: 'Почати роботу',
    step3Skip: 'Пропустити — додам пізніше',
    saving: 'Зберігаємо…',
    done: 'Ласкаво просимо!',
    of: 'з',
    priceLabel: '₴',
    minLabel: 'хв',
  },
  ru: {
    step1Title: 'Чем вы занимаетесь?',
    step1Sub: 'Выберите свою нишу — мы подготовим услуги',
    step2Title: 'Ваша специализация',
    step2Sub: 'Помогает клиентам понять, с кем они работают',
    step2Skip: 'Пропустить',
    step2Next: 'Далее',
    step3Title: 'Первые услуги',
    step3Sub: 'Отредактируйте цены или уберите лишнее',
    step3Start: 'Начать работу',
    step3Skip: 'Пропустить — добавлю позже',
    saving: 'Сохраняем…',
    done: 'Добро пожаловать!',
    of: 'из',
    priceLabel: '₴',
    minLabel: 'мин',
  },
  en: {
    step1Title: 'What do you do?',
    step1Sub: "Choose your niche — we'll prepare services",
    step2Title: 'Your specialization',
    step2Sub: "Helps clients understand who they're working with",
    step2Skip: 'Skip',
    step2Next: 'Next',
    step3Title: 'First services',
    step3Sub: 'Edit prices or remove what you don\'t need',
    step3Start: 'Start working',
    step3Skip: 'Skip — I\'ll add later',
    saving: 'Saving…',
    done: 'Welcome!',
    of: 'of',
    priceLabel: '₴',
    minLabel: 'min',
  },
} as const;

// ─── Vertical definitions ────────────────────────────────────────────────────
const VERTICALS = [
  {
    key: 'beauty',
    emoji: '💅',
    label: { ru: 'Красота', uk: 'Краса', en: 'Beauty' },
    desc: { ru: 'Стрижки, маникюр, макияж', uk: 'Стрижки, манікюр, макіяж', en: 'Hair, nails, make-up' },
  },
  {
    key: 'health',
    emoji: '🩺',
    label: { ru: 'Здоровье', uk: 'Здоров\'я', en: 'Health' },
    desc: { ru: 'Медицина, массаж', uk: 'Медицина, масаж', en: 'Medical, massage' },
  },
  {
    key: 'fitness',
    emoji: '💪',
    label: { ru: 'Фитнес', uk: 'Фітнес', en: 'Fitness' },
    desc: { ru: 'Тренер, йога, пилатес', uk: 'Тренер, йога, пілатес', en: 'Trainer, yoga, pilates' },
  },
  {
    key: 'tattoo',
    emoji: '🖊️',
    label: { ru: 'Тату', uk: 'Тату', en: 'Tattoo' },
    desc: { ru: 'Тату, пирсинг, перманент', uk: 'Тату, пірсинг, перманент', en: 'Tattoo, piercing, PMU' },
  },
  {
    key: 'pets',
    emoji: '🐾',
    label: { ru: 'Животные', uk: 'Тварини', en: 'Pets' },
    desc: { ru: 'Груминг, ветеринар', uk: 'Грумінг, ветеринар', en: 'Grooming, vet' },
  },
  {
    key: 'auto',
    emoji: '🚗',
    label: { ru: 'Авто', uk: 'Авто', en: 'Auto' },
    desc: { ru: 'Мойка, детейлинг, ремонт', uk: 'Мийка, детейлінг, ремонт', en: 'Car wash, detailing' },
  },
  {
    key: 'events',
    emoji: '📸',
    label: { ru: 'Мероприятия', uk: 'Заходи', en: 'Events' },
    desc: { ru: 'Фото, ведущий, диджей', uk: 'Фото, ведучий, діджей', en: 'Photo, MC, DJ' },
  },
  {
    key: 'education',
    emoji: '📚',
    label: { ru: 'Обучение', uk: 'Навчання', en: 'Education' },
    desc: { ru: 'Репетитор, коуч, ментор', uk: 'Репетитор, коуч, ментор', en: 'Tutor, coach, mentor' },
  },
  {
    key: 'craft',
    emoji: '🔨',
    label: { ru: 'Ремесло', uk: 'Ремесло', en: 'Craft' },
    desc: { ru: 'Портной, сапожник, столяр', uk: 'Кравець, шевець, тесля', en: 'Tailor, cobbler, joiner' },
  },
  {
    key: 'other',
    emoji: '⚡',
    label: { ru: 'Другое', uk: 'Інше', en: 'Other' },
    desc: { ru: 'Своя ниша', uk: 'Своя ніша', en: 'Custom niche' },
  },
] as const;

// ─── Service item with local state ───────────────────────────────────────────
interface ServiceItem extends DefaultService {
  id: number;
  enabled: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const STEP_COUNT = 3;

function StepDots({ current, total }: { current: number; total: number }) {
  const steps = Array.from({ length: total }, (_, i) => i + 1);
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center' }}>
      {steps.map((n) => (
        <motion.div
          key={n}
          animate={{ width: n === current ? 24 : 8, opacity: n === current ? 1 : 0.3 }}
          transition={{ duration: 0.25 }}
          style={{
            height: 6,
            borderRadius: 3,
            background: THEME.accent,
          }}
        />
      ))}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function MasterOnboardingPage() {
  const router = useRouter();
  const userId = useAuthStore((s) => s.userId);
  const role   = useAuthStore((s) => s.role);

  const [lang, setLang] = useState<Lang>('ru');
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [direction, setDirection] = useState(1); // 1=forward, -1=back

  const [vertical, setVertical] = useState<string | null>(null);
  const [specialization, setSpecialization] = useState<string | null>(null);
  const [services, setServices] = useState<ServiceItem[]>([]);

  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [pendingSalonRoute, setPendingSalonRoute] = useState<string | null>(null);

  // Load saved language
  useEffect(() => {
    try {
      const stored = localStorage.getItem('cres:locale') as Lang | null;
      if (stored && ['uk', 'ru', 'en'].includes(stored)) setLang(stored);
    } catch {}
  }, []);

  // After done=true: wait 500ms then navigate to the right destination.
  // salon_admin → pendingSalonRoute (set by finishSalonAdmin)
  // master      → /telegram/m/home
  useEffect(() => {
    if (!done) return;
    const target = pendingSalonRoute ?? '/telegram/m/home';
    const id = setTimeout(() => router.replace(target), 500);
    return () => clearTimeout(id);
  }, [done, pendingSalonRoute, router]);

  const t = T[lang];

  // ── salon_admin: vertical tap → immediate save → salon dashboard ──────────
  const finishSalonAdmin = useCallback(
    async (selectedVertical: string) => {
      if (!userId) return;
      setSaving(true);
      try {
        const res = await fetch('/api/telegram/master-setup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, vertical: selectedVertical }),
        });
        const data = (await res.json().catch(() => ({}))) as { salonId?: string };
        const target = data.salonId
          ? `/telegram/m/salon/${data.salonId}/dashboard`
          : '/telegram/m/home';
        setPendingSalonRoute(target);
      } catch {
        setPendingSalonRoute('/telegram/m/home');
      }
      setDone(true);
    },
    [userId],
  );

  // ── Step 1 handler ─────────────────────────────────────────────────────────
  const handleVerticalSelect = useCallback(
    (key: string) => {
      // salon_admin: single step — save vertical + go to salon dashboard
      if (role === 'salon_admin') {
        setVertical(key);
        finishSalonAdmin(key);
        return;
      }
      // master: load default services, continue to step 2
      setVertical(key);
      const defaults = getDefaultServices(key);
      setServices(
        defaults.map((s, i) => ({ ...s, id: i, enabled: true })),
      );
      setSpecialization(null);
      setDirection(1);
      setStep(2);
    },
    [role, finishSalonAdmin],
  );

  // ── Step 2 handlers ────────────────────────────────────────────────────────
  const goToStep3 = useCallback(() => {
    setDirection(1);
    setStep(3);
  }, []);

  const backToStep1 = useCallback(() => {
    setDirection(-1);
    setStep(1);
  }, []);

  const backToStep2 = useCallback(() => {
    setDirection(-1);
    setStep(2);
  }, []);

  // ── Finish ─────────────────────────────────────────────────────────────────
  async function finish(skipServices = false) {
    if (!userId) return;
    setSaving(true);

    const selectedServices = skipServices
      ? []
      : services.filter((s) => s.enabled).map((s) => ({
          name: s.name,
          duration_minutes: s.duration_minutes,
          price: s.price,
        }));

    try {
      await fetch('/api/telegram/master-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          vertical: vertical ?? undefined,
          specialization: specialization ?? undefined,
          services: selectedServices,
        }),
      });
    } catch {
      // Non-blocking — even if it fails, proceed to home
    }

    setDone(true);
    // Redirect handled by the done-watcher useEffect below
  }

  // ── Slide animation variants ───────────────────────────────────────────────
  const variants = {
    enter: (d: number) => ({ x: d * 64, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d * -64, opacity: 0 }),
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

  // ── Done overlay ───────────────────────────────────────────────────────────
  if (done || saving) {
    return (
      <div style={{ ...pageStyle, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        {done ? (
          <>
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={SPRING.snappy}
              style={{
                width: 64, height: 64, borderRadius: 32,
                background: THEME.accentSoft,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Check size={28} color={THEME.accent} strokeWidth={2.5} />
            </motion.div>
            <p style={{ fontSize: 18, fontWeight: 700, color: THEME.text }}>{t.done}</p>
          </>
        ) : (
          <>
            <Loader2 size={28} color={THEME.accent} className="animate-spin" />
            <p style={{ fontSize: 15, color: THEME.textSecondary }}>{t.saving}</p>
          </>
        )}
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 20px',
          paddingTop: 'max(12px, env(safe-area-inset-top))',
          flexShrink: 0,
        }}
      >
        {/* Back button — visible on steps 2 and 3 */}
        <div style={{ width: 36 }}>
          {step > 1 && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              type="button"
              onClick={step === 2 ? backToStep1 : backToStep2}
              style={{
                width: 36, height: 36, borderRadius: 18,
                border: `1px solid ${THEME.border}`,
                background: THEME.surface,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
                color: THEME.text,
              }}
            >
              <ArrowLeft size={16} />
            </motion.button>
          )}
        </div>

        {/* Step dots — salon_admin has only 1 step */}
        {role === 'salon_admin'
          ? <StepDots current={1} total={1} />
          : <StepDots current={step as 1 | 2 | 3} total={STEP_COUNT} />
        }

        {/* Step counter */}
        <div style={{ width: 36, textAlign: 'right' }}>
          <span style={{ fontSize: 12, color: THEME.textTertiary, fontWeight: 500 }}>
            {step}/{role === 'salon_admin' ? 1 : STEP_COUNT}
          </span>
        </div>
      </div>

      {/* ── Animated step content ────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <AnimatePresence mode="wait" custom={direction}>
          {step === 1 && (
            <motion.div
              key="step1"
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
            >
              <Step1Vertical lang={lang} t={t} onSelect={handleVerticalSelect} />
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
            >
              <Step2Spec
                lang={lang}
                t={t}
                vertical={vertical}
                selected={specialization}
                onSelect={setSpecialization}
                onNext={goToStep3}
              />
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
            >
              <Step3Services
                lang={lang}
                t={t}
                services={services}
                onChange={setServices}
                onFinish={() => finish(false)}
                onSkip={() => finish(true)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 1 — Vertical
// ─────────────────────────────────────────────────────────────────────────────
function Step1Vertical({
  lang,
  t,
  onSelect,
}: {
  lang: Lang;
  t: (typeof T)[Lang];
  onSelect: (key: string) => void;
}) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '8px 20px 20px', flexShrink: 0 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', margin: 0, lineHeight: 1.2 }}>
          {t.step1Title}
        </h1>
        <p style={{ fontSize: 14, color: THEME.textSecondary, marginTop: 6, marginBottom: 0 }}>
          {t.step1Sub}
        </p>
      </div>

      {/* Grid */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0 16px',
          paddingBottom: 'calc(24px + env(safe-area-inset-bottom, 0px))',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 12,
          }}
        >
          {VERTICALS.map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => onSelect(v.key)}
              style={{
                background: THEME.surface,
                border: `1.5px solid ${THEME.border}`,
                borderRadius: R.lg,
                padding: '16px 14px',
                textAlign: 'left',
                cursor: 'pointer',
                boxShadow: SHADOW.card,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                WebkitTapHighlightColor: 'transparent',
                transition: 'transform 0.12s, box-shadow 0.12s',
                minHeight: 96,
              }}
              onPointerDown={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.96)';
                (e.currentTarget as HTMLButtonElement).style.boxShadow = SHADOW.none;
              }}
              onPointerUp={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
                (e.currentTarget as HTMLButtonElement).style.boxShadow = SHADOW.card;
              }}
              onPointerLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
                (e.currentTarget as HTMLButtonElement).style.boxShadow = SHADOW.card;
              }}
            >
              <span style={{ fontSize: 32, lineHeight: 1 }}>{v.emoji}</span>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: THEME.text, lineHeight: 1.2 }}>
                  {v.label[lang]}
                </div>
                <div style={{ fontSize: 11, color: THEME.textTertiary, marginTop: 2, lineHeight: 1.3 }}>
                  {v.desc[lang]}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 2 — Specialization
// ─────────────────────────────────────────────────────────────────────────────
function Step2Spec({
  lang,
  t,
  vertical,
  selected,
  onSelect,
  onNext,
}: {
  lang: Lang;
  t: (typeof T)[Lang];
  vertical: string | null;
  selected: string | null;
  onSelect: (s: string) => void;
  onNext: () => void;
}) {
  const specs = getSpecializations(vertical);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '8px 20px 20px', flexShrink: 0 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', margin: 0, lineHeight: 1.2 }}>
          {t.step2Title}
        </h1>
        <p style={{ fontSize: 14, color: THEME.textSecondary, marginTop: 6, marginBottom: 0 }}>
          {t.step2Sub}
        </p>
      </div>

      {/* List */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0 16px',
          paddingBottom: 24,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {specs.map((spec) => {
            const isSelected = selected === spec;
            return (
              <button
                key={spec}
                type="button"
                onClick={() => onSelect(spec)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 16px',
                  borderRadius: R.md,
                  border: `1.5px solid ${isSelected ? THEME.accent : THEME.border}`,
                  background: isSelected ? THEME.accentSoft : THEME.surface,
                  cursor: 'pointer',
                  WebkitTapHighlightColor: 'transparent',
                  transition: 'border-color 0.15s, background 0.15s',
                }}
              >
                <span
                  style={{
                    fontSize: 15,
                    fontWeight: isSelected ? 600 : 400,
                    color: isSelected ? THEME.accent : THEME.text,
                  }}
                >
                  {spec}
                </span>
                {isSelected && (
                  <Check size={18} color={THEME.accent} strokeWidth={2.5} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom CTA */}
      <div
        style={{
          padding: '12px 20px',
          paddingBottom: 'max(20px, env(safe-area-inset-bottom, 0px))',
          borderTop: `1px solid ${THEME.borderSubtle}`,
          background: THEME.bg,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <button
          type="button"
          onClick={onNext}
          style={{
            width: '100%',
            padding: '15px 0',
            borderRadius: R.xl,
            background: THEME.accent,
            color: '#fff',
            fontSize: 16,
            fontWeight: 700,
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          {t.step2Next}
          <ChevronRight size={18} strokeWidth={2.5} />
        </button>
        <button
          type="button"
          onClick={onNext}
          style={{
            width: '100%',
            padding: '10px 0',
            background: 'transparent',
            border: 'none',
            color: THEME.textTertiary,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          {t.step2Skip}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 3 — Services
// ─────────────────────────────────────────────────────────────────────────────
function Step3Services({
  lang,
  t,
  services,
  onChange,
  onFinish,
  onSkip,
}: {
  lang: Lang;
  t: (typeof T)[Lang];
  services: ServiceItem[];
  onChange: (s: ServiceItem[]) => void;
  onFinish: () => void;
  onSkip: () => void;
}) {
  const enabledCount = services.filter((s) => s.enabled).length;

  function toggleService(id: number) {
    onChange(services.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)));
  }

  function updatePrice(id: number, raw: string) {
    const num = parseInt(raw.replace(/\D/g, ''), 10);
    const price = isNaN(num) ? 0 : num;
    onChange(services.map((s) => (s.id === id ? { ...s, price } : s)));
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '8px 20px 16px', flexShrink: 0 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', margin: 0, lineHeight: 1.2 }}>
          {t.step3Title}
        </h1>
        <p style={{ fontSize: 14, color: THEME.textSecondary, marginTop: 6, marginBottom: 0 }}>
          {t.step3Sub}
        </p>
      </div>

      {/* Service list */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0 16px',
          paddingBottom: 16,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {services.map((svc) => (
            <div
              key={svc.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 14px',
                borderRadius: R.md,
                border: `1.5px solid ${svc.enabled ? THEME.border : THEME.borderSubtle}`,
                background: svc.enabled ? THEME.surface : THEME.bgSubtle,
                opacity: svc.enabled ? 1 : 0.55,
                transition: 'opacity 0.15s, border-color 0.15s, background 0.15s',
              }}
            >
              {/* Toggle */}
              <button
                type="button"
                onClick={() => toggleService(svc.id)}
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  border: `2px solid ${svc.enabled ? THEME.accent : THEME.border}`,
                  background: svc.enabled ? THEME.accent : 'transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  transition: 'border-color 0.15s, background 0.15s',
                }}
              >
                {svc.enabled && <Check size={12} color="#fff" strokeWidth={3} />}
              </button>

              {/* Name + duration */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: THEME.text,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {svc.name}
                </div>
                {svc.duration_minutes > 0 && (
                  <div style={{ fontSize: 11, color: THEME.textTertiary, marginTop: 1 }}>
                    {svc.duration_minutes} {t.minLabel}
                  </div>
                )}
              </div>

              {/* Price input */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                  flexShrink: 0,
                }}
              >
                <input
                  type="number"
                  inputMode="numeric"
                  value={svc.price === 0 ? '' : svc.price}
                  placeholder="0"
                  onChange={(e) => updatePrice(svc.id, e.target.value)}
                  disabled={!svc.enabled}
                  style={{
                    width: 64,
                    padding: '5px 8px',
                    borderRadius: R.sm,
                    border: `1.5px solid ${THEME.border}`,
                    background: THEME.bgSubtle,
                    color: THEME.text,
                    fontSize: 14,
                    fontWeight: 600,
                    textAlign: 'right',
                    outline: 'none',
                  }}
                />
                <span style={{ fontSize: 13, color: THEME.textSecondary, fontWeight: 500 }}>
                  {t.priceLabel}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom CTA */}
      <div
        style={{
          padding: '12px 20px',
          paddingBottom: 'max(20px, env(safe-area-inset-bottom, 0px))',
          borderTop: `1px solid ${THEME.borderSubtle}`,
          background: THEME.bg,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <button
          type="button"
          onClick={onFinish}
          style={{
            width: '100%',
            padding: '15px 0',
            borderRadius: R.xl,
            background: THEME.accent,
            color: '#fff',
            fontSize: 16,
            fontWeight: 700,
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          {t.step3Start}
          {enabledCount > 0 && (
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                background: 'rgba(255,255,255,0.25)',
                borderRadius: 10,
                padding: '2px 7px',
                marginLeft: 2,
              }}
            >
              {enabledCount}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={onSkip}
          style={{
            width: '100%',
            padding: '10px 0',
            background: 'transparent',
            border: 'none',
            color: THEME.textTertiary,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          {t.step3Skip}
        </button>
      </div>
    </div>
  );
}
