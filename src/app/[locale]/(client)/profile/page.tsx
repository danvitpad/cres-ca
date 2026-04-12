/** --- YAML
 * name: ClientProfilePage
 * description: Premium client profile — gradient hero, big avatar, stats row, tabbed content
 * updated: 2026-04-12
 * --- */

'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Camera, MapPin, Plus, Gift, Copy, Check, LogOut, User as UserIcon, Sparkles, Calendar, UserPlus } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface ProfileData {
  id: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  email?: string;
  referral_code?: string;
  created_at?: string;
}

type Tab = 'info' | 'addresses' | 'rewards';

export default function ProfilePage() {
  const t = useTranslations('profile');
  const ta = useTranslations('auth');
  const tc = useTranslations('common');
  const { userId, clearAuth } = useAuthStore();
  const router = useRouter();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('info');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [stats, setStats] = useState({ visits: 0, masters: 0, bonuses: 0 });
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!userId) return;
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, phone, avatar_url, created_at')
        .eq('id', userId)
        .single();

      const { data: { user } } = await supabase.auth.getUser();

      if (data) {
        setProfile({ ...data, email: user?.email, referral_code: userId!.slice(0, 8) });
        setName(data.full_name || '');
        setPhone(data.phone || '');
        setAvatarUrl(data.avatar_url || null);
      }

      // Stats — best-effort, ignore errors
      const [{ count: visits }, { count: masters }, { data: wallet }] = await Promise.all([
        supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('client_id', userId),
        supabase.from('client_master_links').select('id', { count: 'exact', head: true }).eq('client_id', userId),
        supabase.from('client_wallets').select('balance').eq('client_id', userId).maybeSingle(),
      ]);
      setStats({ visits: visits ?? 0, masters: masters ?? 0, bonuses: wallet?.balance ?? 0 });

      setLoading(false);
    }
    load();
  }, [userId]);

  async function saveProfile() {
    if (!userId) return;
    const supabase = createClient();
    const { error } = await supabase.from('profiles').update({
      full_name: name.trim(),
      phone: phone.trim() || null,
    }).eq('id', userId);

    if (error) toast.error(tc('error'));
    else {
      toast.success(t('profileSaved'));
      setProfile((p) => (p ? { ...p, full_name: name.trim(), phone: phone.trim() || null } : p));
      setEditing(false);
    }
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error(tc('error'));
      return;
    }
    setAvatarBusy(true);
    const supabase = createClient();
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${userId}/${Date.now()}.${ext}`;
    const { error: uploadErr } = await supabase.storage.from('avatars').upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    });
    if (uploadErr) {
      toast.error(uploadErr.message);
      setAvatarBusy(false);
      return;
    }
    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
    const newUrl = urlData.publicUrl;
    const { error: updErr } = await supabase
      .from('profiles')
      .update({ avatar_url: newUrl })
      .eq('id', userId);
    if (updErr) {
      toast.error(updErr.message);
    } else {
      setAvatarUrl(newUrl);
      setProfile((p) => (p ? { ...p, avatar_url: newUrl } : p));
      toast.success(t('profileSaved'));
    }
    setAvatarBusy(false);
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    clearAuth();
    router.push('/');
  }

  function copyReferralLink() {
    const link = `${window.location.origin}/register?ref=${profile?.referral_code}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success(t('copied'));
    setTimeout(() => setCopied(false), 2000);
  }

  const firstName = name.split(' ')[0] || '';
  const lastName = name.split(' ').slice(1).join(' ') || '';

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-48 w-full rounded-3xl" />
        <Skeleton className="h-60 rounded-2xl" />
      </div>
    );
  }

  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    : '—';

  return (
    <div className="space-y-8 pb-12">
      {/* Hero — gradient cover with avatar overlap */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-[28px] border border-border/60 bg-card shadow-[var(--shadow-card)]"
      >
        {/* Gradient cover */}
        <div className="relative h-40 bg-gradient-to-br from-[var(--ds-accent)] via-purple-500 to-pink-500">
          <div className="absolute inset-0 opacity-30 [background:radial-gradient(circle_at_30%_20%,white,transparent_50%)]" />
          <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_80%_60%,white,transparent_40%)]" />
        </div>

        {/* Content row */}
        <div className="px-6 pb-6 pt-0 sm:px-8">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-end sm:gap-6">
            {/* Avatar */}
            <div className="relative -mt-16">
              <div className="flex size-32 items-center justify-center overflow-hidden rounded-full bg-card text-4xl font-bold text-[var(--ds-accent)] ring-4 ring-card shadow-[var(--shadow-elevated)]">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={name} className="size-full object-cover" />
                ) : (
                  (name || 'U')[0].toUpperCase()
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarBusy}
                className="absolute bottom-1 right-1 flex size-9 items-center justify-center rounded-full bg-foreground text-background shadow-md transition-transform hover:scale-110 disabled:opacity-50"
              >
                <Camera className="size-4" />
              </button>
            </div>

            {/* Name + meta */}
            <div className="flex-1 text-center sm:pb-2 sm:text-left">
              <h1 className="text-2xl font-bold tracking-tight">{name || 'User'}</h1>
              <p className="text-sm text-muted-foreground">{profile?.email || phone || ''}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t('memberSince', { date: memberSince })}</p>
            </div>

            {/* Edit button */}
            <div className="sm:pb-2">
              {editing ? (
                <div className="flex gap-2">
                  <Button size="sm" onClick={saveProfile}>
                    {tc('save')}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
                    {tc('cancel')}
                  </Button>
                </div>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                  {tc('edit')}
                </Button>
              )}
            </div>
          </div>

          {/* Stats row */}
          <div className="mt-6 grid grid-cols-3 gap-3 rounded-2xl border border-border/60 bg-background/40 p-4 backdrop-blur-sm">
            <StatCell icon={<Calendar className="size-4" />} label={t('statsVisits')} value={stats.visits} />
            <StatCell icon={<UserPlus className="size-4" />} label={t('statsMasters')} value={stats.masters} />
            <StatCell icon={<Sparkles className="size-4" />} label={t('statsBonuses')} value={stats.bonuses} accent />
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-full border border-border/60 bg-card p-1 w-fit mx-auto">
        {(['info', 'addresses', 'rewards'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'rounded-full px-5 py-2 text-sm font-medium transition-all',
              activeTab === tab
                ? 'bg-foreground text-background shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t(tab === 'info' ? 'personalInfo' : tab === 'addresses' ? 'addresses' : 'rewards')}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="mx-auto max-w-2xl"
      >
        {activeTab === 'info' && (
          <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-[var(--shadow-card)]">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label={ta('firstName')} editing={editing} value={firstName} onChange={(v) => setName(`${v} ${lastName}`.trim())} />
              <Field label={ta('lastName')} editing={editing} value={lastName} onChange={(v) => setName(`${firstName} ${v}`.trim())} />
              <Field label={ta('phone')} editing={editing} value={phone} onChange={setPhone} placeholder="+380..." />
              <Field label={ta('email')} editing={false} value={profile?.email ?? '—'} onChange={() => {}} />
              <Field label={t('birthday')} editing={false} value="—" onChange={() => {}} />
              <Field label={t('gender')} editing={false} value="—" onChange={() => {}} />
            </div>
          </div>
        )}

        {activeTab === 'addresses' && (
          <div className="space-y-3 rounded-2xl border border-border/60 bg-card p-6 shadow-[var(--shadow-card)]">
            <AddressRow icon={<MapPin className="size-4" />} title={t('homeAddress')} hint={t('addHomeAddress')} />
            <AddressRow icon={<MapPin className="size-4" />} title={t('workAddress')} hint={t('addWorkAddress')} />
            <button className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border py-3 text-sm text-muted-foreground transition-colors hover:border-[var(--ds-accent)] hover:text-foreground">
              <Plus className="size-4" />
              {tc('create')}
            </button>
          </div>
        )}

        {activeTab === 'rewards' && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-amber-400/10 via-pink-500/10 to-purple-500/10 p-6 shadow-[var(--shadow-card)]">
              <div className="flex items-center gap-3">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-pink-500 text-white shadow-md">
                  <Gift className="size-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold">{t('referralProgram')}</h3>
                  <p className="text-xs text-muted-foreground">{t('referralDesc')}</p>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <Input
                  readOnly
                  value={`${typeof window !== 'undefined' ? window.location.origin : ''}/register?ref=${profile?.referral_code}`}
                  className="h-10 text-xs"
                />
                <Button variant="outline" size="sm" onClick={copyReferralLink} className="shrink-0 gap-1.5 h-10">
                  {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                </Button>
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {/* Sign out */}
      <div className="mx-auto max-w-2xl">
        <Button
          variant="ghost"
          onClick={handleSignOut}
          className="w-full gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="size-4" />
          {ta('signOut')}
        </Button>
      </div>
    </div>
  );
}

function StatCell({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: number; accent?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={cn('flex items-center gap-1.5 text-xs text-muted-foreground', accent && 'text-[var(--ds-accent)]')}>
        {icon}
        {label}
      </div>
      <p className="text-xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

function Field({
  label,
  value,
  editing,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  editing: boolean;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      {editing ? (
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-10" />
      ) : (
        <p className="rounded-lg bg-muted/40 px-3 py-2.5 text-sm font-medium">{value || '—'}</p>
      )}
    </div>
  );
}

function AddressRow({ icon, title, hint }: { icon: React.ReactNode; title: string; hint: string }) {
  return (
    <button className="flex w-full items-center gap-3 rounded-xl border border-border/60 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-[var(--ds-accent)]/40 hover:shadow-sm">
      <div className="flex size-10 items-center justify-center rounded-xl bg-[var(--ds-accent)]/10 text-[var(--ds-accent)]">
        {icon}
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <Plus className="size-4 text-muted-foreground" />
    </button>
  );
}
