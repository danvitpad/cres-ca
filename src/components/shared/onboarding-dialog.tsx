/** --- YAML
 * name: OnboardingDialog
 * description: Interactive 5-step onboarding wizard for new masters.
 *              Step 1: pick vertical (10 industries).
 *              Step 2: bulk-insert template services for that vertical.
 *              Step 3: quick-pick working hours preset.
 *              Step 4: share invite link (web + Telegram + QR).
 *              Step 5: done → close and go to dashboard.
 *              Trigger: opens when master.vertical IS NULL (not localStorage).
 * created: 2026-04-17
 * updated: 2026-04-17
 * --- */

'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  ChevronRight, ChevronLeft, Sparkles, Check,
  Loader2, Copy, Send, Clock, Share2, PartyPopper,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';
import {
  DEFAULT_SERVICES, type VerticalKey, type DefaultService,
} from '@/lib/verticals/default-services';

type StepId = 'vertical' | 'services' | 'hours' | 'invite' | 'done';
const STEPS: StepId[] = ['vertical', 'services', 'hours', 'invite', 'done'];

/* ─── Vertical metadata ─── */
const VERTICAL_OPTIONS: { key: VerticalKey; label: string; icon: string; hint: string }[] = [
  { key: 'beauty',    label: 'Красота / волосы',   icon: '💇',  hint: 'Парикмахер, ногти, брови' },
  { key: 'health',    label: 'Здоровье / мед.',    icon: '🩺',  hint: 'Врач, массаж, психолог' },
  { key: 'auto',      label: 'Авто / сантехник',   icon: '🔧',  hint: 'СТО, мойка, ремонт' },
  { key: 'tattoo',    label: 'Тату / пирсинг',     icon: '🎨',  hint: 'Тату, ПМ, пирсинг' },
  { key: 'pets',      label: 'Животные',           icon: '🐾',  hint: 'Груминг, ветеринар' },
  { key: 'craft',     label: 'Ремесло / ателье',   icon: '🔨',  hint: 'Пошив, ремонт вещей' },
  { key: 'fitness',   label: 'Фитнес / йога',      icon: '🧘',  hint: 'Тренер, йога, растяжка' },
  { key: 'events',    label: 'Фото / event',       icon: '📷',  hint: 'Фото, ведущий, DJ' },
  { key: 'education', label: 'Обучение',           icon: '📚',  hint: 'Репетитор, коуч' },
  { key: 'other',     label: 'Другое',             icon: '➕',  hint: 'Настрою сам' },
];

/* ─── Working-hours presets ─── */
type HoursPreset = 'weekdays' | 'six_days' | 'every_day' | 'custom';
type WorkingHours = Record<string, { start: string; end: string } | null>;

const PRESETS: Record<HoursPreset, { label: string; desc: string; hours: WorkingHours } | null> = {
  weekdays: {
    label: 'Пн–Пт, 9:00–18:00',
    desc: 'Стандартная рабочая неделя',
    hours: {
      monday:    { start: '09:00', end: '18:00' },
      tuesday:   { start: '09:00', end: '18:00' },
      wednesday: { start: '09:00', end: '18:00' },
      thursday:  { start: '09:00', end: '18:00' },
      friday:    { start: '09:00', end: '18:00' },
      saturday: null, sunday: null,
    },
  },
  six_days: {
    label: 'Пн–Сб, 10:00–20:00',
    desc: 'Выходной — воскресенье',
    hours: {
      monday:    { start: '10:00', end: '20:00' },
      tuesday:   { start: '10:00', end: '20:00' },
      wednesday: { start: '10:00', end: '20:00' },
      thursday:  { start: '10:00', end: '20:00' },
      friday:    { start: '10:00', end: '20:00' },
      saturday:  { start: '10:00', end: '20:00' },
      sunday: null,
    },
  },
  every_day: {
    label: 'Ежедневно, 10:00–22:00',
    desc: 'Без выходных',
    hours: {
      monday:    { start: '10:00', end: '22:00' },
      tuesday:   { start: '10:00', end: '22:00' },
      wednesday: { start: '10:00', end: '22:00' },
      thursday:  { start: '10:00', end: '22:00' },
      friday:    { start: '10:00', end: '22:00' },
      saturday:  { start: '10:00', end: '22:00' },
      sunday:    { start: '10:00', end: '22:00' },
    },
  },
  custom: null,
};

export function OnboardingDialog() {
  const { master, refetch } = useMaster();
  const [open, setOpen] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [direction, setDirection] = useState(1);

  // Step state
  const [vertical, setVertical] = useState<VerticalKey | null>(null);
  const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set());
  const [hoursPreset, setHoursPreset] = useState<HoursPreset>('weekdays');
  const [saving, setSaving] = useState(false);

  /* ─── Auto-open when master has no vertical yet ─── */
  useEffect(() => {
    if (!master) return;
    if (!master.vertical) {
      const t = setTimeout(() => setOpen(true), 600);
      return () => clearTimeout(t);
    }
  }, [master]);

  /* ─── Auto-select all template services when vertical changes ─── */
  const templateServices: DefaultService[] = useMemo(
    () => (vertical ? DEFAULT_SERVICES[vertical] ?? [] : []),
    [vertical],
  );
  useEffect(() => {
    setSelectedServices(new Set(templateServices.map(s => s.name)));
  }, [templateServices]);

  const currentStep = STEPS[stepIdx];
  const progress = ((stepIdx + 1) / STEPS.length) * 100;

  function goNext() { setDirection(1); setStepIdx(i => Math.min(STEPS.length - 1, i + 1)); }
  function goPrev() { setDirection(-1); setStepIdx(i => Math.max(0, i - 1)); }

  /* ─── Persist actions ─── */
  async function saveVertical() {
    if (!vertical || !master?.id) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from('masters')
      .update({ vertical })
      .eq('id', master.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    goNext();
  }

  async function saveServices() {
    if (!master?.id) { goNext(); return; }
    const toInsert = templateServices.filter(s => selectedServices.has(s.name));
    if (toInsert.length === 0) { goNext(); return; }
    setSaving(true);
    const supabase = createClient();
    // Note: pricing_model is template-only metadata — services table doesn't store it
    const rows = toInsert.map(s => ({
      master_id: master.id,
      name: s.name,
      duration_minutes: s.duration_minutes,
      price: s.price,
      // currency defaults to 'UAH' in schema; is_active defaults to true
    }));
    const { error } = await supabase.from('services').insert(rows);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Добавлено услуг: ${toInsert.length}`);
    goNext();
  }

  async function saveHours() {
    if (!master?.id) { goNext(); return; }
    const preset = PRESETS[hoursPreset];
    if (!preset) { goNext(); return; }
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from('masters')
      .update({ working_hours: preset.hours })
      .eq('id', master.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    goNext();
  }

  function handleFinish() {
    refetch?.();
    setOpen(false);
  }

  /* ─── Invite link ─── */
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://cres-ca.com';
  const webLink = master?.invite_code ? `${appUrl}/invite/${master.invite_code}` : '';
  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT ?? 'cres_ca_bot';
  const tgLink = master?.invite_code ? `https://t.me/${botUsername}?start=master_${master.invite_code}` : '';

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Скопировано');
    } catch {
      toast.error('Не удалось скопировать');
    }
  }

  /* ─── Navigation validity ─── */
  const canProceed: Record<StepId, boolean> = {
    vertical: vertical !== null,
    services: true,
    hours: true,
    invite: true,
    done: true,
  };

  async function onPrimary() {
    if (saving) return;
    if (currentStep === 'vertical') return saveVertical();
    if (currentStep === 'services') return saveServices();
    if (currentStep === 'hours')    return saveHours();
    if (currentStep === 'invite')   return goNext();
    if (currentStep === 'done')     return handleFinish();
  }

  const isFirst = stepIdx === 0;
  const primaryLabel =
    currentStep === 'done' ? 'Начать работу'
    : currentStep === 'invite' ? 'Почти готово'
    : 'Далее';

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        // Allow closing only from final step, or if vertical already set elsewhere
        if (!v && currentStep !== 'done' && !master?.vertical) return;
        setOpen(v);
      }}
    >
      <DialogContent
        className="p-0 overflow-hidden sm:max-w-lg gap-0"
      >
        {/* Progress bar */}
        <div className="h-1 bg-muted shrink-0">
          <motion.div
            className="h-full bg-gradient-to-r from-violet-500 to-purple-500"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
          />
        </div>

        {/* Step content */}
        <div className="px-6 pt-7 pb-4 min-h-[360px]">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: direction * 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -30 }}
              transition={{ duration: 0.22 }}
            >
              {/* Step 1: Vertical */}
              {currentStep === 'vertical' && (
                <>
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles className="size-5 text-primary" />
                    <h3 className="text-lg font-bold tracking-tight">Добро пожаловать!</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-5">
                    Выберите свою сферу — подберу шаблоны услуг и настройки под вас.
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {VERTICAL_OPTIONS.map(v => {
                      const active = vertical === v.key;
                      return (
                        <button
                          key={v.key}
                          onClick={() => setVertical(v.key)}
                          className={cn(
                            'flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 transition-all text-center',
                            active
                              ? 'border-primary bg-primary/5 shadow-sm'
                              : 'border-border hover:border-primary/40 hover:bg-muted/50',
                          )}
                        >
                          <span className="text-2xl">{v.icon}</span>
                          <span className="text-xs font-semibold leading-tight">{v.label}</span>
                          <span className="text-[10px] text-muted-foreground leading-tight">{v.hint}</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {/* Step 2: Services */}
              {currentStep === 'services' && (
                <>
                  <div className="flex items-center gap-2 mb-1">
                    <Check className="size-5 text-primary" />
                    <h3 className="text-lg font-bold tracking-tight">Шаблоны услуг</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Отметьте подходящие — добавлю в каталог. Цены и длительность всегда можно поменять.
                  </p>
                  <div className="flex items-center justify-between mb-2 text-xs">
                    <span className="text-muted-foreground">
                      Выбрано: <b className="text-foreground">{selectedServices.size}</b> из {templateServices.length}
                    </span>
                    <button
                      onClick={() =>
                        setSelectedServices(
                          selectedServices.size === templateServices.length
                            ? new Set()
                            : new Set(templateServices.map(s => s.name))
                        )
                      }
                      className="text-primary font-medium hover:underline"
                    >
                      {selectedServices.size === templateServices.length ? 'Снять все' : 'Выбрать все'}
                    </button>
                  </div>
                  <div className="max-h-[280px] overflow-y-auto rounded-lg border border-border divide-y">
                    {templateServices.length === 0 && (
                      <p className="p-4 text-sm text-muted-foreground text-center">
                        Нет шаблонов — добавите услуги сами в «Каталоге»
                      </p>
                    )}
                    {templateServices.map(s => {
                      const checked = selectedServices.has(s.name);
                      return (
                        <label
                          key={s.name}
                          className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => {
                              setSelectedServices(prev => {
                                const next = new Set(prev);
                                if (v) next.add(s.name); else next.delete(s.name);
                                return next;
                              });
                            }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{s.name}</div>
                            <div className="text-[11px] text-muted-foreground">
                              {s.duration_minutes} мин · {s.price > 0 ? `${s.price} ₴` : 'по запросу'}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </>
              )}

              {/* Step 3: Hours */}
              {currentStep === 'hours' && (
                <>
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="size-5 text-primary" />
                    <h3 className="text-lg font-bold tracking-tight">Рабочие часы</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-5">
                    Быстрый пресет — тонко настроите позже в разделе Календарь → Настройки.
                  </p>
                  <div className="space-y-2">
                    {(Object.keys(PRESETS) as HoursPreset[])
                      .filter(k => k !== 'custom')
                      .map(key => {
                        const preset = PRESETS[key]!;
                        const active = hoursPreset === key;
                        return (
                          <button
                            key={key}
                            onClick={() => setHoursPreset(key)}
                            className={cn(
                              'w-full flex items-start gap-3 rounded-xl border-2 p-4 transition-all text-left',
                              active
                                ? 'border-primary bg-primary/5 shadow-sm'
                                : 'border-border hover:border-primary/40 hover:bg-muted/50',
                            )}
                          >
                            <div
                              className={cn(
                                'mt-0.5 size-4 rounded-full border-2 flex items-center justify-center shrink-0',
                                active ? 'border-primary' : 'border-border',
                              )}
                            >
                              {active && <div className="size-2 rounded-full bg-primary" />}
                            </div>
                            <div className="flex-1">
                              <div className="text-sm font-semibold">{preset.label}</div>
                              <div className="text-xs text-muted-foreground mt-0.5">{preset.desc}</div>
                            </div>
                          </button>
                        );
                      })}
                    <button
                      onClick={() => setHoursPreset('custom')}
                      className={cn(
                        'w-full flex items-start gap-3 rounded-xl border-2 p-4 transition-all text-left',
                        hoursPreset === 'custom'
                          ? 'border-primary bg-primary/5 shadow-sm'
                          : 'border-border hover:border-primary/40 hover:bg-muted/50',
                      )}
                    >
                      <div
                        className={cn(
                          'mt-0.5 size-4 rounded-full border-2 flex items-center justify-center shrink-0',
                          hoursPreset === 'custom' ? 'border-primary' : 'border-border',
                        )}
                      >
                        {hoursPreset === 'custom' && <div className="size-2 rounded-full bg-primary" />}
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-semibold">Настрою сам</div>
                        <div className="text-xs text-muted-foreground mt-0.5">Пропустить этот шаг</div>
                      </div>
                    </button>
                  </div>
                </>
              )}

              {/* Step 4: Invite */}
              {currentStep === 'invite' && (
                <>
                  <div className="flex items-center gap-2 mb-1">
                    <Share2 className="size-5 text-primary" />
                    <h3 className="text-lg font-bold tracking-tight">Пригласите клиентов</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-5">
                    Отправьте ссылку клиентам — они смогут записываться онлайн и видеть вашу страницу.
                  </p>

                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Ссылка на сайт
                      </Label>
                      <div className="flex gap-2">
                        <code className="flex-1 rounded-lg bg-muted px-3 py-2 text-xs font-mono truncate">
                          {webLink || 'Ссылка загружается…'}
                        </code>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copy(webLink)}
                          disabled={!webLink}
                          className="shrink-0"
                        >
                          <Copy className="size-3.5" />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Через Telegram-бот
                      </Label>
                      <div className="flex gap-2">
                        <code className="flex-1 rounded-lg bg-muted px-3 py-2 text-xs font-mono truncate">
                          {tgLink || 'Ссылка загружается…'}
                        </code>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copy(tgLink)}
                          disabled={!tgLink}
                          className="shrink-0"
                        >
                          <Send className="size-3.5" />
                        </Button>
                      </div>
                    </div>

                    <div className="mt-4 rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground flex items-start gap-2">
                      <Sparkles className="size-3.5 text-primary mt-0.5 shrink-0" />
                      <span>
                        Эти ссылки всегда доступны в <b>Настройках → Приглашение</b>. Можно добавить в Instagram bio или визитку.
                      </span>
                    </div>
                  </div>
                </>
              )}

              {/* Step 5: Done */}
              {currentStep === 'done' && (
                <div className="flex flex-col items-center text-center py-4">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                    className="mb-5 size-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center"
                  >
                    <PartyPopper className="size-8 text-white" />
                  </motion.div>
                  <h3 className="text-xl font-bold tracking-tight mb-2">Всё готово!</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed max-w-sm">
                    Ваш CRM настроен. Добавляйте клиентов, управляйте записями, принимайте онлайн-брони.
                  </p>
                  <div className="mt-5 grid grid-cols-3 gap-2 w-full text-[11px]">
                    <div className="rounded-lg bg-muted p-2">
                      <div className="font-semibold">Услуги</div>
                      <div className="text-muted-foreground mt-0.5">{selectedServices.size} добавлено</div>
                    </div>
                    <div className="rounded-lg bg-muted p-2">
                      <div className="font-semibold">Часы</div>
                      <div className="text-muted-foreground mt-0.5">
                        {hoursPreset === 'custom' ? 'Настрою сам' : 'Настроены'}
                      </div>
                    </div>
                    <div className="rounded-lg bg-muted p-2">
                      <div className="font-semibold">Ссылка</div>
                      <div className="text-muted-foreground mt-0.5">Готова</div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Step indicator + nav */}
        <div className="flex items-center justify-between gap-3 px-6 pb-5 pt-2 border-t">
          <Button
            variant="ghost"
            size="sm"
            onClick={goPrev}
            disabled={isFirst || saving}
            className="gap-1"
          >
            <ChevronLeft className="size-4" />
            Назад
          </Button>

          <div className="flex gap-1.5">
            {STEPS.map((s, i) => (
              <div
                key={s}
                className={cn(
                  'h-1.5 rounded-full transition-all duration-300',
                  i === stepIdx ? 'w-6 bg-primary' : i < stepIdx ? 'w-1.5 bg-primary/60' : 'w-1.5 bg-muted-foreground/20',
                )}
              />
            ))}
          </div>

          <Button
            size="sm"
            onClick={onPrimary}
            disabled={saving || !canProceed[currentStep]}
            className="gap-1 min-w-[120px]"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : (
              <>
                {primaryLabel}
                {currentStep !== 'done' && <ChevronRight className="size-4" />}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
