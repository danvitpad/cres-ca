/** --- YAML
 * name: TeamManagementPage
 * description: Salon admin team management — invite masters, manage team members
 * --- */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Plus, Copy, Check, Trash2, Mail, UserPlus, Search } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
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

interface TeamMember {
  id: string;
  specialization: string | null;
  is_active: boolean;
  invite_code: string | null;
  profile: { full_name: string; phone: string | null; avatar_url: string | null };
}

export default function TeamPage() {
  const t = useTranslations('profile');
  const tc = useTranslations('common');
  const { userId, role } = useAuthStore();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [copied, setCopied] = useState(false);
  const [salonId, setSalonId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const loadTeam = useCallback(async () => {
    if (!userId) return;
    const supabase = createClient();

    // Get salon
    const { data: salon } = await supabase
      .from('salons')
      .select('id')
      .eq('owner_id', userId)
      .single();

    if (!salon) { setLoading(false); return; }
    setSalonId(salon.id);

    const { data } = await supabase
      .from('masters')
      .select('id, specialization, is_active, invite_code, profile:profiles(full_name, phone, avatar_url)')
      .eq('salon_id', salon.id)
      .order('created_at');

    setMembers((data as unknown as TeamMember[]) || []);
    setLoading(false);
  }, [userId]);

  useEffect(() => { loadTeam(); }, [loadTeam]);

  async function removeMember(masterId: string) {
    const supabase = createClient();
    await supabase.from('masters').update({ salon_id: null }).eq('id', masterId);
    toast.success(tc('success'));
    loadTeam();
  }

  function copyInviteLink() {
    if (!salonId) return;
    navigator.clipboard.writeText(`${window.location.origin}/register?salon=${salonId}`);
    setCopied(true);
    toast.success(t('copied'));
    setTimeout(() => setCopied(false), 2000);
  }

  if (role !== 'salon_admin') {
    return (
      <div className="p-4 text-center text-muted-foreground py-20">
        Only salon administrators can manage teams.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-20" /><Skeleton className="h-20" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Users className="size-6 text-primary" />
          {t('team')}
        </h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={copyInviteLink} className="gap-1.5">
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {t('inviteLink')}
          </Button>
          <Button onClick={() => setInviteDialogOpen(true)} className="gap-1.5">
            <UserPlus className="size-4" />
            {t('addMaster')}
          </Button>
        </div>
      </div>

      {/* Stacked avatars overview */}
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
                <span className={`absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-background ${m.is_active ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`} />
              </div>
            ))}
            {members.length > 5 && (
              <div className="flex size-9 items-center justify-center rounded-full border-2 border-background bg-muted text-[10px] font-medium">
                +{members.length - 5}
              </div>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{members.length} members</p>
        </div>
      )}

      {/* Search */}
      {members.length > 3 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search team..."
            className="pl-9 bg-card/50"
          />
        </div>
      )}

      {members.length === 0 ? (
        <Card className="bg-card/80 backdrop-blur border-border/50">
          <CardContent className="py-12 text-center text-muted-foreground">
            <Users className="size-10 mx-auto mb-3 opacity-40" />
            <p>No team members yet. Invite masters to join your salon!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {members
              .filter((m) => !search || m.profile?.full_name?.toLowerCase().includes(search.toLowerCase()) || m.specialization?.toLowerCase().includes(search.toLowerCase()))
              .map((member, i) => (
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
                      <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">
                        {member.profile?.avatar_url ? (
                          <img src={member.profile.avatar_url} alt="" className="size-full rounded-full object-cover" />
                        ) : (
                          (member.profile?.full_name || 'M')[0].toUpperCase()
                        )}
                      </div>
                      <span className={`absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-card ${member.is_active ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium truncate text-sm">{member.profile?.full_name}</h3>
                      <p className="text-xs text-muted-foreground">{member.specialization || 'No specialization'}</p>
                    </div>
                    <Badge variant={member.is_active ? 'default' : 'secondary'} className="text-[10px]">
                      {member.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                    <button
                      onClick={() => removeMember(member.id)}
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

      {/* Invite dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('addMaster')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              Share the invite link below. When a master registers using this link, they'll automatically join your salon.
            </p>
            <div className="space-y-2">
              <Label>{t('inviteLink')}</Label>
              <div className="flex gap-2">
                <Input readOnly value={`${typeof window !== 'undefined' ? window.location.origin : ''}/register?salon=${salonId}`} className="text-xs" />
                <Button variant="outline" onClick={copyInviteLink}>{t('copyLink')}</Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
