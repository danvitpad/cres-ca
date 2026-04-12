/** --- YAML
 * name: MarketingPage
 * description: Marketing hub — Fresha-style sidebar navigation with section content
 * --- */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Gift,
  Users2,
  Copy,
  Check,
  Plus,
  Trash2,
  Link2,
  UserPlus,
  Star,
  Share2,
  Send,
  Bot,
  Clock,
  Zap,
  StarHalf,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';
import { useSubscription } from '@/hooks/use-subscription';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface Certificate {
  id: string;
  code: string;
  amount: number;
  currency: string;
  is_redeemed: boolean;
  expires_at: string | null;
  created_at: string;
}

interface Guild {
  id: string;
  name: string;
  created_by: string;
  guild_members: { master_id: string; masters: { profile: { full_name: string } } }[];
}

type Section = 'referral' | 'automation' | 'history' | 'certificates' | 'burning' | 'reviews' | 'guilds';

const SIDEBAR_ITEMS: { group: string; groupKey: string; items: { id: Section; icon: typeof Send; labelKey: string }[] }[] = [
  {
    group: 'messaging',
    groupKey: 'sidebarMessaging',
    items: [
      { id: 'referral', icon: Share2, labelKey: 'sidebarReferral' },
      { id: 'automation', icon: Bot, labelKey: 'sidebarAutomation' },
      { id: 'history', icon: Clock, labelKey: 'sidebarHistory' },
    ],
  },
  {
    group: 'promotions',
    groupKey: 'sidebarPromotions',
    items: [
      { id: 'certificates', icon: Gift, labelKey: 'sidebarCertificates' },
      { id: 'burning', icon: Zap, labelKey: 'sidebarBurning' },
    ],
  },
  {
    group: 'engage',
    groupKey: 'sidebarEngage',
    items: [
      { id: 'reviews', icon: StarHalf, labelKey: 'sidebarReviews' },
      { id: 'guilds', icon: Users2, labelKey: 'sidebarGuilds' },
    ],
  },
];

export default function MarketingPage() {
  const tc = useTranslations('common');
  const tm = useTranslations('marketing');
  const { master, loading: masterLoading } = useMaster();
  const { canUse } = useSubscription();

  const [activeSection, setActiveSection] = useState<Section>('referral');
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [loading, setLoading] = useState(true);

  const [certAmount, setCertAmount] = useState('');
  const [certDialogOpen, setCertDialogOpen] = useState(false);
  const [guildName, setGuildName] = useState('');
  const [guildDialogOpen, setGuildDialogOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!master) return;
    setLoading(true);
    const supabase = createClient();

    const { data: certs } = await supabase
      .from('gift_certificates')
      .select('*')
      .order('created_at', { ascending: false });
    setCertificates((certs as Certificate[]) || []);

    const { data: guildData } = await supabase
      .from('guilds')
      .select('id, name, created_by, guild_members(master_id, masters(profile:profiles(full_name)))')
      .order('created_at', { ascending: false });
    setGuilds((guildData as unknown as Guild[]) || []);
    setLoading(false);
  }, [master]);

  useEffect(() => { loadData(); }, [loadData]);

  async function createCertificate() {
    if (!certAmount) return;
    const supabase = createClient();
    const code = `GIFT-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const expires = new Date();
    expires.setFullYear(expires.getFullYear() + 1);
    const { error } = await supabase.from('gift_certificates').insert({
      code, amount: parseFloat(certAmount), currency: 'UAH', expires_at: expires.toISOString(),
    });
    if (error) toast.error(tc('error'));
    else { toast.success(tc('success')); setCertDialogOpen(false); setCertAmount(''); loadData(); }
  }

  async function deleteCertificate(id: string) {
    const supabase = createClient();
    await supabase.from('gift_certificates').delete().eq('id', id);
    loadData();
  }

  async function createGuild() {
    if (!guildName.trim() || !master) return;
    const supabase = createClient();
    const { data: guild, error } = await supabase
      .from('guilds').insert({ name: guildName.trim(), created_by: master.id }).select('id').single();
    if (error || !guild) { toast.error(tc('error')); return; }
    await supabase.from('guild_members').insert({ guild_id: guild.id, master_id: master.id });
    toast.success(tc('success')); setGuildDialogOpen(false); setGuildName(''); loadData();
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success(tc('success'));
    setTimeout(() => setCopiedCode(null), 2000);
  }

  if (masterLoading) {
    return (
      <div className="flex gap-6">
        <Skeleton className="hidden md:block h-[500px] w-56 shrink-0" />
        <div className="flex-1 space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-60" />
        </div>
      </div>
    );
  }

  const isBusiness = canUse('gift_certificates');

  return (
    <div className="flex gap-0 md:gap-6 min-h-[calc(100vh-8rem)]" style={{ padding: '32px 40px' }}>
      {/* Sidebar — desktop */}
      <nav className="hidden md:flex w-56 shrink-0 flex-col border-r border-border/50 pr-4">
        {SIDEBAR_ITEMS.map((group, gi) => (
          <div key={group.group}>
            {gi > 0 && <div className="my-3 border-t border-border/40" />}
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 mb-1.5 px-2">
              {tm(group.groupKey)}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-all',
                    activeSection === item.id
                      ? 'bg-primary/8 text-foreground font-medium'
                      : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                  )}
                >
                  <item.icon className={cn(
                    'size-4 shrink-0',
                    activeSection === item.id ? 'text-primary' : '',
                  )} />
                  {tm(item.labelKey)}
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Mobile tabs — horizontal scroll */}
      <div className="md:hidden fixed top-[3.5rem] left-0 right-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border/40 px-4 py-2 overflow-x-auto scrollbar-none">
        <div className="flex gap-1 w-max">
          {SIDEBAR_ITEMS.flatMap((g) => g.items).map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={cn(
                'flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-all',
                activeSection === item.id
                  ? 'bg-foreground text-background'
                  : 'bg-muted/60 text-muted-foreground',
              )}
            >
              <item.icon className="size-3.5" />
              {tm(item.labelKey)}
            </button>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0 pt-14 md:pt-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
          >
            {activeSection === 'referral' && (
              <ReferralSection master={master} tm={tm} copyCode={copyCode} copiedCode={copiedCode} />
            )}
            {activeSection === 'automation' && (
              <HeroSection
                badge={tm('sidebarMessaging')}
                title={tm('automationTitle')}
                description={tm('automationDesc')}
                bullets={[tm('automationBullet1'), tm('automationBullet2'), tm('automationBullet3')]}
                gradientFrom="from-violet-500/20"
                gradientTo="to-fuchsia-500/20"
              />
            )}
            {activeSection === 'history' && (
              <HeroSection
                badge={tm('sidebarMessaging')}
                title={tm('historyTitle')}
                description={tm('historyDesc')}
                bullets={[tm('historyBullet1'), tm('historyBullet2'), tm('historyBullet3')]}
                gradientFrom="from-blue-500/20"
                gradientTo="to-cyan-500/20"
              />
            )}
            {activeSection === 'certificates' && (
              <CertificatesSection
                isBusiness={isBusiness}
                loading={loading}
                certificates={certificates}
                tm={tm}
                copyCode={copyCode}
                copiedCode={copiedCode}
                onDelete={deleteCertificate}
                onOpenDialog={() => setCertDialogOpen(true)}
              />
            )}
            {activeSection === 'burning' && (
              <HeroSection
                badge={tm('sidebarPromotions')}
                title={tm('burningTitle')}
                description={tm('burningDesc')}
                bullets={[tm('burningBullet1'), tm('burningBullet2'), tm('burningBullet3')]}
                gradientFrom="from-orange-500/20"
                gradientTo="to-rose-500/20"
              />
            )}
            {activeSection === 'reviews' && (
              <HeroSection
                badge={tm('sidebarEngage')}
                title={tm('reviewsTitle')}
                description={tm('reviewsDesc')}
                bullets={[tm('reviewsBullet1'), tm('reviewsBullet2'), tm('reviewsBullet3')]}
                gradientFrom="from-amber-500/20"
                gradientTo="to-yellow-500/20"
              />
            )}
            {activeSection === 'guilds' && (
              <GuildsSection
                isBusiness={isBusiness}
                loading={loading}
                guilds={guilds}
                tm={tm}
                onOpenDialog={() => setGuildDialogOpen(true)}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Certificate dialog */}
      <Dialog open={certDialogOpen} onOpenChange={setCertDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tm('createGiftCertificate')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>{tm('amount')}</Label>
              <Input type="number" min="1" value={certAmount} onChange={(e) => setCertAmount(e.target.value)} placeholder="500" />
            </div>
            <Button onClick={createCertificate} className="w-full">{tc('create')}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Guild dialog */}
      <Dialog open={guildDialogOpen} onOpenChange={setGuildDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tm('createGuild')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>{tm('guildName')}</Label>
              <Input value={guildName} onChange={(e) => setGuildName(e.target.value)} placeholder={tm('guildPlaceholder')} />
            </div>
            <Button onClick={createGuild} className="w-full">{tc('create')}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─── Hero Section (Fresha-style gradient hero for non-interactive pages) ─── */

function HeroSection({ badge, title, description, bullets, gradientFrom, gradientTo }: {
  badge: string;
  title: string;
  description: string;
  bullets: string[];
  gradientFrom: string;
  gradientTo: string;
}) {
  const tc = useTranslations('common');
  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* Gradient background */}
      <div className={cn('absolute inset-0 bg-gradient-to-br', gradientFrom, gradientTo, 'opacity-60')} />
      <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-primary/5 blur-3xl" />
      <div className="absolute -bottom-32 -left-32 h-64 w-64 rounded-full bg-primary/5 blur-3xl" />

      <div className="relative px-8 py-12 md:px-12 md:py-16 max-w-2xl">
        <Badge variant="outline" className="text-[10px] uppercase tracking-wider gap-1 rounded-full px-2.5 mb-4 bg-background/60 backdrop-blur-sm">
          {badge}
        </Badge>

        <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-3">
          {title}
        </h1>

        <p className="text-sm md:text-base text-muted-foreground leading-relaxed mb-6 max-w-lg">
          {description}
        </p>

        <div className="space-y-3 mb-8">
          {bullets.map((bullet, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 + i * 0.08 }}
              className="flex items-start gap-2.5 text-sm"
            >
              <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15 mt-0.5">
                <Check className="size-3 text-primary" />
              </div>
              <span className="text-foreground/80">{bullet}</span>
            </motion.div>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <Button size="sm">{tc('getStarted')}</Button>
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            {tc('learnMore')}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ─── Referral Section ─── */

function ReferralSection({ master, tm, copyCode, copiedCode }: {
  master: { invite_code?: string | null } | null;
  tm: ReturnType<typeof useTranslations>;
  copyCode: (code: string) => void;
  copiedCode: string | null;
}) {
  const inviteUrl = master?.invite_code ? `https://cres-ca.com/invite/${master.invite_code}` : '';
  const tgUrl = master?.invite_code
    ? `https://t.me/${process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'CresCABot'}?start=master_${master.invite_code}`
    : '';

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 opacity-60" />
        <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-emerald-400/10 blur-3xl" />

        <div className="relative px-8 py-12 md:px-12 md:py-16 max-w-2xl">
          <Badge variant="outline" className="text-[10px] uppercase tracking-wider gap-1 rounded-full px-2.5 mb-4 bg-background/60 backdrop-blur-sm">
            <Link2 className="size-3" />
            {tm('referralProgram')}
          </Badge>

          <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-3">
            {tm('inviteAndEarn')}
          </h1>

          <p className="text-sm md:text-base text-muted-foreground leading-relaxed mb-6 max-w-lg">
            {tm('referralDesc')}
          </p>

          <div className="space-y-3 mb-8">
            {[
              { icon: Share2, text: tm('stepShare') },
              { icon: UserPlus, text: tm('stepRegister') },
              { icon: Star, text: tm('stepLinked') },
            ].map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + i * 0.08 }}
                className="flex items-start gap-2.5 text-sm"
              >
                <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 mt-0.5">
                  <step.icon className="size-3 text-emerald-600 dark:text-emerald-400" />
                </div>
                <span className="text-foreground/80">{step.text}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Link cards */}
      {master?.invite_code && (
        <div className="grid gap-3 sm:grid-cols-2">
          <LinkCard
            label={tm('yourInviteLink')}
            value={inviteUrl}
            displayValue={`cres-ca.com/invite/${master.invite_code}`}
            onCopy={() => copyCode(inviteUrl)}
            copied={copiedCode === inviteUrl}
          />
          <LinkCard
            label={tm('telegramLink')}
            value={tgUrl}
            displayValue={`t.me/...?start=master_${master.invite_code}`}
            onCopy={() => copyCode(tgUrl)}
            copied={copiedCode === tgUrl}
          />
        </div>
      )}
    </div>
  );
}

function LinkCard({ label, value, displayValue, onCopy, copied }: {
  label: string; value: string; displayValue: string; onCopy: () => void; copied: boolean;
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-card/80 p-4 space-y-2">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">{label}</p>
      <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-2.5">
        <code className="flex-1 text-xs truncate text-foreground/70">{displayValue}</code>
        <button
          onClick={onCopy}
          className="shrink-0 rounded-md p-1.5 hover:bg-muted transition-colors"
        >
          {copied ? <Check className="size-4 text-emerald-500" /> : <Copy className="size-4 text-muted-foreground" />}
        </button>
      </div>
    </div>
  );
}

/* ─── Certificates Section ─── */

function CertificatesSection({ isBusiness, loading, certificates, tm, copyCode, copiedCode, onDelete, onOpenDialog }: {
  isBusiness: boolean;
  loading: boolean;
  certificates: Certificate[];
  tm: ReturnType<typeof useTranslations>;
  copyCode: (code: string) => void;
  copiedCode: string | null;
  onDelete: (id: string) => void;
  onOpenDialog: () => void;
}) {
  if (!isBusiness) {
    return (
      <HeroSection
        badge={tm('sidebarPromotions')}
        title={tm('certificatesTitle')}
        description={tm('certificatesDesc')}
        bullets={[tm('certificatesBullet1'), tm('certificatesBullet2'), tm('certificatesBullet3')]}
        gradientFrom="from-pink-500/20"
        gradientTo="to-purple-500/20"
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">{tm('certificatesTitle')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{tm('certificatesDesc')}</p>
        </div>
        <Button onClick={onOpenDialog} size="sm" className="gap-1.5">
          <Plus className="size-4" />
          {tm('createCertificate')}
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2"><Skeleton className="h-16" /><Skeleton className="h-16" /></div>
      ) : certificates.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-border/50 py-16 text-center">
          <Gift className="size-10 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-muted-foreground text-sm">{tm('noCertificates')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {certificates.map((cert, i) => (
              <motion.div
                key={cert.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ delay: i * 0.03 }}
                className={cn(
                  'flex items-center justify-between rounded-xl border border-border/50 bg-card/80 px-4 py-3 transition-colors hover:bg-muted/30',
                  cert.is_redeemed && 'opacity-50',
                )}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <code className="text-sm font-mono font-bold">{cert.code}</code>
                    {cert.is_redeemed && (
                      <Badge variant="secondary" className="text-[10px]">{tm('redeemed')}</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {cert.amount} {cert.currency}
                    {cert.expires_at && ` · ${tm('expires', { date: new Date(cert.expires_at).toLocaleDateString() })}`}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => copyCode(cert.code)} className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors">
                    {copiedCode === cert.code ? <Check className="size-4 text-emerald-500" /> : <Copy className="size-4 text-muted-foreground" />}
                  </button>
                  <button onClick={() => onDelete(cert.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors">
                    <Trash2 className="size-4 text-muted-foreground hover:text-red-500" />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

/* ─── Guilds Section ─── */

function GuildsSection({ isBusiness, loading, guilds, tm, onOpenDialog }: {
  isBusiness: boolean;
  loading: boolean;
  guilds: Guild[];
  tm: ReturnType<typeof useTranslations>;
  onOpenDialog: () => void;
}) {
  if (!isBusiness) {
    return (
      <HeroSection
        badge={tm('sidebarEngage')}
        title={tm('guildsTitle')}
        description={tm('guildsDesc')}
        bullets={[tm('guildsBullet1'), tm('guildsBullet2'), tm('guildsBullet3')]}
        gradientFrom="from-indigo-500/20"
        gradientTo="to-blue-500/20"
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">{tm('guildsTitle')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{tm('guildsDesc')}</p>
        </div>
        <Button onClick={onOpenDialog} size="sm" className="gap-1.5">
          <Plus className="size-4" />
          {tm('createGuild')}
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2"><Skeleton className="h-20" /><Skeleton className="h-20" /></div>
      ) : guilds.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-border/50 py-16 text-center">
          <Users2 className="size-10 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-muted-foreground text-sm">{tm('noGuilds')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {guilds.map((guild, i) => (
            <motion.div
              key={guild.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="rounded-xl border border-border/50 bg-card/80 px-4 py-3 hover:bg-muted/30 transition-colors"
            >
              <h3 className="font-semibold text-sm">{guild.name}</h3>
              <div className="flex gap-1.5 mt-2">
                {guild.guild_members?.map((m) => (
                  <Badge key={m.master_id} variant="outline" className="text-xs">
                    {(m.masters?.profile as unknown as { full_name: string })?.full_name || 'Master'}
                  </Badge>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
