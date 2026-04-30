/** --- YAML
 * name: WelcomePage
 * description: Универсальный welcome-экран для нового пользователя (показывается
 *              один раз после регистрации). Контент зависит от роли —
 *              client/master/salon_admin. 4 слайда с иконкой lucide и описанием.
 *              По завершении: POST /api/account/welcome-complete → перенаправление
 *              на основную страницу роли (feed/calendar/dashboard).
 *              Без эмодзи, универсальный текст под любую сферу услуг.
 * created: 2026-04-30
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CalendarCheck, Bell, Sparkles, ShieldCheck,
  Briefcase, Mic, BarChart3, MessagesSquare,
  Users, LayoutGrid, Wallet, ArrowRight,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useLocale } from 'next-intl';
import { createClient } from '@/lib/supabase/client';

type Role = 'client' | 'master' | 'salon_admin';
type Lang = 'ru' | 'uk' | 'en';

interface Slide {
  Icon: LucideIcon;
  title: string;
  body: string;
}

type SlideTemplate = { Icon: LucideIcon; title: Record<Lang, string>; body: Record<Lang, string> };

const SLIDE_TEMPLATES: Record<Role, SlideTemplate[]> = {
  client: [
    { Icon: CalendarCheck,
      title: { ru: 'Запись в один тап', uk: 'Запис в один дотик', en: 'Book in one tap' },
      body: { ru: 'Найдите специалиста, выберите услугу и время — без звонков и переписок.',
              uk: 'Знайдіть спеціаліста, оберіть послугу та час — без дзвінків і переписок.',
              en: 'Find a specialist, pick a service and time — no calls or messages needed.' } },
    { Icon: Bell,
      title: { ru: 'Напоминания и подтверждения', uk: 'Нагадування та підтвердження', en: 'Reminders & confirmations' },
      body: { ru: 'Уведомления о записи, изменениях расписания и предстоящем визите — туда, где вам удобно.',
              uk: 'Сповіщення про запис, зміни розкладу та майбутній візит — туди, де вам зручно.',
              en: 'Notifications about your booking, schedule changes, and upcoming visits — wherever is convenient.' } },
    { Icon: Sparkles,
      title: { ru: 'Бонусы и история', uk: 'Бонуси та історія', en: 'Bonuses & history' },
      body: { ru: 'История посещений, накопительные бонусы и любимые специалисты — всё в одном месте.',
              uk: 'Історія відвідувань, накопичувальні бонуси та улюблені спеціалісти — все в одному місці.',
              en: 'Visit history, loyalty bonuses, and favorite specialists — all in one place.' } },
    { Icon: ShieldCheck,
      title: { ru: 'Контроль над данными', uk: 'Контроль над даними', en: 'Data control' },
      body: { ru: 'Вы решаете, какие сведения видны специалистам. Экспорт и удаление данных — в любой момент.',
              uk: 'Ви вирішуєте, які відомості бачать спеціалісти. Експорт і видалення даних — у будь-який момент.',
              en: 'You decide what specialists can see. Export or delete your data anytime.' } },
  ],
  master: [
    { Icon: CalendarCheck,
      title: { ru: 'Календарь без хаоса', uk: 'Календар без хаосу', en: 'Calendar without chaos' },
      body: { ru: 'Записи, блоки, шаблоны нерабочего времени, групповые слоты — единый календарь под вашу специфику.',
              uk: 'Записи, блоки, шаблони неробочого часу, групові слоти — єдиний календар під вашу специфіку.',
              en: 'Bookings, blocks, time-off templates, group slots — one calendar for your workflow.' } },
    { Icon: Mic,
      title: { ru: 'Голосовой помощник в Telegram', uk: 'Голосовий помічник у Telegram', en: 'Voice assistant in Telegram' },
      body: { ru: 'Создавайте записи, расходы и заметки голосом — прямо из Telegram-бота, без переключения экранов.',
              uk: 'Створюйте записи, витрати та нотатки голосом — прямо з Telegram-бота, без перемикання екранів.',
              en: 'Create bookings, expenses, and notes by voice — right from the Telegram bot.' } },
    { Icon: BarChart3,
      title: { ru: 'Финансы и аналитика', uk: 'Фінанси та аналітика', en: 'Finance & analytics' },
      body: { ru: 'Доходы, расходы, маржа по услугам, прогнозы и персональные подсказки по точкам роста.',
              uk: 'Доходи, витрати, маржа по послугах, прогнози та персональні підказки по точках зростання.',
              en: 'Revenue, expenses, service margins, forecasts, and personal growth tips.' } },
    { Icon: MessagesSquare,
      title: { ru: 'Маркетинг для постоянных клиентов', uk: 'Маркетинг для постійних клієнтів', en: 'Marketing for loyal clients' },
      body: { ru: 'Рассылки, акции, реферальная программа, автоматические напоминания и запросы отзывов.',
              uk: 'Розсилки, акції, реферальна програма, автоматичні нагадування та запити відгуків.',
              en: 'Broadcasts, promos, referral program, automated reminders, and review requests.' } },
  ],
  salon_admin: [
    { Icon: Users,
      title: { ru: 'Команда в одном пространстве', uk: 'Команда в одному просторі', en: 'Team in one space' },
      body: { ru: 'Несколько специалистов под одной учётной записью администратора. Приглашения, заявки, права.',
              uk: 'Кілька спеціалістів під одним обліковим записом адміністратора. Запрошення, заявки, права.',
              en: 'Multiple specialists under one admin account. Invitations, requests, permissions.' } },
    { Icon: LayoutGrid,
      title: { ru: 'Свободный или единый каталог', uk: 'Вільний або єдиний каталог', en: 'Flexible or unified catalog' },
      body: { ru: 'Каждый специалист задаёт свои цены — или администратор формирует общий каталог услуг.',
              uk: 'Кожен спеціаліст задає свої ціни — або адміністратор формує спільний каталог послуг.',
              en: 'Each specialist sets their own prices — or the admin creates a shared service catalog.' } },
    { Icon: Wallet,
      title: { ru: 'Расчёты и комиссии', uk: 'Розрахунки та комісії', en: 'Payouts & commissions' },
      body: { ru: 'Учёт выплат специалистам, комиссионная модель, прозрачные финансы команды.',
              uk: 'Облік виплат спеціалістам, комісійна модель, прозорі фінанси команди.',
              en: 'Track payouts, commission model, transparent team finances.' } },
    { Icon: BarChart3,
      title: { ru: 'Маркетинг от лица команды', uk: 'Маркетинг від імені команди', en: 'Team-level marketing' },
      body: { ru: 'Единые рассылки клиентам всей команды, акции по всем специалистам сразу, общий рейтинг.',
              uk: 'Єдині розсилки клієнтам усієї команди, акції по всіх спеціалістах одразу, спільний рейтинг.',
              en: 'Unified broadcasts, promos across all specialists, shared rating.' } },
  ],
};

function buildSlides(role: Role, lang: Lang): Slide[] {
  return SLIDE_TEMPLATES[role].map(t => ({
    Icon: t.Icon,
    title: t.title[lang] ?? t.title.ru,
    body: t.body[lang] ?? t.body.ru,
  }));
}

const NEXT_BY_ROLE: Record<Role, string> = {
  client: '/feed',
  master: '/calendar',
  salon_admin: '/calendar',
};

const UI_TEXT: Record<Lang, { skip: string; next: string; start: string; finishing: string }> = {
  ru: { skip: 'Пропустить', next: 'Дальше', start: 'Начать', finishing: 'Готово…' },
  uk: { skip: 'Пропустити', next: 'Далі', start: 'Почати', finishing: 'Готово…' },
  en: { skip: 'Skip', next: 'Next', start: 'Get started', finishing: 'Done…' },
};

export default function WelcomePage() {
  const router = useRouter();
  const rawLocale = useLocale();
  const lang = (['ru', 'uk', 'en'].includes(rawLocale) ? rawLocale : 'ru') as Lang;
  const ui = UI_TEXT[lang];
  const [role, setRole] = useState<Role | null>(null);
  const [step, setStep] = useState(0);
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/login'); return; }
      const { data } = await supabase
        .from('profiles')
        .select('role, welcome_seen')
        .eq('id', user.id)
        .maybeSingle();
      if ((data as { welcome_seen?: boolean } | null)?.welcome_seen) {
        // Уже видел — не показываем повторно
        router.replace(NEXT_BY_ROLE[((data as { role?: Role } | null)?.role ?? 'client')]);
        return;
      }
      setRole(((data as { role?: Role } | null)?.role ?? 'client'));
    })();
  }, [router]);

  if (!role) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafafa' }}>
        <div style={{ width: 32, height: 32, border: '3px solid #ccc', borderTopColor: '#0d9488', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const slides = buildSlides(role, lang);
  const slide = slides[step];
  const isLast = step === slides.length - 1;
  const next = NEXT_BY_ROLE[role];

  async function finish() {
    if (finishing) return;
    setFinishing(true);
    try {
      await fetch('/api/account/welcome-complete', { method: 'POST' });
    } catch {
      // best-effort: даже если API упадёт — всё равно идём на основную страницу
    }
    router.replace(next);
  }

  function nextStep() {
    if (isLast) { finish(); return; }
    setStep((s) => s + 1);
  }

  function skip() {
    finish();
  }

  const Icon = slide.Icon;

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(180deg, #f0fdfa 0%, #ffffff 60%)',
        fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
        padding: 'clamp(20px, 4vw, 48px) clamp(20px, 5vw, 64px)',
      }}
    >
      {/* Top bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontWeight: 800, letterSpacing: '-0.025em', fontSize: 16, color: '#0f172a' }}>CRES-CA</div>
        <button
          type="button"
          onClick={skip}
          disabled={finishing}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#64748b', fontSize: 13, fontWeight: 500,
          }}
        >
          {ui.skip}
        </button>
      </div>

      {/* Slide content */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: 520 }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 24, alignItems: 'center' }}
            >
              <div
                style={{
                  width: 96, height: 96, borderRadius: 28,
                  background: 'linear-gradient(135deg, #0d9488 0%, #14b8a6 100%)',
                  color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 12px 32px rgba(13, 148, 136, 0.35)',
                }}
              >
                <Icon size={44} strokeWidth={1.8} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <h1 style={{
                  fontSize: 'clamp(22px, 3.2vw, 32px)',
                  fontWeight: 700,
                  letterSpacing: '-0.025em',
                  color: '#0f172a',
                  margin: 0,
                  lineHeight: 1.2,
                }}>
                  {slide.title}
                </h1>
                <p style={{
                  fontSize: 'clamp(14px, 1.6vw, 16px)',
                  color: '#475569',
                  lineHeight: 1.55,
                  margin: 0,
                  maxWidth: 460,
                }}>
                  {slide.body}
                </p>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Footer: dots + next button */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {slides.map((_, i) => (
            <div
              key={i}
              style={{
                width: i === step ? 24 : 8, height: 8, borderRadius: 4,
                background: i === step ? '#0d9488' : '#cbd5e1',
                transition: 'all 0.25s ease',
              }}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={nextStep}
          disabled={finishing}
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            minWidth: 200, height: 50, borderRadius: 14,
            background: 'linear-gradient(135deg, #0d9488 0%, #14b8a6 100%)',
            color: '#fff', border: 'none', cursor: finishing ? 'wait' : 'pointer',
            fontSize: 15, fontWeight: 600,
            boxShadow: '0 8px 24px rgba(13, 148, 136, 0.35)',
            opacity: finishing ? 0.6 : 1,
            transition: 'opacity 0.15s',
            fontFamily: 'inherit',
          }}
        >
          {finishing ? ui.finishing : isLast ? ui.start : ui.next}
          {!finishing && <ArrowRight size={16} strokeWidth={2.4} />}
        </button>
      </div>
    </div>
  );
}

void Briefcase;
