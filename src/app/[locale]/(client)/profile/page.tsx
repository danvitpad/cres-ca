/** --- YAML
 * name: ClientProfilePage
 * description: Простой профиль клиента — hero с аватаром, личная информация, статистика, фото до/после.
 * created: 2026-04-12
 * updated: 2026-04-19
 * --- */

'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Camera, Sparkles, Calendar, UserPlus, ImageIcon, ChevronRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
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
  created_at?: string;
  date_of_birth?: string | null;
}

export default function ProfilePage() {
  const t = useTranslations('profile');
  const ta = useTranslations('auth');
  const tc = useTranslations('common');
  const { userId } = useAuthStore();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [dob, setDob] = useState('');
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
        .select('id, full_name, phone, avatar_url, created_at, date_of_birth, bonus_points')
        .eq('id', userId)
        .single();

      const { data: { user } } = await supabase.auth.getUser();

      if (data) {
        setProfile({ ...data, email: user?.email });
        setName(data.full_name || '');
        setPhone(data.phone || '');
        setDob(data.date_of_birth || '');
        setAvatarUrl(data.avatar_url || null);
      }

      const { data: clientRows } = await supabase
        .from('clients')
        .select('id')
        .eq('profile_id', userId);
      const clientIds = (clientRows ?? []).map((c: { id: string }) => c.id);

      let visits = 0;
      if (clientIds.length) {
        const { count } = await supabase
          .from('appointments')
          .select('id', { count: 'exact', head: true })
          .in('client_id', clientIds)
          .eq('status', 'completed');
        visits = count ?? 0;
      }

      const { count: masters } = await supabase
        .from('client_master_links')
        .select('master_id', { count: 'exact', head: true })
        .eq('profile_id', userId);

      setStats({
        visits,
        masters: masters ?? 0,
        bonuses: Number(data?.bonus_points ?? 0),
      });

      setLoading(false);
    }
    load();
  }, [userId]);

  async function saveProfile() {
    if (!userId) return;
    const supabase = createClient();
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: name.trim(),
        phone: phone.trim() || null,
        date_of_birth: dob ? dob : null,
      })
      .eq('id', userId);

    if (error) {
      toast.error(tc('error'));
    } else {
      toast.success(t('profileSaved'));
      setProfile((p) =>
        p
          ? {
              ...p,
              full_name: name.trim(),
              phone: phone.trim() || null,
              date_of_birth: dob || null,
            }
          : p,
      );
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
    const { error: uploadErr } = await supabase.storage
      .from('avatars')
      .upload(path, file, { cacheControl: '3600', upsert: false });
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
    ? new Date(profile.created_at).toLocaleDateString(undefined, {
        month: 'long',
        year: 'numeric',
      })
    : '—';

  return (
    <div className="space-y-8 pb-12">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-[28px] border border-border/60 bg-card shadow-[var(--shadow-card)]"
      >
        <div className="relative h-40 bg-gradient-to-br from-[var(--ds-accent)] via-purple-500 to-pink-500">
          <div className="absolute inset-0 opacity-30 [background:radial-gradient(circle_at_30%_20%,white,transparent_50%)]" />
          <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_80%_60%,white,transparent_40%)]" />
        </div>

        <div className="px-6 pb-6 pt-0 sm:px-8">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-end sm:gap-6">
            <div className="relative -mt-16">
              <div className="flex size-32 items-center justify-center overflow-hidden rounded-full bg-card text-4xl font-bold text-[var(--ds-accent)] ring-4 ring-card shadow-[var(--shadow-elevated)]">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
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

            <div className="flex-1 text-center sm:pb-2 sm:text-left">
              <h1 className="text-2xl font-bold tracking-tight">{name || 'User'}</h1>
              <p className="text-sm text-muted-foreground">
                {profile?.email || phone || ''}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t('memberSince', { date: memberSince })}
              </p>
            </div>

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

          <div className="mt-6 grid grid-cols-3 gap-3 rounded-2xl border border-border/60 bg-background/40 p-4 backdrop-blur-sm">
            <StatCell
              icon={<Calendar className="size-4" />}
              label={t('statsVisits')}
              value={stats.visits}
            />
            <StatCell
              icon={<UserPlus className="size-4" />}
              label={t('statsMasters')}
              value={stats.masters}
            />
            <StatCell
              icon={<Sparkles className="size-4" />}
              label={t('statsBonuses')}
              value={stats.bonuses}
              accent
            />
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="mx-auto max-w-2xl"
      >
        <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-[var(--shadow-card)]">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold">{t('personalInfo')}</h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label={ta('firstName')}
              editing={editing}
              value={firstName}
              onChange={(v) => setName(`${v} ${lastName}`.trim())}
            />
            <Field
              label={ta('lastName')}
              editing={editing}
              value={lastName}
              onChange={(v) => setName(`${firstName} ${v}`.trim())}
            />
            <Field
              label={ta('phone')}
              editing={editing}
              value={phone}
              onChange={setPhone}
              placeholder="+380..."
            />
            <Field label={ta('email')} editing={false} value={profile?.email ?? '—'} onChange={() => {}} />
            <Field
              label={t('birthday')}
              editing={editing}
              type="date"
              value={dob}
              onChange={setDob}
            />
            <Field label={t('gender')} editing={false} value="—" onChange={() => {}} />
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mx-auto max-w-2xl"
      >
        <Link
          href="/profile/photos"
          className="group flex items-center gap-4 rounded-2xl border border-border/60 bg-card p-5 shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-elevated)]"
        >
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[var(--ds-accent)]/10 text-[var(--ds-accent)]">
            <ImageIcon className="size-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold group-hover:text-[var(--ds-accent)]">
              {t('photosTab')}
            </p>
            <p className="truncate text-xs text-muted-foreground">{t('photosDesc')}</p>
          </div>
          <ChevronRight className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </Link>
      </motion.div>
    </div>
  );
}

function StatCell({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={cn(
          'flex items-center gap-1.5 text-xs text-muted-foreground',
          accent && 'text-[var(--ds-accent)]',
        )}
      >
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
  type = 'text',
}: {
  label: string;
  value: string;
  editing: boolean;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: 'text' | 'date';
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      {editing ? (
        <Input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-10"
        />
      ) : (
        <p className="rounded-lg bg-muted/40 px-3 py-2.5 text-sm font-medium">{value || '—'}</p>
      )}
    </div>
  );
}
