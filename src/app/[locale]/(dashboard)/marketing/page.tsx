/** --- YAML
 * name: MarketingPage
 * description: Marketing hub — gift certificates, guild cross-marketing, referral stats
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
  Megaphone,
  TicketPercent,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';
import { useSubscription } from '@/hooks/use-subscription';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';

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

export default function MarketingPage() {
  const td = useTranslations('dashboard');
  const tc = useTranslations('common');
  const tp = useTranslations('pricing');
  const { master, loading: masterLoading } = useMaster();
  const { canUse } = useSubscription();

  const [tab, setTab] = useState<'certificates' | 'guilds'>('certificates');
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [loading, setLoading] = useState(true);

  // Certificate form
  const [certAmount, setCertAmount] = useState('');
  const [certDialogOpen, setCertDialogOpen] = useState(false);

  // Guild form
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
      code,
      amount: parseFloat(certAmount),
      currency: 'UAH',
      expires_at: expires.toISOString(),
    });

    if (error) toast.error(tc('error'));
    else {
      toast.success(tc('success'));
      setCertDialogOpen(false);
      setCertAmount('');
      loadData();
    }
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
      .from('guilds')
      .insert({ name: guildName.trim(), created_by: master.id })
      .select('id')
      .single();

    if (error || !guild) { toast.error(tc('error')); return; }

    // Add self as member
    await supabase.from('guild_members').insert({ guild_id: guild.id, master_id: master.id });

    toast.success(tc('success'));
    setGuildDialogOpen(false);
    setGuildName('');
    loadData();
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success(tc('success'));
    setTimeout(() => setCopiedCode(null), 2000);
  }

  if (masterLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  const isBusiness = canUse('gift_certificates');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Megaphone className="size-6 text-primary" />
          {td('marketing')}
        </h2>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-muted/50 p-1 w-fit">
        <button
          onClick={() => setTab('certificates')}
          className={cn(
            'px-4 py-1.5 text-sm font-medium rounded-lg transition-all flex items-center gap-1.5',
            tab === 'certificates' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Gift className="size-4" />
          {tp('giftCertificates')}
        </button>
        <button
          onClick={() => setTab('guilds')}
          className={cn(
            'px-4 py-1.5 text-sm font-medium rounded-lg transition-all flex items-center gap-1.5',
            tab === 'guilds' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Users2 className="size-4" />
          {tp('crossMarketing')}
        </button>
      </div>

      {!isBusiness ? (
        <Card className="bg-card/80 backdrop-blur border-border/50">
          <CardContent className="py-12 text-center">
            <TicketPercent className="size-10 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-muted-foreground mb-4">This feature requires Business plan</p>
            <Link href="/settings" className={cn(buttonVariants({ variant: 'outline' }))}>Upgrade</Link>
          </CardContent>
        </Card>
      ) : tab === 'certificates' ? (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setCertDialogOpen(true)} className="gap-1.5">
              <Plus className="size-4" />
              Create Certificate
            </Button>
          </div>

          {loading ? (
            <div className="space-y-2"><Skeleton className="h-16" /><Skeleton className="h-16" /></div>
          ) : certificates.length === 0 ? (
            <Card className="bg-card/80 backdrop-blur border-border/50">
              <CardContent className="py-12 text-center text-muted-foreground">
                <Gift className="size-10 mx-auto mb-3 opacity-40" />
                <p>No gift certificates yet</p>
              </CardContent>
            </Card>
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
                  >
                    <Card className={cn(
                      'bg-card/80 backdrop-blur border-border/50',
                      cert.is_redeemed && 'opacity-60',
                    )}>
                      <CardContent className="py-3 px-4 flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <code className="text-sm font-mono font-bold">{cert.code}</code>
                            {cert.is_redeemed && <Badge variant="secondary" className="text-[10px]">Redeemed</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {cert.amount} {cert.currency}
                            {cert.expires_at && ` · Expires ${new Date(cert.expires_at).toLocaleDateString()}`}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => copyCode(cert.code)} className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors">
                            {copiedCode === cert.code ? <Check className="size-4 text-emerald-500" /> : <Copy className="size-4 text-muted-foreground" />}
                          </button>
                          <button onClick={() => deleteCertificate(cert.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors">
                            <Trash2 className="size-4 text-muted-foreground hover:text-red-500" />
                          </button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setGuildDialogOpen(true)} className="gap-1.5">
              <Plus className="size-4" />
              Create Guild
            </Button>
          </div>

          {loading ? (
            <div className="space-y-2"><Skeleton className="h-20" /><Skeleton className="h-20" /></div>
          ) : guilds.length === 0 ? (
            <Card className="bg-card/80 backdrop-blur border-border/50">
              <CardContent className="py-12 text-center text-muted-foreground">
                <Users2 className="size-10 mx-auto mb-3 opacity-40" />
                <p>No guilds yet. Create one and invite other masters!</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {guilds.map((guild) => (
                <Card key={guild.id} className="bg-card/80 backdrop-blur border-border/50">
                  <CardContent className="py-3 px-4">
                    <h3 className="font-semibold">{guild.name}</h3>
                    <div className="flex gap-1.5 mt-2">
                      {guild.guild_members?.map((m) => (
                        <Badge key={m.master_id} variant="outline" className="text-xs">
                          {(m.masters?.profile as unknown as { full_name: string })?.full_name || 'Master'}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Certificate dialog */}
      <Dialog open={certDialogOpen} onOpenChange={setCertDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Gift Certificate</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Amount (UAH)</Label>
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
            <DialogTitle>Create Guild</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Guild Name</Label>
              <Input value={guildName} onChange={(e) => setGuildName(e.target.value)} placeholder="Beauty Alliance..." />
            </div>
            <Button onClick={createGuild} className="w-full">{tc('create')}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
