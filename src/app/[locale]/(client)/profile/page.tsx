/** --- YAML
 * name: ClientProfilePage
 * description: Client profile with personal info, referral link, and linked masters
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { User, Copy, Check, Gift, Star, LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

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
    else toast.success(t('profileSaved'));
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    clearAuth();
    router.push('/login');
  }

  function copyReferralLink() {
    const link = `${window.location.origin}/register?ref=${profile?.referral_code}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success(t('copied'));
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="p-4 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6 max-w-lg mx-auto">
      <h2 className="text-2xl font-bold tracking-tight">{t('editProfile')}</h2>

      {/* Profile form */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="bg-card/80 backdrop-blur border-border/50">
          <CardContent className="pt-5 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xl">
                {(name || 'U')[0].toUpperCase()}
              </div>
              <div>
                <h3 className="font-semibold">{name || 'User'}</h3>
                <p className="text-sm text-muted-foreground">{profile?.email}</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{ta('fullName')}</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{ta('phone')}</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+380..." />
            </div>
            <Button onClick={saveProfile} className="w-full">{tc('save')}</Button>
          </CardContent>
        </Card>
      </motion.div>

      {/* Referral section */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className="bg-card/80 backdrop-blur border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Gift className="size-4 text-primary" />
              Referral Program
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Share your referral link and earn bonus points when friends sign up!
            </p>
            <div className="flex gap-2">
              <Input
                readOnly
                value={`${typeof window !== 'undefined' ? window.location.origin : ''}/register?ref=${profile?.referral_code}`}
                className="text-xs"
              />
              <Button variant="outline" size="sm" onClick={copyReferralLink} className="shrink-0 gap-1.5">
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copied ? t('copied') : t('copyLink')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Sign out */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Button variant="outline" onClick={handleSignOut} className="w-full gap-2 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20">
          <LogOut className="size-4" />
          {ta('signOut')}
        </Button>
      </motion.div>
    </div>
  );
}
