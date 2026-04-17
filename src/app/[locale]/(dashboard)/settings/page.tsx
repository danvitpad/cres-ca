/** --- YAML
 * name: Settings Page
 * description: Master/salon settings — profile info, working hours, subscription, invite links
 * --- */

'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';
import { useAuthStore } from '@/stores/auth-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Copy,
  Check,
  UserCircle,
  CalendarClock,
  CreditCard,
  LinkIcon,
  Shield,
  ChevronLeft,
  BellRing,
  Layers,
  KeyRound,
  Briefcase,
} from 'lucide-react';
import { DEFAULT_FEATURES, type VerticalFeatures } from '@/lib/verticals/feature-flags';
import type { VerticalKey } from '@/lib/verticals/default-services';
import { useFeatures } from '@/hooks/use-features';
import { motion } from 'framer-motion';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

type WorkingDay = { start: string; end: string; break_start?: string; break_end?: string } | null;
type WorkingHours = Record<string, WorkingDay>;

export default function SettingsPage() {
  const t = useTranslations('profile');
  const tc = useTranslations('common');
  const { master, loading, refetch } = useMaster();
  const { userId } = useAuthStore();
  const searchParams = useSearchParams();
  const [activeSection, setActiveSection] = useState<string | null>(null);

  // Sync with URL ?section=... (deep-link from header dropdown)
  useEffect(() => {
    const s = searchParams.get('section');
    if (s) setActiveSection(s);
  }, [searchParams]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!master) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">{t('editProfile')}</h2>
        <p className="text-muted-foreground">{tc('error')}</p>
      </div>
    );
  }

  const settingSections = [
    { key: 'profile', icon: UserCircle, title: t('editProfile'), desc: t('profileDesc') || t('editProfile') },
    { key: 'vertical', icon: Briefcase, title: 'Моя сфера', desc: 'Индустрия и шаблоны услуг' },
    { key: 'features', icon: Layers, title: 'Модули', desc: 'Что включено в дашборде' },
    { key: 'hours', icon: CalendarClock, title: t('workingHours'), desc: t('hoursDesc') || t('workingHours') },
    { key: 'security', icon: KeyRound, title: 'Безопасность', desc: 'Email, пароль, телефон' },
    { key: 'subscription', icon: CreditCard, title: t('subscription'), desc: t('subscriptionDesc') || t('subscription') },
    { key: 'invite', icon: LinkIcon, title: t('inviteLink'), desc: t('inviteDesc') || t('inviteLink') },
    { key: 'policies', icon: Shield, title: t('policies'), desc: t('policiesDesc') || t('policies') },
    { key: 'notifications', icon: BellRing, title: 'Уведомления', desc: 'Напоминания на сайте и в Telegram' },
  ];

  if (activeSection) {
    return (
      <div className="space-y-5" style={{ padding: '32px 40px', maxWidth: 1024 }}>
        <button
          onClick={() => setActiveSection(null)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          {t('editProfile')}
        </button>
        {activeSection === 'profile' && <ProfileTab master={master} userId={userId!} onSaved={refetch} />}
        {activeSection === 'vertical' && <VerticalTab master={master} onSaved={refetch} />}
        {activeSection === 'features' && <FeaturesTab master={master} onSaved={refetch} />}
        {activeSection === 'hours' && <WorkingHoursTab master={master} onSaved={refetch} />}
        {activeSection === 'security' && <SecurityTab />}
        {activeSection === 'subscription' && <SubscriptionTab />}
        {activeSection === 'invite' && <InviteLinkTab master={master} />}
        {activeSection === 'policies' && <PoliciesTab master={master} onSaved={refetch} />}
        {activeSection === 'notifications' && <NotificationsTab master={master} onSaved={refetch} />}
      </div>
    );
  }

  return (
    <div className="space-y-5" style={{ padding: '32px 40px', maxWidth: 1024 }}>
      <div>
        <h2 className="text-xl font-bold">{t('editProfile')}</h2>
        <p className="text-sm text-muted-foreground mt-0.5">{t('settingsDesc') || t('editProfile')}</p>
      </div>

      {/* Fresha-style card grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {settingSections.map((section, i) => {
          const Icon = section.icon;
          return (
            <motion.button
              key={section.key}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => setActiveSection(section.key)}
              className="flex flex-col items-start gap-3 rounded-2xl border bg-card p-5 text-left shadow-sm transition-all hover:shadow-md hover:border-primary/20 hover:-translate-y-0.5 group"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">{section.title}</h3>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{section.desc}</p>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

function ProfileTab({ master, userId, onSaved }: { master: NonNullable<ReturnType<typeof useMaster>['master']>; userId: string; onSaved: () => void }) {
  const t = useTranslations('profile');
  const tc = useTranslations('common');
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState(master.profile.full_name);
  const [phone, setPhone] = useState(master.profile.phone ?? '');
  const [specialization, setSpecialization] = useState(master.specialization ?? '');
  const [bio, setBio] = useState(master.bio ?? '');
  const [address, setAddress] = useState(master.address ?? '');
  const [city, setCity] = useState(master.city ?? '');

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();

    const [profileRes, masterRes] = await Promise.all([
      supabase.from('profiles').update({ full_name: fullName, phone: phone || null }).eq('id', userId),
      supabase.from('masters').update({ specialization, bio, address, city }).eq('id', master.id),
    ]);

    setSaving(false);
    if (profileRes.error || masterRes.error) {
      toast.error(profileRes.error?.message || masterRes.error?.message || tc('error'));
    } else {
      toast.success(t('profileSaved'));
      onSaved();
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle>{t('editProfile')}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{t('specialization')}</Label>
            <Input value={specialization} onChange={(e) => setSpecialization(e.target.value)} placeholder={t('specializationPlaceholder')} />
          </div>
          <div className="space-y-2">
            <Label>{t('city')}</Label>
            <Input value={city} onChange={(e) => setCity(e.target.value)} required />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{t('address')}</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{t('bio')}</Label>
            <Textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{t('fullName')}</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>{t('phone')}</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" />
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving}>
          {saving ? tc('loading') : tc('save')}
        </Button>
      </CardContent>
    </Card>
  );
}

function WorkingHoursTab({ master, onSaved }: { master: NonNullable<ReturnType<typeof useMaster>['master']>; onSaved: () => void }) {
  const t = useTranslations('profile');
  const tc = useTranslations('common');
  const [saving, setSaving] = useState(false);
  const [hours, setHours] = useState<WorkingHours>(master.working_hours || {});
  const [bufferMin, setBufferMin] = useState<number>(((master as unknown) as { long_visit_buffer_minutes: number | null }).long_visit_buffer_minutes ?? 0);
  const [bufferThreshold, setBufferThreshold] = useState<number>(((master as unknown) as { long_visit_threshold_minutes: number | null }).long_visit_threshold_minutes ?? 120);

  function toggleDay(day: string, enabled: boolean) {
    setHours((prev) => ({
      ...prev,
      [day]: enabled ? { start: '09:00', end: '18:00' } : null,
    }));
  }

  function updateDay(day: string, field: keyof NonNullable<WorkingDay>, value: string) {
    setHours((prev) => {
      const current = prev[day];
      if (!current) return prev;
      return { ...prev, [day]: { ...current, [field]: value } };
    });
  }

  function applyBreakToAll(sourceDay: string) {
    setHours((prev) => {
      const src = prev[sourceDay];
      if (!src?.break_start || !src?.break_end) {
        toast.error('Сначала задай обед в выбранном дне');
        return prev;
      }
      const next: WorkingHours = { ...prev };
      for (const d of DAYS) {
        const cur = next[d];
        if (cur) next[d] = { ...cur, break_start: src.break_start, break_end: src.break_end };
      }
      toast.success('Обед применён ко всем рабочим дням');
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from('masters')
      .update({
        working_hours: hours,
        long_visit_buffer_minutes: bufferMin,
        long_visit_threshold_minutes: bufferThreshold,
      })
      .eq('id', master.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success(t('hoursSaved')); onSaved(); }
  }

  return (
    <Card>
      <CardHeader><CardTitle>{t('workingHours')}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {DAYS.map((day) => {
          const dayData = hours[day];
          const isActive = dayData !== null && dayData !== undefined;
          return (
            <div key={day} className="flex flex-wrap items-center gap-3 py-2 border-b last:border-0">
              <div className="w-28 font-medium text-sm">{t(day)}</div>
              <Switch checked={isActive} onCheckedChange={(v) => toggleDay(day, v)} />
              {isActive && dayData && (
                <div className="flex flex-wrap gap-2 text-sm">
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground">{t('start')}</span>
                    <Input type="time" value={dayData.start} onChange={(e) => updateDay(day, 'start', e.target.value)} className="w-28 h-8" />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground">{t('end')}</span>
                    <Input type="time" value={dayData.end} onChange={(e) => updateDay(day, 'end', e.target.value)} className="w-28 h-8" />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground">{t('breakStart')}</span>
                    <Input type="time" value={dayData.break_start ?? ''} onChange={(e) => updateDay(day, 'break_start', e.target.value)} className="w-28 h-8" />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground">{t('breakEnd')}</span>
                    <Input type="time" value={dayData.break_end ?? ''} onChange={(e) => updateDay(day, 'break_end', e.target.value)} className="w-28 h-8" />
                  </div>
                </div>
              )}
              {!isActive && <span className="text-sm text-muted-foreground">{t('dayOff')}</span>}
            </div>
          );
        })}
        <div className="rounded-md border p-4 space-y-2">
          <div className="text-sm font-semibold">Обеденный перерыв · применить ко всем дням</div>
          <p className="text-xs text-muted-foreground">
            Задай «обед» в одном дне, затем скопируй его в остальные рабочие дни одной кнопкой. Календарь автоматически блокирует это время.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {DAYS.filter((d) => hours[d]?.break_start && hours[d]?.break_end).map((d) => (
              <Button key={d} size="sm" variant="outline" onClick={() => applyBreakToAll(d)}>
                Применить {t(d)} ({hours[d]?.break_start}–{hours[d]?.break_end})
              </Button>
            ))}
            {!DAYS.some((d) => hours[d]?.break_start && hours[d]?.break_end) && (
              <span className="text-xs text-muted-foreground">Задай обед хотя бы в одном дне, затем появится кнопка копирования.</span>
            )}
          </div>
        </div>
        <div className="rounded-md border p-4 space-y-3">
          <div className="text-sm font-semibold">Smart scheduling · буфер после длинных визитов</div>
          <p className="text-xs text-muted-foreground">
            Если визит длиннее порога, следующий слот не откроется сразу — оставляем буфер на отдых/уборку.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Буфер (мин)</div>
              <Input type="number" min={0} max={120} value={bufferMin} onChange={(e) => setBufferMin(Number(e.target.value) || 0)} />
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Порог длительности (мин)</div>
              <Input type="number" min={30} max={480} value={bufferThreshold} onChange={(e) => setBufferThreshold(Number(e.target.value) || 120)} />
            </div>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? tc('loading') : tc('save')}
        </Button>
      </CardContent>
    </Card>
  );
}

function SubscriptionTab() {
  const t = useTranslations('profile');
  const { tier } = useAuthStore();

  return (
    <Card>
      <CardHeader><CardTitle>{t('subscription')}</CardTitle></CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          {t('currentPlan')}: <span className="font-semibold text-foreground capitalize">{tier}</span>
        </p>
        <Button variant="outline" className="mt-4">{t('changePlan')}</Button>
      </CardContent>
    </Card>
  );
}

function InviteLinkTab({ master }: { master: NonNullable<ReturnType<typeof useMaster>['master']> }) {
  const t = useTranslations('profile');
  const [copied, setCopied] = useState<string | null>(null);
  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? 'CresCABot';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://cres-ca.com';

  const webLink = `${appUrl}/invite/${master.invite_code}`;
  const telegramLink = `https://t.me/${botUsername}?start=master_${master.invite_code}`;

  async function copyToClipboard(text: string, key: string) {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <Card>
      <CardHeader><CardTitle>{t('inviteLink')}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>{t('inviteCode')}</Label>
          <code className="block rounded bg-muted px-3 py-2 text-sm">{master.invite_code}</code>
        </div>
        <div className="space-y-2">
          <Label>{t('inviteLink')}</Label>
          <div className="flex gap-2">
            <Input value={webLink} readOnly className="text-xs" />
            <Button variant="outline" size="icon" onClick={() => copyToClipboard(webLink, 'web')}>
              {copied === 'web' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          <Label>{t('telegramLink')}</Label>
          <div className="flex gap-2">
            <Input value={telegramLink} readOnly className="text-xs" />
            <Button variant="outline" size="icon" onClick={() => copyToClipboard(telegramLink, 'tg')}>
              {copied === 'tg' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PoliciesTab({ master, onSaved }: { master: NonNullable<ReturnType<typeof useMaster>['master']>; onSaved: () => void }) {
  const t = useTranslations('profile');
  const tc = useTranslations('common');
  const [saving, setSaving] = useState(false);

  const policy = (master as unknown as Record<string, unknown>).cancellation_policy as { free_hours: number; partial_hours: number; partial_percent: number } | null;
  const [freeHours, setFreeHours] = useState(policy?.free_hours ?? 24);
  const [partialHours, setPartialHours] = useState(policy?.partial_hours ?? 12);
  const [partialPercent, setPartialPercent] = useState(policy?.partial_percent ?? 50);

  const [birthdayGreet, setBirthdayGreet] = useState((master as unknown as Record<string, unknown>).birthday_auto_greet as boolean ?? false);
  const [birthdayDiscount, setBirthdayDiscount] = useState((master as unknown as Record<string, unknown>).birthday_discount_percent as number ?? 0);

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from('masters')
      .update({
        cancellation_policy: { free_hours: freeHours, partial_hours: partialHours, partial_percent: partialPercent },
        birthday_auto_greet: birthdayGreet,
        birthday_discount_percent: birthdayDiscount,
      })
      .eq('id', master.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success(t('profileSaved')); onSaved(); }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('policies')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <h4 className="text-sm font-semibold">{t('cancellationPolicy')}</h4>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label>{t('freeCancelHours')}</Label>
              <Input type="number" min={0} max={168} value={freeHours} onChange={(e) => setFreeHours(Number(e.target.value))} />
            </div>
            <div>
              <Label>{t('partialHours')}</Label>
              <Input type="number" min={0} max={freeHours} value={partialHours} onChange={(e) => setPartialHours(Number(e.target.value))} />
            </div>
            <div>
              <Label>{t('partialPercent')}</Label>
              <Input type="number" min={0} max={100} value={partialPercent} onChange={(e) => setPartialPercent(Number(e.target.value))} />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="text-sm font-semibold">{t('birthdaySettings')}</h4>
          <div className="flex items-center gap-3">
            <Switch checked={birthdayGreet} onCheckedChange={setBirthdayGreet} />
            <Label>{t('autoGreet')}</Label>
          </div>
          {birthdayGreet && (
            <div className="max-w-xs">
              <Label>{t('birthdayDiscount')}</Label>
              <Input type="number" min={0} max={50} value={birthdayDiscount} onChange={(e) => setBirthdayDiscount(Number(e.target.value))} />
            </div>
          )}
        </div>

        <Button onClick={handleSave} disabled={saving}>
          {saving ? tc('loading') : tc('save')}
        </Button>
      </CardContent>
    </Card>
  );
}

function NotificationsTab({ master, onSaved }: { master: NonNullable<ReturnType<typeof useMaster>['master']>; onSaved: () => void }) {
  const [notifyWeb, setNotifyWeb] = useState((master as unknown as Record<string, unknown>).notify_web !== false);
  const [notifyTelegram, setNotifyTelegram] = useState((master as unknown as Record<string, unknown>).notify_telegram !== false);
  const [saving, setSaving] = useState(false);

  const handleToggle = async (field: 'notify_web' | 'notify_telegram', value: boolean) => {
    if (field === 'notify_web') setNotifyWeb(value);
    else setNotifyTelegram(value);

    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from('masters')
      .update({ [field]: value })
      .eq('id', master.id);

    if (error) {
      toast.error('Не удалось сохранить');
      if (field === 'notify_web') setNotifyWeb(!value);
      else setNotifyTelegram(!value);
    } else {
      toast.success('Сохранено');
      onSaved();
    }
    setSaving(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BellRing className="h-5 w-5" />
          Уведомления
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Напоминания на сайте</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Всплывающие уведомления о напоминаниях в правом нижнем углу
            </p>
          </div>
          <Switch
            checked={notifyWeb}
            onCheckedChange={(v) => handleToggle('notify_web', v)}
            disabled={saving}
          />
        </div>

        <div className="h-px bg-border" />

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Уведомления в Telegram</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Бот присылает напоминание в Telegram при наступлении срока
            </p>
          </div>
          <Switch
            checked={notifyTelegram}
            onCheckedChange={(v) => handleToggle('notify_telegram', v)}
            disabled={saving}
          />
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Vertical (industry) selector ─── */
const VERTICAL_LABELS: Record<VerticalKey, { label: string; icon: string }> = {
  beauty:    { label: 'Красота и волосы',   icon: '💇' },
  health:    { label: 'Здоровье / мед.',    icon: '🩺' },
  auto:      { label: 'Авто / сантехника',  icon: '🔧' },
  tattoo:    { label: 'Тату / пирсинг',      icon: '🎨' },
  pets:      { label: 'Животные',            icon: '🐾' },
  craft:     { label: 'Ремесло',             icon: '🔨' },
  fitness:   { label: 'Фитнес / йога',       icon: '🧘' },
  events:    { label: 'Фото / event',        icon: '📷' },
  education: { label: 'Обучение / коучинг',  icon: '📚' },
  other:     { label: 'Другое',              icon: '➕' },
};

function VerticalTab({ master, onSaved }: { master: NonNullable<ReturnType<typeof useMaster>['master']>; onSaved: () => void }) {
  const [saving, setSaving] = useState(false);
  const current = (master.vertical as VerticalKey) || 'other';

  async function setVertical(v: VerticalKey) {
    if (v === current) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from('masters').update({ vertical: v }).eq('id', master.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Сфера обновлена. Обновите страницу для применения шаблонов.');
    onSaved();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Моя сфера деятельности</CardTitle>
        <p className="text-sm text-muted-foreground">Влияет на шаблоны услуг, анамнез, доп. поля клиента и модули дашборда.</p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {(Object.keys(VERTICAL_LABELS) as VerticalKey[]).map(k => {
            const v = VERTICAL_LABELS[k];
            const active = k === current;
            return (
              <button
                key={k}
                onClick={() => setVertical(k)}
                disabled={saving}
                className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all ${
                  active ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'
                }`}
              >
                <span className="text-2xl">{v.icon}</span>
                <span className="text-xs font-medium text-center">{v.label}</span>
                {active && <span className="text-[10px] font-semibold text-primary uppercase tracking-wide">Активно</span>}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Features toggle per module ─── */
const FEATURE_LABELS: Record<keyof VerticalFeatures, { label: string; desc: string }> = {
  healthProfile:  { label: 'Медицинская карта',   desc: 'Аллергии, противопоказания, согласия' },
  gallery:        { label: 'Галерея фото',        desc: 'Before / after снимки клиентов' },
  familyLinks:    { label: 'Семейные связи',      desc: 'Связь клиентов (родитель-ребёнок)' },
  memberships:    { label: 'Абонементы',           desc: 'Пакеты визитов для клиентов' },
  giftCards:      { label: 'Подарочные карты',    desc: 'Сертификаты с балансом' },
  inventory:      { label: 'Склад материалов',    desc: 'Учёт расходников, запчастей' },
  loyalty:        { label: 'Лояльность',           desc: 'Punch card (N-й визит бесплатно)' },
  smartRebooking: { label: 'Умные напоминания',   desc: 'Автопредложение записи' },
  mobileVisits:   { label: 'Выездные визиты',      desc: 'Геолокация, адрес объекта' },
  onlineConsults: { label: 'Онлайн-консультации', desc: 'Zoom / Google Meet' },
  portfolio:      { label: 'Портфолио',            desc: 'Работы на публичной странице' },
  reviews:        { label: 'Отзывы',               desc: 'Сбор и модерация' },
  voiceNotes:     { label: 'Голосовые заметки',    desc: 'Запись через микрофон + AI' },
};

function FeaturesTab({ master, onSaved }: { master: NonNullable<ReturnType<typeof useMaster>['master']>; onSaved: () => void }) {
  const features = useFeatures();
  const [saving, setSaving] = useState(false);
  const vertical = (master.vertical as VerticalKey) || 'other';
  const defaults = DEFAULT_FEATURES[vertical];

  async function toggleFeature(key: keyof VerticalFeatures, value: boolean) {
    setSaving(true);
    const overrides = { ...(master.feature_overrides || {}) };
    // If toggling back to default, remove override; otherwise add
    if (defaults[key] === value) {
      delete overrides[key];
    } else {
      overrides[key] = value;
    }
    const supabase = createClient();
    const { error } = await supabase.from('masters').update({ feature_overrides: overrides }).eq('id', master.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    onSaved();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Модули дашборда</CardTitle>
        <p className="text-sm text-muted-foreground">Включите только то, что нужно. Дефолты зависят от вашей сферы ({VERTICAL_LABELS[vertical].label}).</p>
      </CardHeader>
      <CardContent className="space-y-0 divide-y">
        {(Object.keys(FEATURE_LABELS) as (keyof VerticalFeatures)[]).map(key => {
          const meta = FEATURE_LABELS[key];
          const active = features[key];
          const isDefault = defaults[key] === active;
          return (
            <div key={key} className="flex items-center justify-between py-3">
              <div className="flex-1 min-w-0 pr-4">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{meta.label}</p>
                  {!isDefault && <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-semibold uppercase">изменено</span>}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{meta.desc}</p>
              </div>
              <Switch
                checked={active}
                onCheckedChange={(v) => toggleFeature(key, v)}
                disabled={saving}
              />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

/* ─── Security: email / password / phone ─── */
function SecurityTab() {
  const [newEmail, setNewEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [emailSaving, setEmailSaving] = useState(false);
  const [passSaving, setPassSaving] = useState(false);

  async function changeEmail() {
    if (!newEmail || !newEmail.includes('@')) { toast.error('Некорректный email'); return; }
    setEmailSaving(true);
    const supabase = createClient();
    // Supabase sends confirmation to the NEW email by default when email confirmations are enabled
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    setEmailSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('На новый email отправлено письмо с подтверждением. Email обновится после перехода по ссылке.');
    setNewEmail('');
  }

  async function changePassword() {
    if (newPassword.length < 6) { toast.error('Пароль минимум 6 символов'); return; }
    if (newPassword !== confirmPassword) { toast.error('Пароли не совпадают'); return; }
    setPassSaving(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPassSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Пароль изменён');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Изменить email</CardTitle>
          <p className="text-sm text-muted-foreground">
            На новый email придёт письмо с подтверждением. Пока не подтвердите — старый email остаётся активным.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label>Новый email</Label>
            <Input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="new@example.com" />
          </div>
          <Button onClick={changeEmail} disabled={emailSaving || !newEmail}>
            {emailSaving ? 'Отправка...' : 'Отправить подтверждение'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Изменить пароль</CardTitle>
          <p className="text-sm text-muted-foreground">Минимум 6 символов.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label>Текущий пароль (для подтверждения)</Label>
            <Input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Новый пароль</Label>
              <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Повторите новый пароль</Label>
              <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
            </div>
          </div>
          <Button onClick={changePassword} disabled={passSaving || !newPassword || newPassword !== confirmPassword}>
            {passSaving ? 'Сохранение...' : 'Сменить пароль'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
