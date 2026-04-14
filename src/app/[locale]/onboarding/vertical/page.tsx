/** --- YAML
 * name: OnboardingVerticalSelect
 * description: Post-account-type step — choose industry vertical (beauty/health/auto/tattoo/pets/craft/fitness/events/education/other). Stores choice in query for create-business step.
 * created: 2026-04-13
 * updated: 2026-04-13
 * --- */

'use client';

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
} from 'lucide-react';

interface Vertical {
  key: string;
  title: string;
  sub: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

const VERTICALS: Vertical[] = [
  { key: 'beauty', title: 'Красота', sub: 'Парикмахер, маникюр, брови, SPA', icon: Scissors, color: 'from-rose-500/30 to-pink-500/10' },
  { key: 'health', title: 'Здоровье', sub: 'Массаж, косметолог, стоматолог', icon: Stethoscope, color: 'from-emerald-500/30 to-teal-500/10' },
  { key: 'auto', title: 'Авто', sub: 'СТО, мойка, детейлинг, шиномонтаж', icon: Car, color: 'from-sky-500/30 to-blue-500/10' },
  { key: 'tattoo', title: 'Тату / пирсинг', sub: 'Тату-студия, пирсинг, перманент', icon: Palette, color: 'from-violet-500/30 to-fuchsia-500/10' },
  { key: 'pets', title: 'Питомцы', sub: 'Груминг, ветеринар, хендлинг', icon: PawPrint, color: 'from-amber-500/30 to-orange-500/10' },
  { key: 'craft', title: 'Мастерская', sub: 'Ремонт, реставрация, пошив', icon: Hammer, color: 'from-slate-500/30 to-gray-500/10' },
  { key: 'fitness', title: 'Фитнес', sub: 'Персональные тренировки, йога', icon: Dumbbell, color: 'from-lime-500/30 to-green-500/10' },
  { key: 'events', title: 'Ивенты', sub: 'Ведущий, фото, видео, декор', icon: PartyPopper, color: 'from-yellow-500/30 to-amber-500/10' },
  { key: 'education', title: 'Обучение', sub: 'Репетитор, курсы, тренинги', icon: GraduationCap, color: 'from-indigo-500/30 to-violet-500/10' },
  { key: 'other', title: 'Другое', sub: 'Мой вид услуг не в списке', icon: MoreHorizontal, color: 'from-white/20 to-white/5' },
];

export default function OnboardingVerticalPage() {
  const router = useRouter();

  function pick(key: string) {
    router.push(`/onboarding/create-business?vertical=${key}`);
  }

  return (
    <div className="fixed inset-0 overflow-y-auto bg-background">
      <div className="mx-auto max-w-2xl px-6 py-10 md:py-16">
        <button
          onClick={() => router.back()}
          className="mb-6 flex size-9 items-center justify-center rounded-xl border border-border bg-card hover:bg-muted"
        >
          <ArrowLeft className="size-4" />
        </button>

        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-2xl font-semibold leading-tight tracking-tight md:text-3xl"
        >
          Какой у тебя профиль?
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="mt-2 text-sm text-muted-foreground"
        >
          Подберём популярные услуги, поля анамнеза и шаблоны под твою нишу
        </motion.p>

        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {VERTICALS.map((v, i) => {
            const Icon = v.icon;
            return (
              <motion.button
                key={v.key}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 + i * 0.03 }}
                onClick={() => pick(v.key)}
                className={`group flex items-start gap-4 rounded-2xl border border-border bg-gradient-to-br ${v.color} p-5 text-left transition-all hover:border-primary/40 hover:shadow-md`}
              >
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-background/80 backdrop-blur">
                  <Icon className="size-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">{v.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{v.sub}</p>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
