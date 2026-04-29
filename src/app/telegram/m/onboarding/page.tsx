/** --- YAML
 * name: MasterMiniAppOnboarding
 * description: Post-registration onboarding for masters inside Mini App.
 *   Master flow (4 steps):
 *     1 — vertical (industry selection, lucide icons, auto-advance)
 *     2 — specialization (filtered list, single-select)
 *     3 — workplace (cabinet / mobile / both)
 *     4 — first services (pre-suggested, toggle + price edit)
 *   Salon-admin flow (1 step):
 *     1 — vertical → /telegram/m/salon/{id}/dashboard
 *   Saves via /api/telegram/master-setup. Reads cres:locale.
 *   Fullscreen — bottom nav hidden via /telegram/m/layout.tsx isFullscreen.
 * created: 2026-04-29
 * updated: 2026-04-29
 * --- */

'use client';

import { useEffect, useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Check, ChevronRight, Loader2,
  // Vertical icons
  Scissors, Stethoscope, Dumbbell, Palette, PawPrint,
  Car, PartyPopper, GraduationCap, Hammer, MoreHorizontal,
  // Workplace icons
  Home, MapPin, Sparkles,
} from 'lucide-react';
import { T as THEME, R, FONT_BASE, SHADOW, SPRING } from '@/components/miniapp/design';
import { getDefaultServices, type DefaultService } from '@/lib/verticals/default-services';
import { getSpecializations } from '@/lib/verticals/specializations';
import { useAuthStore } from '@/stores/auth-store';

// ─── i18n ────────────────────────────────────────────────────────────────────
type Lang = 'uk' | 'ru' | 'en';
type WorkMode = 'cabinet' | 'mobile' | 'both';

const T = {
  uk: {
    step1Title: 'Чим ви займаєтесь?',
    step1Sub: 'Оберіть свою нішу — ми підготуємо послуги',
    step2Title: 'Ваша спеціалізація',
    step2Sub: 'Допомагає клієнтам зрозуміти, з ким вони працюють',
    step3Title: 'Де ви працюєте?',
    step3Sub: 'Клієнти приходять до вас чи ви виїжджаєте?',
    step3Cabinet: 'У своєму кабінеті', step3CabinetSub: 'Клієнти приходять за моєю адресою',
    step3Mobile:  'На виїзді', step3MobileSub:  'Я їжджу до клієнтів',
    step3Both:    'І так, і так', step3BothSub:    'Залежно від послуги',
    step4Title: 'Перші послуги',
    step4Sub: 'Відредагуйте ціни або приберіть зайве',
    next: 'Далі',
    skip: 'Пропустити',
    start: 'Почати роботу',
    skipServices: 'Пропустити — додам пізніше',
    saving: 'Зберігаємо…',
    done: 'Ласкаво просимо!',
    minLabel: 'хв',
    priceLabel: '₴',
  },
  ru: {
    step1Title: 'Чем вы занимаетесь?',
    step1Sub: 'Выберите свою нишу — мы подготовим услуги',
    step2Title: 'Ваша специализация',
    step2Sub: 'Помогает клиентам понять, с кем они работают',
    step3Title: 'Где вы работаете?',
    step3Sub: 'Клиенты приходят к вам или вы выезжаете?',
    step3Cabinet: 'В своём кабинете', step3CabinetSub: 'Клиенты приходят по моему адресу',
    step3Mobile:  'На выезде', step3MobileSub:  'Я езжу к клиентам',
    step3Both:    'И так, и так', step3BothSub:    'Зависит от услуги',
    step4Title: 'Первые услуги',
    step4Sub: 'Отредактируйте цены или уберите лишнее',
    next: 'Далее',
    skip: 'Пропустить',
    start: 'Начать работу',
    skipServices: 'Пропустить — добавлю позже',
    saving: 'Сохраняем…',
    done: 'Добро пожаловать!',
    minLabel: 'мин',
    priceLabel: '₴',
  },
  en: {
    step1Title: 'What do you do?',
    step1Sub: "Choose your niche — we'll prepare services",
    step2Title: 'Your specialization',
    step2Sub: "Helps clients understand who they're working with",
    step3Title: 'Where do you work?',
    step3Sub: 'Do clients come to you or do you travel?',
    step3Cabinet: 'At my place', step3CabinetSub: 'Clients come to my address',
    step3Mobile:  'On the go', step3MobileSub:  'I travel to clients',
    step3Both:    'Both', step3BothSub:    'Depends on the service',
    step4Title: 'First services',
    step4Sub: "Edit prices or remove what you don't need",
    next: 'Next',
    skip: 'Skip',
    start: 'Start working',
    skipServices: "Skip — I'll add later",
    saving: 'Saving…',
    done: 'Welcome!',
    minLabel: 'min',
    priceLabel: '₴',
  },
} as const;

// ─── Vertical definitions (lucide icons in CRES-CA accent style) ─────────────
type IconCmp = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

const VERTICALS: Array<{
  key: string;
  Icon: IconCmp;
  label: { ru: string; uk: string; en: string };
  desc:  { ru: string; uk: string; en: string };
}> = [
  { key: 'beauty',    Icon: Scissors,        label: { ru: 'Красота',     uk: 'Краса',       en: 'Beauty' },     desc: { ru: 'Стрижки, маникюр, макияж',   uk: 'Стрижки, манікюр, макіяж',  en: 'Hair, nails, make-up' } },
  { key: 'health',    Icon: Stethoscope,     label: { ru: 'Здоровье',    uk: "Здоров'я",    en: 'Health' },     desc: { ru: 'Медицина, массаж',           uk: 'Медицина, масаж',           en: 'Medical, massage' } },
  { key: 'fitness',   Icon: Dumbbell,        label: { ru: 'Фитнес',      uk: 'Фітнес',      en: 'Fitness' },    desc: { ru: 'Тренер, йога, пилатес',      uk: 'Тренер, йога, пілатес',     en: 'Trainer, yoga, pilates' } },
  { key: 'tattoo',    Icon: Palette,         label: { ru: 'Тату',        uk: 'Тату',        en: 'Tattoo' },     desc: { ru: 'Тату, пирсинг, перманент',   uk: 'Тату, пірсинг, перманент',  en: 'Tattoo, piercing, PMU' } },
  { key: 'pets',      Icon: PawPrint,        label: { ru: 'Животные',    uk: 'Тварини',     en: 'Pets' },       desc: { ru: 'Груминг, ветеринар',         uk: 'Грумінг, ветеринар',        en: 'Grooming, vet' } },
  { key: 'auto',      Icon: Car,             label: { ru: 'Авто',        uk: 'Авто',        en: 'Auto' },       desc: { ru: 'Мойка, детейлинг, ремонт',   uk: 'Мийка, детейлінг, ремонт',  en: 'Wash, detailing' } },
  { key: 'events',    Icon: PartyPopper,     label: { ru: 'Мероприятия', uk: 'Заходи',      en: 'Events' },     desc: { ru: 'Фото, ведущий, диджей',      uk: 'Фото, ведучий, діджей',     en: 'Photo, MC, DJ' } },
  { key: 'education', Icon: GraduationCap,   label: { ru: 'Обучение',    uk: 'Навчання',    en: 'Education' },  desc: { ru: 'Репетитор, коуч, ментор',    uk: 'Репетитор, коуч, ментор',   en: 'Tutor, coach, mentor' } },
  { key: 'craft',     Icon: Hammer,          label: { ru: 'Ремесло',     uk: 'Ремесло',     en: 'Craft' },      desc: { ru: 'Портной, сапожник, столяр',  uk: 'Кравець, шевець, тесля',    en: 'Tailor, cobbler, joiner' } },
  { key: 'other',     Icon: MoreHorizontal,  label: { ru: 'Другое',      uk: 'Інше',        en: 'Other' },      desc: { ru: 'Своя ниша',                  uk: 'Своя ніша',                 en: 'Custom niche' } },
];

// ─── Workplace options ───────────────────────────────────────────────────────
const WORKPLACES: Array<{ key: WorkMode; Icon: IconCmp }> = [
  { key: 'cabinet', Icon: Home },
  { key: 'mobile',  Icon: MapPin },
  { key: 'both',    Icon: Sparkles },
];

// ─── Service item with local state ───────────────────────────────────────────
interface ServiceItem extends DefaultService {
  id: number;
  enabled: boolean;
}

// ─── Step indicator ──────────────────────────────────────────────────────────
function StepDots({ current, total }: { current: number; total: number }) {
  const steps = Array.from({ length: total }, (_, i) => i + 1);
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center' }}>
      {steps.map((n) => (
        <motion.div
          key={n}
          animate={{ width: n === current ? 24 : 8, opacity: n === current ? 1 : 0.3 }}
          transition={{ duration: 0.25 }}
          style={{ height: 6, borderRadius: 3, background: THEME.accent }}
        />
      ))}
    </div>
  );
}

// Hide native number-input arrows (Chromium + Firefox + Safari)
const HIDE_SPIN_CSS = `
input[type="number"]::-webkit-outer-spin-button,
input[type="number"]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
input[type="number"] { -moz-appearance: textfield; appearance: textfield; }
`;

// ─── Page ────────────────────────────────────────────────────────────────────
type Step = 1 | 2 | 3 | 4;

export default function MasterOnboardingPage() {
  const router = useRouter();
  const userId = useAuthStore((s) => s.userId);
  const role   = useAuthStore((s) => s.role);

  const [lang, setLang] = useState<Lang>('ru');
  const [step, setStep] = useState<Step>(1);
  const [direction, setDirection] = useState(1);

  const [vertical, setVertical] = useState<string | null>(null);
  const [specialization, setSpecialization] = useState<string | null>(null);
  const [workMode, setWorkMode] = useState<WorkMode | null>(null);
  const [services, setServices] = useState<ServiceItem[]>([]);

  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [pendingSalonRoute, setPendingSalonRoute] = useState<string | null>(null);

  const totalSteps = role === 'salon_admin' ? 1 : 4;

  // Load saved language
  useEffect(() => {
    try {
      const stored = localStorage.getItem('cres:locale') as Lang | null;
      if (stored && ['uk', 'ru', 'en'].includes(stored)) setLang(stored);
    } catch {}
  }, []);

  // After done=true → navigate. salon_admin uses pendingSalonRoute; master → home.
  useEffect(() => {
    if (!done) return;
    const target = pendingSalonRoute ?? '/telegram/m/home';
    const id = setTimeout(() => router.replace(target), 500);
    return () => clearTimeout(id);
  }, [done, pendingSalonRoute, router]);

  const t = T[lang];

  // ── salon_admin: vertical tap → save → salon dashboard ────────────────────
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

  // ── Step 1: vertical select ───────────────────────────────────────────────
  const handleVerticalSelect = useCallback(
    (key: string) => {
      if (role === 'salon_admin') {
        setVertical(key);
        finishSalonAdmin(key);
        return;
      }
      setVertical(key);
      const defaults = getDefaultServices(key);
      setServices(defaults.map((s, i) => ({ ...s, id: i, enabled: true })));
      setSpecialization(null);
      setDirection(1);
      setStep(2);
    },
    [role, finishSalonAdmin],
  );

  // ── Forward / back nav ────────────────────────────────────────────────────
  const goNext = useCallback(() => {
    setDirection(1);
    setStep((s) => (s < 4 ? ((s + 1) as Step) : s));
  }, []);

  const goBack = useCallback(() => {
    setDirection(-1);
    setStep((s) => (s > 1 ? ((s - 1) as Step) : s));
  }, []);

  // ── Final save (master) ───────────────────────────────────────────────────
  async function finish(skipServices = false) {
    if (!userId) return;
    setSaving(true);
    const selected = skipServices
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
          workMode: workMode ?? undefined,
          services: selected,
        }),
      });
    } catch { /* non-blocking */ }

    setDone(true);
  }

  // ── Animation ─────────────────────────────────────────────────────────────
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

  // ── Done / saving overlay ─────────────────────────────────────────────────
  if (done || saving) {
    return (
      <div style={{ ...pageStyle, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <style>{HIDE_SPIN_CSS}</style>
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
      <style>{HIDE_SPIN_CSS}</style>

      {/* Top bar */}
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
        <div style={{ width: 36 }}>
          {step > 1 && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              type="button"
              onClick={goBack}
              style={{
                width: 36, height: 36, borderRadius: 18,
                border: `1px solid ${THEME.border}`,
                background: THEME.surface,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: THEME.text,
              }}
            >
              <ArrowLeft size={16} />
            </motion.button>
          )}
        </div>

        <StepDots current={step} total={totalSteps} />

        <div style={{ width: 36, textAlign: 'right' }}>
          <span style={{ fontSize: 12, color: THEME.textTertiary, fontWeight: 500 }}>
            {step}/{totalSteps}
          </span>
        </div>
      </div>

      {/* Animated step content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <AnimatePresence mode="wait" custom={direction}>
          {step === 1 && (
            <motion.div
              key="step1"
              custom={direction}
              variants={variants}
              initial="enter" animate="center" exit="exit"
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
              initial="enter" animate="center" exit="exit"
              transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
            >
              <Step2Spec
                t={t}
                vertical={vertical}
                selected={specialization}
                onSelect={setSpecialization}
                onNext={goNext}
              />
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              custom={direction}
              variants={variants}
              initial="enter" animate="center" exit="exit"
              transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
            >
              <Step3Workplace
                t={t}
                selected={workMode}
                onSelect={setWorkMode}
                onNext={goNext}
              />
            </motion.div>
          )}

          {step === 4 && (
            <motion.div
              key="step4"
              custom={direction}
              variants={variants}
              initial="enter" animate="center" exit="exit"
              transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
            >
              <Step4Services
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
      <div style={{ padding: '8px 20px 20px', flexShrink: 0 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', margin: 0, lineHeight: 1.2 }}>
          {t.step1Title}
        </h1>
        <p style={{ fontSize: 14, color: THEME.textSecondary, marginTop: 6, marginBottom: 0 }}>
          {t.step1Sub}
        </p>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0 16px',
          paddingBottom: 'calc(24px + env(safe-area-inset-bottom, 0px))',
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {VERTICALS.map(({ key, Icon, label, desc }) => (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(key)}
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
                gap: 10,
                WebkitTapHighlightColor: 'transparent',
                transition: 'transform 0.12s, box-shadow 0.12s, border-color 0.12s',
                minHeight: 104,
              }}
              onPointerDown={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.96)';
                (e.currentTarget as HTMLButtonElement).style.borderColor = THEME.accent;
              }}
              onPointerUp={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
                (e.currentTarget as HTMLButtonElement).style.borderColor = THEME.border;
              }}
              onPointerLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
                (e.currentTarget as HTMLButtonElement).style.borderColor = THEME.border;
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: THEME.accentSoft,
                  color: THEME.accent,
                }}
              >
                <Icon size={22} strokeWidth={2} />
              </span>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: THEME.text, lineHeight: 1.2 }}>
                  {label[lang]}
                </div>
                <div style={{ fontSize: 11, color: THEME.textTertiary, marginTop: 2, lineHeight: 1.3 }}>
                  {desc[lang]}
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
  t,
  vertical,
  selected,
  onSelect,
  onNext,
}: {
  t: (typeof T)[Lang];
  vertical: string | null;
  selected: string | null;
  onSelect: (s: string) => void;
  onNext: () => void;
}) {
  const specs = getSpecializations(vertical);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '8px 20px 20px', flexShrink: 0 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', margin: 0, lineHeight: 1.2 }}>
          {t.step2Title}
        </h1>
        <p style={{ fontSize: 14, color: THEME.textSecondary, marginTop: 6, marginBottom: 0 }}>
          {t.step2Sub}
        </p>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px', paddingBottom: 24 }}>
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
                {isSelected && <Check size={18} color={THEME.accent} strokeWidth={2.5} />}
              </button>
            );
          })}
        </div>
      </div>

      <BottomCta primary={{ label: t.next, onClick: onNext }} secondary={{ label: t.skip, onClick: onNext }} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 3 — Workplace
// ─────────────────────────────────────────────────────────────────────────────
function Step3Workplace({
  t,
  selected,
  onSelect,
  onNext,
}: {
  t: (typeof T)[Lang];
  selected: WorkMode | null;
  onSelect: (m: WorkMode) => void;
  onNext: () => void;
}) {
  const labels: Record<WorkMode, { title: string; sub: string }> = {
    cabinet: { title: t.step3Cabinet, sub: t.step3CabinetSub },
    mobile:  { title: t.step3Mobile,  sub: t.step3MobileSub },
    both:    { title: t.step3Both,    sub: t.step3BothSub },
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '8px 20px 20px', flexShrink: 0 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', margin: 0, lineHeight: 1.2 }}>
          {t.step3Title}
        </h1>
        <p style={{ fontSize: 14, color: THEME.textSecondary, marginTop: 6, marginBottom: 0 }}>
          {t.step3Sub}
        </p>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px', paddingBottom: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {WORKPLACES.map(({ key, Icon }) => {
            const isSelected = selected === key;
            const { title, sub } = labels[key];
            return (
              <button
                key={key}
                type="button"
                onClick={() => onSelect(key)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '16px 16px',
                  borderRadius: R.md,
                  border: `1.5px solid ${isSelected ? THEME.accent : THEME.border}`,
                  background: isSelected ? THEME.accentSoft : THEME.surface,
                  cursor: 'pointer',
                  WebkitTapHighlightColor: 'transparent',
                  transition: 'border-color 0.15s, background 0.15s',
                  textAlign: 'left',
                }}
              >
                <span
                  style={{
                    width: 44, height: 44, borderRadius: 12,
                    background: isSelected ? THEME.accent : THEME.accentSoft,
                    color: isSelected ? '#fff' : THEME.accent,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                    transition: 'background 0.15s, color 0.15s',
                  }}
                >
                  <Icon size={22} strokeWidth={2} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: isSelected ? THEME.accent : THEME.text }}>
                    {title}
                  </div>
                  <div style={{ fontSize: 12, color: THEME.textTertiary, marginTop: 2 }}>
                    {sub}
                  </div>
                </div>
                {isSelected && <Check size={18} color={THEME.accent} strokeWidth={2.5} />}
              </button>
            );
          })}
        </div>
      </div>

      <BottomCta primary={{ label: t.next, onClick: onNext }} secondary={{ label: t.skip, onClick: onNext }} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 4 — Services
// ─────────────────────────────────────────────────────────────────────────────
function Step4Services({
  t,
  services,
  onChange,
  onFinish,
  onSkip,
}: {
  t: (typeof T)[Lang];
  services: ServiceItem[];
  onChange: (s: ServiceItem[]) => void;
  onFinish: () => void;
  onSkip: () => void;
}) {
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
      <div style={{ padding: '8px 20px 16px', flexShrink: 0 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', margin: 0, lineHeight: 1.2 }}>
          {t.step4Title}
        </h1>
        <p style={{ fontSize: 14, color: THEME.textSecondary, marginTop: 6, marginBottom: 0 }}>
          {t.step4Sub}
        </p>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px', paddingBottom: 16 }}>
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
              <button
                type="button"
                onClick={() => toggleService(svc.id)}
                style={{
                  width: 22, height: 22, borderRadius: 6,
                  border: `2px solid ${svc.enabled ? THEME.accent : THEME.border}`,
                  background: svc.enabled ? THEME.accent : 'transparent',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                  transition: 'border-color 0.15s, background 0.15s',
                }}
              >
                {svc.enabled && <Check size={12} color="#fff" strokeWidth={3} />}
              </button>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 14, fontWeight: 600, color: THEME.text,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
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

              <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                {/* type=text + inputMode=numeric → numeric keyboard but no spin arrows */}
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={svc.price === 0 ? '' : svc.price}
                  placeholder="0"
                  onChange={(e) => updatePrice(svc.id, e.target.value)}
                  disabled={!svc.enabled}
                  style={{
                    width: 64, padding: '5px 8px',
                    borderRadius: R.sm,
                    border: `1.5px solid ${THEME.border}`,
                    background: THEME.bgSubtle,
                    color: THEME.text,
                    fontSize: 14, fontWeight: 600,
                    textAlign: 'right', outline: 'none',
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

      <BottomCta
        primary={{ label: t.start, onClick: onFinish }}
        secondary={{ label: t.skipServices, onClick: onSkip }}
      />
    </div>
  );
}

// ─── Shared bottom CTA ───────────────────────────────────────────────────────
function BottomCta({
  primary,
  secondary,
}: {
  primary: { label: string; onClick: () => void };
  secondary?: { label: string; onClick: () => void };
}) {
  return (
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
        onClick={primary.onClick}
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
        {primary.label}
        <ChevronRight size={18} strokeWidth={2.5} />
      </button>
      {secondary && (
        <button
          type="button"
          onClick={secondary.onClick}
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
          {secondary.label}
        </button>
      )}
    </div>
  );
}
