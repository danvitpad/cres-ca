/** --- YAML
 * name: FamilyPage
 * description: Manage family members for booking on their behalf (Pro+ tier feature)
 * --- */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/shared/primitives/empty-state';
import { ShimmerSkeleton } from '@/components/shared/primitives/shimmer-skeleton';

interface FamilyMember {
  id: string;
  member_name: string;
  relationship: string;
  linked_profile_id: string | null;
}

const relationships = ['child', 'spouse', 'parent', 'other'] as const;

export default function FamilyPage() {
  const t = useTranslations('family');
  const { userId } = useAuthStore();
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState<string>('child');

  const fetchMembers = useCallback(async () => {
    if (!userId) return;
    const supabase = createClient();
    const { data } = await supabase
      .from('family_links')
      .select('*')
      .eq('parent_profile_id', userId)
      .order('created_at');
    setMembers((data ?? []) as FamilyMember[]);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  async function handleAdd() {
    if (!name.trim() || !userId) return;
    const supabase = createClient();
    const { error } = await supabase.from('family_links').insert({
      parent_profile_id: userId,
      member_name: name.trim(),
      relationship,
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(t('added'));
      setName('');
      setShowForm(false);
      fetchMembers();
    }
  }

  async function handleRemove(id: string) {
    const supabase = createClient();
    await supabase.from('family_links').delete().eq('id', id);
    toast.success(t('removed'));
    fetchMembers();
  }

  if (loading) {
    return (
      <div className="p-[var(--space-page)] space-y-3">
        <ShimmerSkeleton className="h-8 w-48" />
        <ShimmerSkeleton className="h-16 w-full" rounded="lg" />
        <ShimmerSkeleton className="h-16 w-full" rounded="lg" />
      </div>
    );
  }

  return (
    <div className="p-[var(--space-page)]">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">{t('title')}</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-1.5 rounded-[var(--radius-button)] bg-[var(--ds-accent)] px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--ds-accent-hover)]"
        >
          <Plus className="h-4 w-4" />
          {t('addMember')}
        </button>
      </div>

      {/* Add form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mb-4"
          >
            <div className="rounded-[var(--radius-card)] border bg-card p-4 space-y-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium">{t('name')}</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">{t('relationship')}</label>
                <div className="flex flex-wrap gap-2">
                  {relationships.map((rel) => (
                    <button
                      key={rel}
                      onClick={() => setRelationship(rel)}
                      className={cn(
                        'rounded-full px-3 py-1.5 text-sm transition-colors',
                        relationship === rel
                          ? 'bg-[var(--ds-accent)] text-white'
                          : 'border bg-background hover:bg-muted',
                      )}
                    >
                      {t(rel)}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={handleAdd}
                disabled={!name.trim()}
                className="rounded-[var(--radius-button)] bg-[var(--ds-accent)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--ds-accent-hover)] disabled:opacity-50"
              >
                {t('addMember')}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Members list */}
      {members.length === 0 ? (
        <EmptyState
          icon={<Users className="h-7 w-7" />}
          title={t('empty')}
          description={t('emptyDescription')}
        />
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {members.map((member) => (
              <motion.div
                key={member.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex items-center gap-3 rounded-[var(--radius-card)] border bg-card p-3"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--ds-accent-soft)] text-[var(--ds-accent)] font-semibold text-sm">
                  {member.member_name[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{member.member_name}</p>
                  <p className="text-xs text-muted-foreground">{t(member.relationship as 'child')}</p>
                </div>
                <button
                  onClick={() => handleRemove(member.id)}
                  className="shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
