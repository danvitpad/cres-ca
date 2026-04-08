/** --- YAML
 * name: OnboardingDialog
 * description: Multi-step onboarding carousel shown on master's first login
 * --- */

'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  CalendarDays,
  Users,
  Briefcase,
  DollarSign,
  Megaphone,
  ChevronRight,
  ChevronLeft,
  X,
  Sparkles,
} from 'lucide-react';

interface OnboardingSlide {
  id: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  title: string;
  description: string;
}

const SLIDES: OnboardingSlide[] = [
  {
    id: 'welcome',
    icon: Sparkles,
    iconColor: 'text-primary',
    iconBg: 'bg-primary/10',
    title: 'Welcome to CRES-CA!',
    description: 'Your all-in-one CRM platform. Let us show you around — it only takes a minute.',
  },
  {
    id: 'services',
    icon: Briefcase,
    iconColor: 'text-violet-500',
    iconBg: 'bg-violet-500/10',
    title: 'Set up your services',
    description: 'Go to Services to add what you offer — name, duration, and price. Clients will see these when booking.',
  },
  {
    id: 'calendar',
    icon: CalendarDays,
    iconColor: 'text-blue-500',
    iconBg: 'bg-blue-500/10',
    title: 'Manage your calendar',
    description: 'View and manage appointments in day or week mode. Drag to reschedule, click to see details.',
  },
  {
    id: 'clients',
    icon: Users,
    iconColor: 'text-emerald-500',
    iconBg: 'bg-emerald-500/10',
    title: 'Track your clients',
    description: 'Each client gets a personal card with visit history, notes, allergies, and uploaded files.',
  },
  {
    id: 'finance',
    icon: DollarSign,
    iconColor: 'text-amber-500',
    iconBg: 'bg-amber-500/10',
    title: 'Track revenue & expenses',
    description: 'See your earnings, add expenses, and get profit breakdowns by service.',
  },
  {
    id: 'marketing',
    icon: Megaphone,
    iconColor: 'text-pink-500',
    iconBg: 'bg-pink-500/10',
    title: 'Grow your business',
    description: 'Share your invite link, create gift certificates, and join guilds for cross-marketing.',
  },
];

const STORAGE_KEY = 'cres-ca-onboarding-done';

export function OnboardingDialog() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);

  useEffect(() => {
    const done = localStorage.getItem(STORAGE_KEY);
    if (!done) {
      const timer = setTimeout(() => setOpen(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  function handleClose() {
    localStorage.setItem(STORAGE_KEY, 'true');
    setOpen(false);
  }

  function next() {
    if (step === SLIDES.length - 1) {
      handleClose();
    } else {
      setDirection(1);
      setStep((s) => s + 1);
    }
  }

  function prev() {
    if (step > 0) {
      setDirection(-1);
      setStep((s) => s - 1);
    }
  }

  const slide = SLIDES[step];
  const isLast = step === SLIDES.length - 1;
  const progress = ((step + 1) / SLIDES.length) * 100;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        {/* Progress bar */}
        <div className="h-1 bg-muted">
          <motion.div
            className="h-full bg-primary"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 z-10 rounded-full p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <X className="size-4" />
        </button>

        {/* Content */}
        <div className="px-6 pt-8 pb-6">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={slide.id}
              custom={direction}
              initial={{ opacity: 0, x: direction * 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -40 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col items-center text-center"
            >
              <div className={cn('flex size-16 items-center justify-center rounded-2xl mb-5', slide.iconBg)}>
                <slide.icon className={cn('size-8', slide.iconColor)} />
              </div>
              <h3 className="text-lg font-bold tracking-tight mb-2">{slide.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
                {slide.description}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between px-6 pb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={prev}
            disabled={step === 0}
            className="gap-1"
          >
            <ChevronLeft className="size-4" />
            Back
          </Button>

          {/* Dots */}
          <div className="flex gap-1.5">
            {SLIDES.map((_, i) => (
              <button
                key={i}
                onClick={() => { setDirection(i > step ? 1 : -1); setStep(i); }}
                className={cn(
                  'h-1.5 rounded-full transition-all duration-300',
                  i === step ? 'w-6 bg-primary' : 'w-1.5 bg-muted-foreground/20',
                )}
              />
            ))}
          </div>

          <Button size="sm" onClick={next} className="gap-1">
            {isLast ? 'Get Started' : 'Next'}
            {!isLast && <ChevronRight className="size-4" />}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
