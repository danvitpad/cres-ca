/** --- YAML
 * name: TeamManagementPage
 * description: Salon admin team management — list members (from salon_members + masters), pending invites (from salon_invites),
 *              create new invites via API with role picker, revoke invites, copy invite links.
 * updated: 2026-04-19
 * --- */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Copy, Check, Trash2, UserPlus, Search, Clock, Mail } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { Card, CardContent } from '@/components/ui/card';
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

interface TeamMember {
  id: string;
  role: 'admin' | 'master' | 'receptionist';
  status: string;
  profile: { full_name: string; phone: string | null; avatar_url: string | null } | null;
  master: { specialization: string | null; is_active: boolean } | null;
}

interface PendingInvite {
  id: string;
  code: string;
  role: 'master' | 'receptionist';
  email: string | null;
  phone: string | null;
  telegram_username: string | null;
  expires_at: string;
  used_at: string | null;
  created_at: string;
}

export default function TeamPage() {
  const t = useTranslations('profile');
  const tc = useTranslations('common');
  const { userId, role: authRole } = useAuthStore();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteRole, setInviteRole] = useState<'master' | 'receptionist'>('master');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteBusy, setInviteBusy] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [salonId, setSalonId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const loadTeam = useCallback(async () => {
    if (!userId) return;
    const supabase = createClient();

    const { data: salon } = await supabase
      .from('salons')
      .select('id')
      .eq('owner_id', userId)
      .maybeSingle();

    if (!salon) {
      setLoading(false);
      return;
    }
    setSalonId(salon.id);

    const [{ data: memberRows }, { data: masterRows }, invitesRes] = await Promise.all([
      supabase
        .from('salon_members')
        .select('id, role, status, profile_id, master_id, profile:profiles!salon_members_profile_id_fkey(full_name, phone, avatar_url), master:masters!salon_members_master_id_fkey(specialization, is_active)')
        .eq('salon_id', salon.id)
        .in('status', ['active', 'pending', 'suspended']),
      supabase
        .from('masters')
        .select('id, specialization, is_active, profile_id, profile:profiles!masters_profile_id_fkey(full_name, phone, avatar_url)')
        .eq('salon_id', salon.id),
      fetch(`/api/salon/${salon.id}/invites`).then((r) => (r.ok ? r.json() : { invites: [] })),
    ]);

    const memberByProfile = new Map<string, TeamMember>();
    type MemberRow = {
      id: string;
      role: 'admin' | 'master' | 'receptionist';
      status: string;
      profile_id: string;
      profile: TeamMember['profile'];
      master: TeamMember['master'];
    };
    type MasterRow = {
      id: string;
      specialization: string | null;
      is_active: boolean;
      profile_id: string;
      profile: TeamMember['profile'];
    };
    (memberRows as MemberRow[] | null)?.forEach((row) => {
      memberByProfile.set(row.profile_id, {
        id: row.id,
        role: row.role,
        status: row.status,
        profile: row.profile,
        master: row.master,
      });
    });
    (masterRows as MasterRow[] | null)?.forEach((m) => {
      if (memberByProfile.has(m.profile_id)) return;
      memberByProfile.set(m.profile_id, {
        id: `master:${m.id}`,
        role: 'master',
        status: m.is_active ? 'active' : 'suspended',
        profile: m.profile,
        master: { specialization: m.specialization, is_active: m.is_active },
      });
    });
    setMembers(Array.from(memberByProfile.values()));
    setInvites((invitesRes?.invites as PendingInvite[] | undefined) ?? []);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    loadTeam();
  }, [loadTeam]);

  async function createInvite() {
    if (!salonId) return;
    setInviteBusy(true);
    const res = await fetch(`/api/salon/${salonId}/invites`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: inviteRole, email: inviteEmail || null }),
    });
    const j = (await res.json().catch(() => ({}))) as { invite?: { code: string }; error?: string };
    setInviteBusy(false);
    if (!res.ok || !j.invite) {
      toast.error(j.error ?? 'Не удалось создать приглашение');
      return;
    }
    const url = `${window.location.origin}/invite/${j.invite.code}`;
    await navigator.clipboard.writeText(url).catch(() => {});
    toast.success('Ссылка скопирована — отправьте её мастеру');
    setInviteEmail('');
    setInviteDialogOpen(false);
    loadTeam();
  }

  async function revokeInvite(inviteId: string) {
    if (!salonId) return;
    const res = await fetch(`/api/salon/${salonId}/invites/${inviteId}`, { method: 'DELETE' });
    if (!res.ok) {
      toast.error('Не удалось отозвать');
      return;
    }
    toast.success('Приглашение отозвано');
    loadTeam();
  }

  function copyInviteUrl(code: string) {
    const url = `${window.location.origin}/invite/${code}`;
    navigator.clipboard.writeText(url);
    setCopiedCode(code);
    toast.success(t('copied'));
    setTimeout(() => setCopiedCode((c) => (c === code ? null : c)), 2000);
  }

  async function removeMember(member: TeamMember) {
    if (!salonId) return;
    const supabase = createClient();
    if (member.id.startsWith('master:')) {
      const masterId = member.id.slice('master:'.length);
      await supabase.from('masters').update({ salon_id: null }).eq('id', masterId);
    } else {
      await supabase.from('salon_members').update({ status: 'removed' }).eq('id', member.id);
    }
    toast.success(tc('success'));
    loadTeam();
  }

  if (authRole !== 'salon_admin') {
    return (
      <div className="p-4 text-center text-muted-foreground py-20">
        {t('onlyAdmins')}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
    );
  }

  const pendingInvites = invites.filter((i) => !i.used_at && new Date(i.expires_at).getTime() > Date.now());
  const filteredMembers = members.filter(
    (m) =>
      !search ||
      m.profile?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      m.master?.specialization?.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Users className="size-6 text-primary" />
          {t('team')}
        </h2>
        <Button onClick={() => setInviteDialogOpen(true)} className="gap-1.5">
          <UserPlus className="size-4" />
          {t('addMaster')}
        </Button>
      </div>

      {members.length > 0 && (
        <div className="flex items-center gap-3">
          <div className="flex -space-x-2">
            {members.slice(0, 5).map((m) => (
              <div
                key={m.id}
                className="relative flex size-9 items-center justify-center rounded-full border-2 border-background bg-primary/10 text-primary text-xs font-bold"
                title={m.profile?.full_name}
              >
                {m.profile?.avatar_url ? (
                  <img src={m.profile.avatar_url} alt="" className="size-full rounded-full object-cover" />
                ) : (
                  (m.profile?.full_name || 'M')[0].toUpperCase()
                )}
                <span className={`absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-background ${m.status === 'active' ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`} />
              </div>
            ))}
            {members.length > 5 && (
              <div className="flex size-9 items-center justify-center rounded-full border-2 border-background bg-muted text-[10px] font-medium">
                +{members.length - 5}
              </div>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{members.length} {t('membersCount')}</p>
        </div>
      )}

      {pendingInvites.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
            <Clock className="size-4" /> Ожидают принятия ({pendingInvites.length})
          </h3>
          {pendingInvites.map((inv) => (
            <Card key={inv.id} className="bg-amber-50/40 dark:bg-amber-950/20 border-amber-200/60 dark:border-amber-800/40">
              <CardContent className="py-3 px-4 flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400">
                  <Mail className="size-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {inv.email || inv.phone || inv.telegram_username || 'Без контакта'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {inv.role === 'master' ? 'мастер' : 'администратор'} · истекает {new Date(inv.expires_at).toLocaleDateString('ru-RU')}
                  </div>
                </div>
                <button
                  onClick={() => copyInviteUrl(inv.code)}
                  className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  title={t('copyLink')}
                >
                  {copiedCode === inv.code ? <Check className="size-4 text-emerald-500" /> : <Copy className="size-4" />}
                </button>
                <button
                  onClick={() => revokeInvite(inv.id)}
                  className="p-2 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
                  title="Отозвать"
                >
                  <Trash2 className="size-4" />
                </button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {members.length > 3 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tc('search')}
            className="pl-9 bg-card/50"
          />
        </div>
      )}

      {members.length === 0 && pendingInvites.length === 0 ? (
        <Card className="bg-card/80 backdrop-blur border-border/50">
          <CardContent className="py-12 text-center text-muted-foreground">
            <Users className="size-10 mx-auto mb-3 opacity-40" />
            <p>{t('noMembers')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {filteredMembers.map((member, i) => (
              <motion.div
                key={member.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ delay: i * 0.03 }}
              >
                <Card className="bg-card/80 backdrop-blur border-border/50 transition-all hover:shadow-sm hover:border-border">
                  <CardContent className="py-3 px-4 flex items-center gap-3">
                    <div className="relative">
                      <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary font-bold overflow-hidden">
                        {member.profile?.avatar_url ? (
                          <img src={member.profile.avatar_url} alt="" className="size-full rounded-full object-cover" />
                        ) : (
                          (member.profile?.full_name || 'M')[0].toUpperCase()
                        )}
                      </div>
                      <span className={`absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-card ${member.status === 'active' ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium truncate text-sm">{member.profile?.full_name ?? '—'}</h3>
                      <p className="text-xs text-muted-foreground">
                        {member.role === 'admin' ? 'Администратор' : member.role === 'receptionist' ? 'Ресепшен' : member.master?.specialization || t('noSpecialization')}
                      </p>
                    </div>
                    <Badge variant={member.status === 'active' ? 'default' : 'secondary'} className="text-[10px]">
                      {member.status === 'active' ? t('active') : member.status === 'pending' ? 'Ожидание' : t('inactive')}
                    </Badge>
                    <button
                      onClick={() => removeMember(member)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('addMaster')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">{t('inviteDescription')}</p>

            <div className="space-y-2">
              <Label>Роль</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setInviteRole('master')}
                  className={`h-10 rounded-lg border text-sm font-medium transition-colors ${
                    inviteRole === 'master'
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-card border-border hover:bg-muted'
                  }`}
                >
                  Мастер
                </button>
                <button
                  type="button"
                  onClick={() => setInviteRole('receptionist')}
                  className={`h-10 rounded-lg border text-sm font-medium transition-colors ${
                    inviteRole === 'receptionist'
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-card border-border hover:bg-muted'
                  }`}
                >
                  Ресепшен
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Email (необязательно)</Label>
              <Input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="master@example.com"
              />
              <p className="text-xs text-muted-foreground">
                Сохраняем для справки — ссылку-приглашение отправьте сами.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setInviteDialogOpen(false)}>
                {tc('cancel')}
              </Button>
              <Button className="flex-1" onClick={createInvite} disabled={inviteBusy}>
                {inviteBusy ? '...' : 'Создать и скопировать ссылку'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
