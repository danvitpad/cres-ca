/** --- YAML
 * name: OnboardingVerticalSelect
 * description: Post-account-type step — choose industry vertical (beauty/health/auto/tattoo/pets/craft/fitness/events/education/other). Stores choice in query for create-business step. Restyled to match the brand (navy + purple accent), matches Fresha-tier visuals.
 * created: 2026-04-13
 * updated: 2026-04-27
 * --- */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Scissors,
  Stethoscope,
  Car,
  Palette,
  PawPrint,
  Hammer,
  Dumbbell,
  PartyPopper,
  GraduationCap,
  MoreHorizontal,
  ArrowLeft,
  Check,
} from 'lucide-react';

interface Vertical {
  key: string;
  title: string;
  sub: string;
  icon: React.ComponentType<{ className?: string }>;
}

const VERTICALS: Vertical[] = [
  { key: 'beauty',    title: 'Красота',         sub: 'Парикмахер, маникюр, брови, SPA',     icon: Scissors },
  { key: 'health',    title: 'Здоровье',        sub: 'Массаж, косметолог, стоматолог',      icon: Stethoscope },
  { key: 'auto',      title: 'Авто',            sub: 'СТО, мойка, детейлинг, шиномонтаж',   icon: Car },
  { key: 'tattoo',    title: 'Тату / пирсинг',  sub: 'Тату-студия, пирсинг, перманент',     icon: Palette },
  { key: 'pets',      title: 'Питомцы',         sub: 'Груминг, ветеринар, хендлинг',        icon: PawPrint },
  { key: 'craft',     title: 'Мастерская',      sub: 'Ремонт, реставрация, пошив',          icon: Hammer },
  { key: 'fitness',   title: 'Фитнес',          sub: 'Персональные тренировки, йога',       icon: Dumbbell },
  { key: 'events',    title: 'Ивенты',          sub: 'Ведущий, фото, видео, декор',         icon: PartyPopper },
  { key: 'education', title: 'Обучение',        sub: 'Репетитор, курсы, тренинги',          icon: GraduationCap },
  { key: 'other',     title: 'Другое',          sub: 'Мой вид услуг не в списке',           icon: MoreHorizontal },
];

export default function OnboardingVerticalPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);

  function pick(key: string) {
    setSelected(key);
    // Лёгкая задержка чтобы пользователь успел увидеть «выбрал» состояние
    setTimeout(() => router.push(`/onboarding/create-business?vertical=${key}`), 220);
  }

  return (
    <div
      className="fixed inset-0 overflow-y-auto"
      style={{
        background:
          'radial-gradient(120% 80% at 50% -10%, rgba(139,92,246,0.10), transparent 60%), #0b0d17',
      }}
    >
      <div className="mx-auto max-w-3xl px-6 py-10 md:py-16">
        {/* Back button — clean ghost icon */}
        <button
          onClick={() => router.back()}
          aria-label="Назад"
          className="mb-8 flex size-10 items-center justify-center rounded-xl transition-colors"
          style={{
            border: '1px solid rgba(139,92,246,0.16)',
            background: '#111425',
            color: '#eae8f4',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#1a1d30'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = '#111425'; }}
        >
          <ArrowLeft className="size-4" />
        </button>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          <h1
            className="text-3xl font-semibold leading-tight tracking-tight md:text-4xl"
            style={{ color: '#eae8f4', letterSpacing: '-0.02em' }}
          >
            Какой у тебя профиль?
          </h1>
          <p
            className="mt-3 text-sm md:text-[15px]"
            style={{ color: '#a8a3be' }}
          >
            Подберём популярные услуги, поля анамнеза и шаблоны под твою нишу
          </p>
        </motion.div>

        <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {VERTICALS.map((v, i) => {
            const Icon = v.icon;
            const isSelected = selected === v.key;
            return (
              <motion.button
                key={v.key}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 + i * 0.03, duration: 0.3 }}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.985 }}
                onClick={() => pick(v.key)}
                disabled={!!selected}
                className="group relative flex items-center gap-4 overflow-hidden rounded-2xl p-5 text-left transition-all"
                style={{
                  background: isSelected ? 'rgba(139,92,246,0.14)' : '#111425',
                  border: `1px solid ${isSelected ? '#8b5cf6' : 'rgba(139,92,246,0.16)'}`,
                  boxShadow: isSelected
                    ? '0 0 0 4px rgba(139,92,246,0.15), 0 8px 24px rgba(139,92,246,0.18)'
                    : 'none',
                  cursor: selected && !isSelected ? 'default' : 'pointer',
                  opacity: selected && !isSelected ? 0.5 : 1,
                }}
                onMouseEnter={(e) => {
                  if (selected) return;
                  e.currentTarget.style.background = '#1a1d30';
                  e.currentTarget.style.borderColor = 'rgba(139,92,246,0.35)';
                }}
                onMouseLeave={(e) => {
                  if (selected) return;
                  e.currentTarget.style.background = '#111425';
                  e.currentTarget.style.borderColor = 'rgba(139,92,246,0.16)';
                }}
              >
                {/* Icon bubble — soft purple */}
                <div
                  className="flex size-12 shrink-0 items-center justify-center rounded-xl transition-colors"
                  style={{
                    background: isSelected ? 'rgba(139,92,246,0.22)' : 'rgba(139,92,246,0.10)',
                    color: isSelected ? '#c4b5fd' : '#a78bfa',
                  }}
                >
                  <Icon className="size-5" />
                </div>

                {/* Text */}
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold" style={{ color: '#eae8f4' }}>
                    {v.title}
                  </p>
                  <p className="mt-1 truncate text-xs" style={{ color: '#a8a3be' }}>
                    {v.sub}
                  </p>
                </div>

                {/* Selected check */}
                {isSelected && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                    className="flex size-7 shrink-0 items-center justify-center rounded-full"
                    style={{ background: '#8b5cf6', color: '#ffffff' }}
                  >
                    <Check className="size-4" />
                  </motion.div>
                )}
              </motion.button>
            );
          })}
        </div>

        {/* Footer hint */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-10 text-center text-xs"
          style={{ color: '#5c5876' }}
        >
          Не переживай — это всегда можно поменять в настройках
        </motion.p>
      </div>
    </div>
  );
}
