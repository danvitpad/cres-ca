/** --- YAML
 * name: Settings Page
 * description: Master/salon settings — profile info, working hours, subscription, invite links
 * --- */

'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
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
import { DateWheelPicker, fromISODay, toISODay } from '@/components/ui/date-wheel-picker';
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
  MessageSquareHeart,
  Gift,
  Settings as SettingsCogIcon,
} from 'lucide-react';
import { usePageTheme, FONT, FONT_FEATURES, pageContainer } from '@/lib/dashboard-theme';
import {
  SettingsBlock,
  SettingsField,
  SettingsSegmented,
  SettingsSwitch,
  SettingsButton,
  settingsInputStyle,
} from '@/components/settings/settings-block';
import { DEFAULT_FEATURES, type VerticalFeatures } from '@/lib/verticals/feature-flags';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { useConfirm } from '@/hooks/use-confirm';
import type { VerticalKey } from '@/lib/verticals/default-services';
import { useFeatures } from '@/hooks/use-features';
import { motion } from 'framer-motion';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

type WorkingDay = { start: string; end: string; break_start?: string; break_end?: string } | null;
type WorkingHours = Record<string, WorkingDay>;

export default function SettingsPage() {
  const t = useTranslations('profile');
  const tc = useTranslations('common');
  const locale = useLocale();
  const { master, loading, refetch } = useMaster();
  const { userId } = useAuthStore();
  const searchParams = useSearchParams();
  const [activeSection, setActiveSection] = useState<string | null>(null);

  // Sync with URL ?section=... (deep-link from header dropdown).
  // Reset to null when the param is removed so /settings always shows the home grid.
  useEffect(() => {
    const s = searchParams.get('section');
    setActiveSection(s);
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

  const settingSections: Array<{
    key: string;
    icon: typeof UserCircle;
    title: string;
    desc: string;
    href?: string;
  }> = [
    { key: 'profile', icon: UserCircle, title: t('editProfile'), desc: t('profileDesc') || t('editProfile') },
    { key: 'vertical', icon: Briefcase, title: 'Моя сфера', desc: 'Индустрия и шаблоны услуг' },
    { key: 'features', icon: Layers, title: 'Модули', desc: 'Что включено в дашборде' },
    { key: 'hours', icon: CalendarClock, title: t('workingHours'), desc: t('hoursDesc') || t('workingHours') },
    { key: 'security', icon: KeyRound, title: 'Безопасность', desc: 'Email, пароль, телефон' },
    { key: 'subscription', icon: CreditCard, title: t('subscription'), desc: t('subscriptionDesc') || t('subscription') },
    { key: 'invite', icon: LinkIcon, title: t('inviteLink'), desc: t('inviteDesc') || t('inviteLink') },
    { key: 'policies', icon: Shield, title: t('policies'), desc: t('policiesDesc') || t('policies') },
    { key: 'loyalty', icon: Gift, title: 'Лояльность', desc: 'Баллы за визиты, реферал, ДР-промокод' },
    { key: 'notifications', icon: BellRing, title: 'Уведомления', desc: 'Напоминания на сайте и в Telegram' },
    { key: 'feedback', icon: MessageSquareHeart, title: 'Обратная связь', desc: 'Напишите команде CRES-CA', href: `/${locale}/settings/feedback` },
  ];

  if (activeSection) {
    return (
      <SettingsSectionShell onBack={() => setActiveSection(null)} backLabel={t('settingsTitle') || 'Настройки'}>
        {activeSection === 'profile' && <ProfileTab master={master} userId={userId!} onSaved={refetch} />}
        {activeSection === 'vertical' && <VerticalTab master={master} onSaved={refetch} />}
        {activeSection === 'features' && <FeaturesTab master={master} onSaved={refetch} />}
        {activeSection === 'hours' && <WorkingHoursTab master={master} onSaved={refetch} />}
        {activeSection === 'security' && <SecurityTab />}
        {activeSection === 'subscription' && <SubscriptionTab />}
        {activeSection === 'invite' && <InviteLinkTab master={master} />}
        {activeSection === 'policies' && <PoliciesTab master={master} onSaved={refetch} />}
        {activeSection === 'loyalty' && <LoyaltyTab master={master} onSaved={refetch} />}
        {activeSection === 'notifications' && <NotificationsTab master={master} onSaved={refetch} />}
      </SettingsSectionShell>
    );
  }

  return <SettingsHomeView sections={settingSections} onSelect={setActiveSection} />;
}

/* ── Help-styled outer shell for the settings home page ─────────────── */
function SettingsHomeView({
  sections,
  onSelect,
}: {
  sections: Array<{
    key: string;
    icon: typeof UserCircle;
    title: string;
    desc: string;
    href?: string;
  }>;
  onSelect: (key: string) => void;
}) {
  const { C, mounted } = usePageTheme();
  if (!mounted) return null;

  return (
    <div style={{
      ...pageContainer,
      color: C.text,
      background: C.bg,
      minHeight: '100%',
      paddingBottom: 96,
      fontFamily: FONT,
      fontFeatureSettings: FONT_FEATURES,
    }}>
      {/* Hero — same shape as /help */}
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        style={{
          background: C.accentSoft,
          border: `1px solid ${C.aiBorder}`,
          borderRadius: 16,
          padding: '28px 32px',
          marginBottom: 28,
        }}
      >
        <h1 style={{
          fontSize: 26, fontWeight: 650, color: C.text, letterSpacing: '-0.5px',
          margin: 0, display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <SettingsCogIcon size={24} style={{ color: C.accent }} />
          Настройки
        </h1>
        <p style={{ fontSize: 14, color: C.textSecondary, margin: '6px 0 0', lineHeight: 1.5 }}>
          Здесь собрано всё про твой аккаунт, рабочее пространство и подписку. Каждый раздел — отдельный экран с подробными настройками.
        </p>
      </motion.div>

      {/* Grid — same minmax(320, 1fr) as /help */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: 14,
      }}>
        {sections.map((section, i) => {
          const Icon = section.icon;
          const inner = (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: C.accentSoft, color: C.accent,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Icon size={16} />
              </div>
              <div style={{ minWidth: 0, textAlign: 'left' }}>
                <div style={{ fontSize: 14, fontWeight: 650, color: C.text, lineHeight: 1.2 }}>{section.title}</div>
                <div style={{ fontSize: 11, color: C.textTertiary, marginTop: 3 }}>{section.desc}</div>
              </div>
            </div>
          );
          const cardStyle: React.CSSProperties = {
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 14,
            padding: 18,
            cursor: 'pointer',
            textDecoration: 'none',
            display: 'block',
            transition: 'border-color 0.15s, transform 0.15s',
          };
          if (section.href) {
            return (
              <motion.div
                key={section.key}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <Link href={section.href} style={cardStyle}>
                  {inner}
                </Link>
              </motion.div>
            );
          }
          return (
            <motion.button
              key={section.key}
              type="button"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              onClick={() => onSelect(section.key)}
              style={{ ...cardStyle, width: '100%', font: 'inherit' }}
            >
              {inner}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

/* ── Section page wrapper (back button + centered max-width) ───────── */
function SettingsSectionShell({
  onBack,
  backLabel,
  children,
}: {
  onBack: () => void;
  backLabel: string;
  children: React.ReactNode;
}) {
  const { C, mounted } = usePageTheme();
  if (!mounted) return null;

  return (
    <div style={{
      ...pageContainer,
      color: C.text,
      background: C.bg,
      minHeight: '100%',
      paddingBottom: 96,
      fontFamily: FONT,
      fontFeatureSettings: FONT_FEATURES,
    }}>
      <button
        onClick={onBack}
        style={{
          background: 'transparent',
          border: 'none',
          color: C.textSecondary,
          fontSize: 13,
          cursor: 'pointer',
          padding: 0,
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontFamily: FONT,
        }}
      >
        <ChevronLeft size={14} />
        {backLabel}
      </button>
      <div className="space-y-5">{children}</div>
    </div>
  );
}

function ProfileTab({ master, userId, onSaved }: { master: NonNullable<ReturnType<typeof useMaster>['master']>; userId: string; onSaved: () => void }) {
  const t = useTranslations('profile');
  const tc = useTranslations('common');
  const { C: pageThemeC } = usePageTheme();
  const [saving, setSaving] = useState(false);

  // Personal: last/first/middle/DOB/phone
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const initialProfile = master.profile as any;
  const [firstName, setFirstName] = useState<string>(initialProfile.first_name || '');
  const [lastName, setLastName] = useState<string>(initialProfile.last_name || '');
  const [middleName, setMiddleName] = useState<string>(initialProfile.middle_name || '');
  const [dob, setDob] = useState<string>(initialProfile.date_of_birth || '');
  const [phone, setPhone] = useState(master.profile.phone ?? '');

  // Professional
  const [specialization, setSpecialization] = useState(master.specialization ?? '');
  const [bio, setBio] = useState(master.bio ?? '');
  const [address, setAddress] = useState(master.address ?? '');
  const [city, setCity] = useState(master.city ?? '');
  // Публичный язык — на каком языке клиенты получают рассылки/напоминания
  // и на каком языке формируются PDF поставщикам. Может отличаться от UI-языка.
  const [publicLanguage, setPublicLanguage] = useState<'ru' | 'uk' | 'en'>(
    (((master as unknown as Record<string, unknown>).public_language as string | undefined) ?? 'ru') as 'ru' | 'uk' | 'en',
  );

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();
    const fullName = [lastName, firstName, middleName].filter(Boolean).join(' ').trim();

    const [profileRes, masterRes] = await Promise.all([
      supabase.from('profiles').update({
        full_name: fullName || firstName || '—',
        first_name: firstName || null,
        last_name: lastName || null,
        middle_name: middleName || null,
        date_of_birth: dob || null,
        phone: phone || null,
      }).eq('id', userId),
      supabase.from('masters').update({
        specialization, bio, address, city,
        public_language: publicLanguage,
      }).eq('id', master.id),
    ]);

    setSaving(false);
    if (profileRes.error || masterRes.error) {
      toast.error(profileRes.error?.message || masterRes.error?.message || tc('error'));
    } else {
      toast.success(t('profileSaved'));
      onSaved();
    }
  }

  const C = pageThemeC;
  const inputStyle = settingsInputStyle(C);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <SettingsBlock title="Личные данные" subtitle="Используется для идентификации и в подписках" C={C}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
          <SettingsField label="Фамилия" C={C}>
            <input style={inputStyle} value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Иванова" />
          </SettingsField>
          <SettingsField label="Имя" C={C}>
            <input style={inputStyle} value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Мария" required />
          </SettingsField>
          <SettingsField label="Отчество" C={C}>
            <input style={inputStyle} value={middleName} onChange={(e) => setMiddleName(e.target.value)} placeholder="Андреевна" />
          </SettingsField>
        </div>
        <SettingsField label="Телефон" C={C}>
          <input type="tel" style={inputStyle} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+380..." />
        </SettingsField>
        <SettingsField label="Дата рождения" C={C}>
          <div style={{ borderRadius: 10, border: `1px solid ${C.border}`, background: C.surfaceElevated, padding: '4px 0' }}>
            <DateWheelPicker
              size="sm"
              locale="ru-RU"
              value={fromISODay(dob)}
              onChange={(d) => setDob(toISODay(d))}
            />
          </div>
        </SettingsField>
      </SettingsBlock>

      <SettingsBlock title="Профессиональная информация" subtitle="Видна на твоей публичной странице" C={C}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
          <SettingsField label="Специализация" C={C}>
            <input style={inputStyle} value={specialization} onChange={(e) => setSpecialization(e.target.value)} placeholder={t('specializationPlaceholder')} />
          </SettingsField>
          <SettingsField label="Город" C={C}>
            <input style={inputStyle} value={city} onChange={(e) => setCity(e.target.value)} required />
          </SettingsField>
        </div>
        <SettingsField label="Адрес" C={C}>
          <input style={inputStyle} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="ул., дом, кабинет" />
        </SettingsField>
        <SettingsField label="О себе" C={C}>
          <textarea
            style={{ ...inputStyle, resize: 'vertical', minHeight: 80 }}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            placeholder="Коротко о себе и услугах (публично)"
          />
        </SettingsField>
      </SettingsBlock>

      <SettingsBlock
        title="Язык исходящих уведомлений"
        subtitle="На этом языке клиенты получают рассылки/напоминания, поставщики — PDF-заказы. Может отличаться от языка твоего интерфейса."
        C={C}
      >
        <SettingsSegmented
          value={publicLanguage}
          onChange={setPublicLanguage}
          options={[
            { value: 'ru', label: 'Русский' },
            { value: 'uk', label: 'Українська' },
            { value: 'en', label: 'English' },
          ]}
          C={C}
        />
      </SettingsBlock>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <SettingsButton onClick={handleSave} disabled={saving} C={C}>
          {saving ? tc('loading') : 'Сохранить изменения'}
        </SettingsButton>
      </div>
    </div>
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
  const { C } = usePageTheme();
  const { tier } = useAuthStore();

  // Карта tier → читаемое имя по-русски. Для trial показываем именно «Триал»,
  // даже если subscription_tier в БД содержит 'business' (наследие промо-бампа).
  const TIER_LABEL: Record<string, string> = {
    trial: 'Триал', free: 'Free', starter: 'Старт', pro: 'Про', business: 'Бизнес',
  };
  const label = tier ? (TIER_LABEL[tier] ?? tier) : 'Триал';

  return (
    <SettingsBlock title={t('subscription')} subtitle="Текущий тариф и тип оплаты" C={C}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
      }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '8px 14px', borderRadius: 999,
          background: C.accentSoft, color: C.accent,
          fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
        }}>
          {label}
        </div>
        <span style={{ fontSize: 13, color: C.textSecondary }}>
          {tier === 'trial' ? 'Бесплатный пробный период' : 'Действует до конца расчётного периода'}
        </span>
        <div style={{ flex: 1 }} />
        <SettingsButton onClick={() => { /* TODO: open plan picker */ }} variant="secondary" C={C}>
          {t('changePlan')}
        </SettingsButton>
      </div>
    </SettingsBlock>
  );
}

function InviteLinkTab({ master }: { master: NonNullable<ReturnType<typeof useMaster>['master']> }) {
  const t = useTranslations('profile');
  const { C } = usePageTheme();
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

  const inputStyle = settingsInputStyle(C);
  const copyButton = (key: 'web' | 'tg', text: string) => (
    <button
      type="button"
      onClick={() => copyToClipboard(text, key)}
      style={{
        padding: '0 14px', height: 40, borderRadius: 10,
        border: `1px solid ${C.border}`, background: C.surfaceElevated,
        color: copied === key ? C.success : C.text,
        fontSize: 12, fontWeight: 600, cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', gap: 6,
        flexShrink: 0,
      }}
    >
      {copied === key ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      {copied === key ? 'Скопировано' : 'Копировать'}
    </button>
  );

  return (
    <SettingsBlock title={t('inviteLink')} subtitle="Поделись со знакомым мастером — оба получите бонус, когда он зарегистрируется" C={C}>
      <SettingsField label={t('inviteCode')} hint="Уникальный код твоей мастерской" C={C}>
        <code style={{
          display: 'block', padding: '10px 12px', borderRadius: 10,
          background: C.surfaceElevated, border: `1px solid ${C.border}`,
          color: C.text, fontSize: 14, fontFamily: 'ui-monospace, monospace',
        }}>
          {master.invite_code}
        </code>
      </SettingsField>
      <SettingsField label={t('inviteLink')} C={C}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={webLink} readOnly style={{ ...inputStyle, fontSize: 12, fontFamily: 'ui-monospace, monospace' }} />
          {copyButton('web', webLink)}
        </div>
      </SettingsField>
      <SettingsField label={t('telegramLink')} C={C}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={telegramLink} readOnly style={{ ...inputStyle, fontSize: 12, fontFamily: 'ui-monospace, monospace' }} />
          {copyButton('tg', telegramLink)}
        </div>
      </SettingsField>
    </SettingsBlock>
  );
}

function PoliciesTab({ master, onSaved }: { master: NonNullable<ReturnType<typeof useMaster>['master']>; onSaved: () => void }) {
  const t = useTranslations('profile');
  const tc = useTranslations('common');
  const { C } = usePageTheme();
  const [saving, setSaving] = useState(false);

  const policy = (master as unknown as Record<string, unknown>).cancellation_policy as { free_hours: number; partial_hours: number; partial_percent: number } | null;
  const [freeHours, setFreeHours] = useState(policy?.free_hours ?? 24);
  const [partialHours, setPartialHours] = useState(policy?.partial_hours ?? 12);
  const [partialPercent, setPartialPercent] = useState(policy?.partial_percent ?? 50);

  const [birthdayGreet, setBirthdayGreet] = useState((master as unknown as Record<string, unknown>).birthday_auto_greet as boolean ?? false);
  const [birthdayDiscount, setBirthdayDiscount] = useState((master as unknown as Record<string, unknown>).birthday_discount_percent as number ?? 0);

  const [importantInfo, setImportantInfo] = useState(
    ((master as unknown as Record<string, unknown>).booking_important_info as string) ?? '',
  );

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from('masters')
      .update({
        cancellation_policy: { free_hours: freeHours, partial_hours: partialHours, partial_percent: partialPercent },
        birthday_auto_greet: birthdayGreet,
        birthday_discount_percent: birthdayDiscount,
        booking_important_info: importantInfo.trim() || null,
      })
      .eq('id', master.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success(t('profileSaved')); onSaved(); }
  }

  const inputStyle = settingsInputStyle(C);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <SettingsBlock title={t('cancellationPolicy')} subtitle="Когда клиент может отменить визит без оплаты, частично, и сколько берёт штраф" C={C}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
          <SettingsField label={t('freeCancelHours')} hint="часов до визита" C={C}>
            <input type="number" min={0} max={168} style={{ ...inputStyle, textAlign: 'center' }} value={freeHours} onChange={(e) => setFreeHours(Number(e.target.value))} />
          </SettingsField>
          <SettingsField label={t('partialHours')} hint="часов до визита" C={C}>
            <input type="number" min={0} max={freeHours} style={{ ...inputStyle, textAlign: 'center' }} value={partialHours} onChange={(e) => setPartialHours(Number(e.target.value))} />
          </SettingsField>
          <SettingsField label={t('partialPercent')} hint="% от стоимости" C={C}>
            <input type="number" min={0} max={100} style={{ ...inputStyle, textAlign: 'center' }} value={partialPercent} onChange={(e) => setPartialPercent(Number(e.target.value))} />
          </SettingsField>
        </div>
      </SettingsBlock>

      <SettingsBlock title={t('birthdaySettings')} subtitle="Автоматическое поздравление клиенту в день рождения" C={C}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <SettingsSwitch checked={birthdayGreet} onChange={setBirthdayGreet} C={C} />
          <span style={{ fontSize: 14, color: C.text }}>{t('autoGreet')}</span>
        </div>
        {birthdayGreet && (
          <SettingsField label={t('birthdayDiscount')} hint="скидка на следующий визит, %" C={C}>
            <input type="number" min={0} max={50} style={{ ...inputStyle, maxWidth: 200, textAlign: 'center' }} value={birthdayDiscount} onChange={(e) => setBirthdayDiscount(Number(e.target.value))} />
          </SettingsField>
        )}
      </SettingsBlock>

      <SettingsBlock title="Важная информация для клиента" subtitle="Показывается на странице подтверждения записи: адрес, как добраться, что взять с собой" C={C}>
        <textarea
          style={{ ...inputStyle, resize: 'vertical', minHeight: 120 }}
          value={importantInfo}
          onChange={(e) => setImportantInfo(e.target.value)}
          placeholder={'Виникло питання?\nТелефонуй: 0670113860\n\nАдрес: вул. Європейська 27/24, вхід з вулиці 1100-річчя.'}
          rows={6}
          maxLength={2000}
        />
        <div style={{ fontSize: 11, color: C.textTertiary, textAlign: 'right' }}>{importantInfo.length}/2000</div>
      </SettingsBlock>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <SettingsButton onClick={handleSave} disabled={saving} C={C}>
          {saving ? tc('loading') : tc('save')}
        </SettingsButton>
      </div>
    </div>
  );
}

function NotificationsTab({ master, onSaved }: { master: NonNullable<ReturnType<typeof useMaster>['master']>; onSaved: () => void }) {
  const [notifyWeb, setNotifyWeb] = useState((master as unknown as Record<string, unknown>).notify_web !== false);
  const [notifyTelegram, setNotifyTelegram] = useState((master as unknown as Record<string, unknown>).notify_telegram !== false);
  const [closeMode, setCloseMode] = useState<'confirm' | 'auto'>(
    (((master as unknown as Record<string, unknown>).appointment_close_mode as string) || 'confirm') as 'confirm' | 'auto',
  );
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

  async function setCloseModeAndSave(v: 'confirm' | 'auto') {
    setCloseMode(v);
    const supabase = createClient();
    const { error } = await supabase
      .from('masters')
      .update({ appointment_close_mode: v })
      .eq('id', master.id);
    if (error) toast.error('Не удалось сохранить');
    else { toast.success('Сохранено'); onSaved(); }
  }

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

        <div className="h-px bg-border" />

        {/* Appointment close mode */}
        <div>
          <p className="text-sm font-medium mb-1">Закрытие записей</p>
          <p className="text-xs text-muted-foreground mb-3">
            Когда время записи прошло — как засчитывать доход?
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition ${
              closeMode === 'confirm' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
            }`}>
              <input
                type="radio"
                name="closeMode"
                className="mt-1"
                checked={closeMode === 'confirm'}
                onChange={() => setCloseModeAndSave('confirm')}
              />
              <div>
                <div className="text-sm font-semibold">С подтверждением</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Бот напишет «Состоялась?» после записи — подтверждаю сам.
                </div>
              </div>
            </label>
            <label className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition ${
              closeMode === 'auto' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
            }`}>
              <input
                type="radio"
                name="closeMode"
                className="mt-1"
                checked={closeMode === 'auto'}
                onChange={() => setCloseModeAndSave('auto')}
              />
              <div>
                <div className="text-sm font-semibold">Автоматически</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Как только время записи прошло — засчитываю доход без вопросов.
                </div>
              </div>
            </label>
          </div>
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

/* ─── Security: email / password / phone / 2FA / delete account ─── */
function SecurityTab() {
  const { master, refetch } = useMaster();
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [emailSaving, setEmailSaving] = useState(false);
  const [phoneSaving, setPhoneSaving] = useState(false);
  const [passSaving, setPassSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deletePassword, setDeletePassword] = useState('');

  // 2FA state
  const tg2faEnabled = (master?.profile as { tg_2fa_enabled?: boolean } | undefined)?.tg_2fa_enabled ?? false;
  const hasTelegramLinked = !!(master?.profile as { telegram_id?: string | null } | undefined)?.telegram_id;
  const [twoFaStep, setTwoFaStep] = useState<'idle' | 'await_code' | 'busy'>('idle');
  const [twoFaCode, setTwoFaCode] = useState('');

  async function deleteAccount() {
    if (deleteConfirmation !== 'УДАЛИТЬ') { toast.error('Введите "УДАЛИТЬ"'); return; }
    if (!deletePassword) { toast.error('Введите текущий пароль'); return; }

    setDeleting(true);
    const res = await fetch('/api/account/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmation: deleteConfirmation, password: deletePassword }),
    });
    setDeleting(false);
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: 'Не удалось удалить' }));
      toast.error(error || 'Ошибка удаления');
      return;
    }
    toast.success('Аккаунт помечен на удаление. У вас есть 30 дней на восстановление — просто войдите снова.');
    window.location.href = '/login';
  }

  async function changeEmail() {
    if (!newEmail || !newEmail.includes('@')) { toast.error('Некорректный email'); return; }
    setEmailSaving(true);
    const supabase = createClient();
    const locale = (typeof window !== 'undefined' && window.location.pathname.match(/^\/(ru|en|uk)\b/)?.[1]) || 'ru';
    const { error } = await supabase.auth.updateUser({ email: newEmail, data: { locale } });
    setEmailSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('На новый email отправлено письмо с подтверждением. Email обновится после перехода по ссылке.');
    setNewEmail('');
  }

  async function changePhone() {
    if (!/^\+\d{7,15}$/.test(newPhone)) { toast.error('Формат: +380... (7–15 цифр после +)'); return; }
    setPhoneSaving(true);
    const res = await fetch('/api/account/change-phone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: newPhone }),
    });
    setPhoneSaving(false);
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: 'Не удалось' }));
      toast.error(error || 'Ошибка');
      return;
    }
    toast.success('Номер обновлён');
    setNewPhone('');
    refetch();
  }

  async function changePassword() {
    if (newPassword.length < 8) { toast.error('Пароль минимум 8 символов'); return; }
    if (newPassword !== confirmPassword) { toast.error('Пароли не совпадают'); return; }
    if (newPassword === currentPassword) { toast.error('Новый пароль совпадает с текущим'); return; }
    if (!currentPassword) { toast.error('Введите текущий пароль'); return; }
    setPassSaving(true);
    const supabase = createClient();
    // Verify current password by attempting sign-in
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email) {
      const verify = await supabase.auth.signInWithPassword({ email: user.email, password: currentPassword });
      if (verify.error) {
        setPassSaving(false);
        toast.error('Неверный текущий пароль');
        return;
      }
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPassSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Пароль изменён');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  }

  async function send2faCode() {
    if (!master?.profile_id) return;
    setTwoFaStep('busy');
    const res = await fetch('/api/auth/2fa/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile_id: master.profile_id }),
    });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: 'send_failed' }));
      setTwoFaStep('idle');
      toast.error(error === 'telegram_not_linked' ? 'Привяжите Telegram в профиле' : 'Не удалось отправить код');
      return;
    }
    setTwoFaStep('await_code');
    toast.success('Код отправлен в Telegram');
  }

  async function confirm2faToggle(enable: boolean) {
    setTwoFaStep('busy');
    const res = await fetch('/api/auth/2fa/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enable, code: enable ? twoFaCode : undefined }),
    });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: 'toggle_failed' }));
      setTwoFaStep('await_code');
      toast.error(error === 'invalid_or_expired' ? 'Неверный или истёкший код' : 'Ошибка');
      return;
    }
    setTwoFaStep('idle');
    setTwoFaCode('');
    toast.success(enable ? '2FA включён' : '2FA выключен');
    refetch();
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
          <p className="text-sm text-muted-foreground">Минимум 8 символов.</p>
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
          <Button onClick={changePassword} disabled={passSaving || !currentPassword || !newPassword || newPassword !== confirmPassword}>
            {passSaving ? 'Сохранение...' : 'Сменить пароль'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Изменить телефон</CardTitle>
          <p className="text-sm text-muted-foreground">
            Текущий: {master?.profile?.phone || '—'}. Формат: международный (+380...).
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label>Новый телефон</Label>
            <Input type="tel" value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="+380..." />
          </div>
          <Button onClick={changePhone} disabled={phoneSaving || !newPhone}>
            {phoneSaving ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Двухфакторная аутентификация (Telegram)</CardTitle>
          <p className="text-sm text-muted-foreground">
            {hasTelegramLinked
              ? 'При входе бот пришлёт 6-значный код в Telegram.'
              : 'Привяжите Telegram в профиле через @crescacom_bot, чтобы включить 2FA.'}
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {!hasTelegramLinked ? (
            <p className="text-sm text-muted-foreground">Telegram не привязан.</p>
          ) : tg2faEnabled ? (
            <Button
              variant="outline"
              onClick={() => confirm2faToggle(false)}
              disabled={twoFaStep === 'busy'}
            >
              {twoFaStep === 'busy' ? 'Выключение...' : 'Выключить 2FA'}
            </Button>
          ) : twoFaStep === 'idle' || twoFaStep === 'busy' ? (
            <Button onClick={send2faCode} disabled={twoFaStep === 'busy'}>
              {twoFaStep === 'busy' ? 'Отправка...' : 'Включить 2FA'}
            </Button>
          ) : (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Код из Telegram (6 цифр)</Label>
                <Input
                  inputMode="numeric"
                  maxLength={6}
                  value={twoFaCode}
                  onChange={e => setTwoFaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => confirm2faToggle(true)}
                  disabled={twoFaCode.length !== 6}
                >
                  Подтвердить
                </Button>
                <Button variant="outline" onClick={() => { setTwoFaStep('idle'); setTwoFaCode(''); }}>
                  Отмена
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Danger zone — delete account */}
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-destructive">Опасная зона</CardTitle>
          <p className="text-sm text-muted-foreground">
            Аккаунт будет помечен на удаление. У вас есть 30 дней на восстановление — просто войдите снова. После 30 дней все данные (клиенты, записи, услуги, расходы) удаляются безвозвратно.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label>Введите <span className="font-mono font-semibold">УДАЛИТЬ</span> для подтверждения</Label>
            <Input
              value={deleteConfirmation}
              onChange={e => setDeleteConfirmation(e.target.value)}
              placeholder="УДАЛИТЬ"
            />
          </div>
          <div className="space-y-2">
            <Label>Текущий пароль</Label>
            <Input
              type="password"
              value={deletePassword}
              onChange={e => setDeletePassword(e.target.value)}
            />
          </div>
          <Button
            variant="outline"
            className="border-destructive/40 text-destructive hover:bg-destructive hover:text-destructive-foreground"
            onClick={deleteAccount}
            disabled={deleting || deleteConfirmation !== 'УДАЛИТЬ' || !deletePassword}
          >
            {deleting ? 'Удаление...' : 'Удалить аккаунт'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── Loyalty: unified bonus / referral / birthday programme ─────────── */
function LoyaltyTab({
  master,
  onSaved,
}: {
  master: NonNullable<ReturnType<typeof useMaster>['master']>;
  onSaved: () => void;
}) {
  const tc = useTranslations('common');
  const [enabled, setEnabled] = useState(master.loyalty_enabled ?? false);
  const [percent, setPercent] = useState(master.loyalty_visit_percent ?? 5);
  const [cap, setCap] = useState(master.loyalty_max_per_visit ?? 100);
  const [expiry, setExpiry] = useState(master.loyalty_expiry_months ?? 6);
  const [referralReward, setReferralReward] = useState(master.loyalty_referral_reward ?? 100);
  const [bdayEnabled, setBdayEnabled] = useState(master.loyalty_birthday_enabled ?? false);
  const [bdayPercent, setBdayPercent] = useState(master.loyalty_birthday_percent ?? 10);
  const [bdayValidity, setBdayValidity] = useState(master.loyalty_birthday_validity_days ?? 30);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from('masters')
      .update({
        loyalty_enabled: enabled,
        loyalty_visit_percent: percent,
        loyalty_max_per_visit: cap,
        loyalty_expiry_months: expiry,
        loyalty_referral_reward: referralReward,
        loyalty_birthday_enabled: bdayEnabled,
        loyalty_birthday_percent: bdayPercent,
        loyalty_birthday_validity_days: bdayValidity,
      })
      .eq('id', master.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success('Сохранено'); onSaved(); }
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Программа лояльности</CardTitle>
          <p className="text-sm text-muted-foreground">
            Один общий тумблер на 3 механики: баллы за визиты, реферальную программу и подарок на ДР.
            Все баллы привязаны лично к тебе — клиент не может потратить их у другого мастера.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="text-sm font-semibold">Программа включена</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Когда выключено — никакие баллы не начисляются и не списываются. Уже начисленные сохраняются.
              </p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          <div className={enabled ? '' : 'opacity-50 pointer-events-none'}>
            <div className="space-y-4">
              <h4 className="text-sm font-semibold">💎 Баллы за визиты</h4>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <Label>% от стоимости визита</Label>
                  <Input
                    type="number" min={0} max={20}
                    value={percent}
                    onChange={(e) => setPercent(Math.max(0, Math.min(20, Number(e.target.value) || 0)))}
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">1 балл = 1 ₴ скидки. Рекомендуем 3-5%.</p>
                </div>
                <div>
                  <Label>Не больше N ₴ за визит</Label>
                  <Input
                    type="number" min={0}
                    value={cap}
                    onChange={(e) => setCap(Math.max(0, Number(e.target.value) || 0))}
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">Защита от больших чеков.</p>
                </div>
                <div>
                  <Label>Срок жизни (мес.)</Label>
                  <Input
                    type="number" min={1} max={60}
                    value={expiry}
                    onChange={(e) => setExpiry(Math.max(1, Math.min(60, Number(e.target.value) || 6)))}
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">Через N месяцев баллы сгорают.</p>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="text-sm font-semibold">🤝 Реферальная программа</h4>
                <p className="text-xs text-muted-foreground mt-1 mb-3">
                  Когда твой клиент приведёт нового и тот сделает первый оплаченный визит — ты автоматически
                  начисляешь реферреру баллы. Поставь сумму меньше среднего чека первого визита, чтобы
                  привлечение нового клиента было в плюс.
                </p>
                <div className="max-w-xs">
                  <Label>Награда реферреру (₴)</Label>
                  <Input
                    type="number" min={0}
                    value={referralReward}
                    onChange={(e) => setReferralReward(Math.max(0, Number(e.target.value) || 0))}
                  />
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold">🎂 Подарок на День Рождения</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Утром в ДР клиента ты автоматически генерируешь ему персональный промокод на скидку.
                      Это не накопительные баллы — клиент должен прийти в течение N дней или промо сгорит.
                    </p>
                  </div>
                  <Switch checked={bdayEnabled} onCheckedChange={setBdayEnabled} />
                </div>
                <div className={`mt-3 grid gap-3 sm:grid-cols-2 ${bdayEnabled ? '' : 'opacity-50 pointer-events-none'}`}>
                  <div>
                    <Label>Скидка (%)</Label>
                    <Input
                      type="number" min={0} max={50}
                      value={bdayPercent}
                      onChange={(e) => setBdayPercent(Math.max(0, Math.min(50, Number(e.target.value) || 0)))}
                    />
                  </div>
                  <div>
                    <Label>Действует (дней)</Label>
                    <Input
                      type="number" min={1} max={365}
                      value={bdayValidity}
                      onChange={(e) => setBdayValidity(Math.max(1, Math.min(365, Number(e.target.value) || 30)))}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving}>
            {saving ? tc('loading') : tc('save')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
