/** --- YAML
 * name: ClientProfilePage
 * description: Fresha-style client profile — avatar, personal info fields, addresses section
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Camera, MapPin, Plus, Gift, Copy, Check, LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';

interface ProfileData {
  id: string;
  full_name: string;
  phone: string | null;
  email?: string;
  referral_code?: string;
}

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
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    if (!userId) return;
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, phone')
        .eq('id', userId)
        .single();

      const { data: { user } } = await supabase.auth.getUser();

      if (data) {
        setProfile({ ...data, email: user?.email, referral_code: userId!.slice(0, 8) });
        setName(data.full_name || '');
        setPhone(data.phone || '');
      }
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
      setProfile((p) => p ? { ...p, full_name: name.trim(), phone: phone.trim() || null } : p);
      setEditing(false);
    }
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
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-60" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page heading */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">{t('editProfile')}</h1>
        {!editing && (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            {tc('edit')}
          </Button>
        )}
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        {/* Left — personal info */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          {/* Avatar */}
          <div className="flex flex-col items-center gap-3 mb-8">
            <div className="relative">
              <div className="flex size-24 items-center justify-center rounded-full bg-primary text-primary-foreground text-3xl font-bold">
                {(name || 'U')[0].toUpperCase()}
              </div>
              <button className="absolute bottom-0 right-0 flex size-8 items-center justify-center rounded-full bg-card border shadow-sm text-muted-foreground hover:text-foreground transition-colors">
                <Camera className="size-4" />
              </button>
            </div>
            <p className="text-lg font-medium">{name || 'User'}</p>
          </div>

          <Separator className="mb-6" />

          {/* Info fields */}
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{ta('firstName')}</Label>
                {editing ? (
                  <Input
                    value={firstName}
                    onChange={(e) => setName(`${e.target.value} ${lastName}`.trim())}
                    className="h-10"
                  />
                ) : (
                  <p className="text-sm font-medium py-2">{firstName || '—'}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{ta('lastName')}</Label>
                {editing ? (
                  <Input
                    value={lastName}
                    onChange={(e) => setName(`${firstName} ${e.target.value}`.trim())}
                    className="h-10"
                  />
                ) : (
                  <p className="text-sm font-medium py-2">{lastName || '—'}</p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{ta('phone')}</Label>
              {editing ? (
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+380..." className="h-10" />
              ) : (
                <p className="text-sm font-medium py-2">{phone || '—'}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{ta('email')}</Label>
              <p className="text-sm font-medium py-2">{profile?.email || '—'}</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{t('birthday')}</Label>
              <p className="text-sm font-medium py-2">—</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{t('gender')}</Label>
              <p className="text-sm font-medium py-2">—</p>
            </div>

            {editing && (
              <div className="flex gap-3 pt-2">
                <Button onClick={saveProfile} className="flex-1">{tc('save')}</Button>
                <Button variant="outline" onClick={() => setEditing(false)}>{tc('cancel')}</Button>
              </div>
            )}
          </div>
        </motion.div>

        {/* Right — addresses + referral */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-6"
        >
          {/* Addresses */}
          <div className="rounded-xl border bg-card p-5">
            <h3 className="text-sm font-semibold mb-4">{t('myAddresses')}</h3>
            <div className="space-y-3">
              <button className="flex w-full items-center gap-3 rounded-lg border border-dashed p-3 text-sm text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors">
                <div className="flex size-9 items-center justify-center rounded-full bg-muted">
                  <MapPin className="size-4" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-foreground">{t('homeAddress')}</p>
                  <p className="text-xs">{t('addHomeAddress')}</p>
                </div>
              </button>
              <button className="flex w-full items-center gap-3 rounded-lg border border-dashed p-3 text-sm text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors">
                <div className="flex size-9 items-center justify-center rounded-full bg-muted">
                  <MapPin className="size-4" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-foreground">{t('workAddress')}</p>
                  <p className="text-xs">{t('addWorkAddress')}</p>
                </div>
              </button>
              <button className="flex w-full items-center gap-3 rounded-lg p-3 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <Plus className="size-4" />
                <span>{tc('create')}</span>
              </button>
            </div>
          </div>

          {/* Referral */}
          <div className="rounded-xl border bg-card p-5">
            <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
              <Gift className="size-4 text-primary" />
              {t('referralProgram')}
            </h3>
            <p className="text-xs text-muted-foreground mb-3">
              {t('referralDesc')}
            </p>
            <div className="flex gap-2">
              <Input
                readOnly
                value={`${typeof window !== 'undefined' ? window.location.origin : ''}/register?ref=${profile?.referral_code}`}
                className="text-xs h-9"
              />
              <Button variant="outline" size="sm" onClick={copyReferralLink} className="shrink-0 gap-1.5 h-9">
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              </Button>
            </div>
          </div>

          {/* Sign out */}
          <Button
            variant="ghost"
            onClick={handleSignOut}
            className="w-full gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <LogOut className="size-4" />
            {ta('signOut')}
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
