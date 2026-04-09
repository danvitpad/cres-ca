/** --- YAML
 * name: Settings Page
 * description: Master/salon settings — profile info, working hours, subscription, invite links
 * --- */

'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';
import { useAuthStore } from '@/stores/auth-store';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Copy, Check } from 'lucide-react';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

type WorkingDay = { start: string; end: string; break_start?: string; break_end?: string } | null;
type WorkingHours = Record<string, WorkingDay>;

export default function SettingsPage() {
  const t = useTranslations('profile');
  const tc = useTranslations('common');
  const { master, loading, refetch } = useMaster();
  const { userId } = useAuthStore();

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

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">{t('editProfile')}</h2>
      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">{t('editProfile')}</TabsTrigger>
          <TabsTrigger value="hours">{t('workingHours')}</TabsTrigger>
          <TabsTrigger value="subscription">{t('subscription')}</TabsTrigger>
          <TabsTrigger value="invite">{t('inviteLink')}</TabsTrigger>
          <TabsTrigger value="policies">{t('policies')}</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <ProfileTab master={master} userId={userId!} onSaved={refetch} />
        </TabsContent>
        <TabsContent value="hours">
          <WorkingHoursTab master={master} onSaved={refetch} />
        </TabsContent>
        <TabsContent value="subscription">
          <SubscriptionTab />
        </TabsContent>
        <TabsContent value="invite">
          <InviteLinkTab master={master} />
        </TabsContent>
        <TabsContent value="policies">
          <PoliciesTab master={master} onSaved={refetch} />
        </TabsContent>
      </Tabs>
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
            <Input value={specialization} onChange={(e) => setSpecialization(e.target.value)} placeholder="Nail artist, Massage therapist..." />
          </div>
          <div className="space-y-2">
            <Label>{tc('required')}: {t('city')}</Label>
            <Input value={city} onChange={(e) => setCity(e.target.value)} />
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
            <Label>{tc('required')}: full_name</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{t('specialization')}: phone</Label>
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

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from('masters').update({ working_hours: hours }).eq('id', master.id);
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
          Current plan: <span className="font-semibold text-foreground capitalize">{tier}</span>
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
