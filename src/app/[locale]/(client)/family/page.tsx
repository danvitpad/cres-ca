/** --- YAML
 * name: ClientFamilyPage
 * description: Семья клиента — CRUD членов семьи (name, relationship), кнопка "Записать" (deep-link в /book?for=<id>), общий семейный бюджет rollup. Top-level /family (бывший /profile/family).
 * created: 2026-04-19
 * updated: 2026-04-19
 * --- */

'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Users, Wallet, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { useConfirm } from '@/hooks/use-confirm';
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/shared/primitives/empty-state';
import { ShimmerSkeleton } from '@/components/shared/primitives/shimmer-skeleton';
import { humanizeError } from '@/lib/format/error';

interface FamilyMember {
  id: string;
  member_name: string;
  relationship: string;
  linked_profile_id: string | null;
}

interface BudgetRow {
  family_link_id: string | null;
  total_spent: number;
}

const relationships = ['child', 'spouse', 'parent', 'other'] as const;

export default function ClientFamilyPage() {
  const t = useTranslations('family');
  const { userId } = useAuthStore();
  const confirm = useConfirm();
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [budgetByMember, setBudgetByMember] = useState<Map<string | null, number>>(new Map());
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

    const { data: budgetRows } = await supabase
      .from('clients')
      .select('family_link_id, total_spent')
      .eq('profile_id', userId);
    if (budgetRows) {
      const map = new Map<string | null, number>();
      for (const row of budgetRows as unknown as BudgetRow[]) {
        const k = row.family_link_id;
        map.set(k, (map.get(k) ?? 0) + Number(row.total_spent ?? 0));
      }
      setBudgetByMember(map);
    }

    setLoading(false);
  }, [userId]);

  const totalBudget = Array.from(budgetByMember.values()).reduce((s, v) => s + v, 0);

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
      toast.error(humanizeError(error));
    } else {
      toast.success(t('added'));
      setName('');
      setShowForm(false);
      fetchMembers();
    }
  }

  async function handleRemove(member: FamilyMember) {
    const ok = await confirm({
      title: t('confirmRemoveTitle'),
      description: t('confirmRemoveDesc', { name: member.member_name }),
      confirmLabel: t('remove'),
      destructive: true,
    });
    if (!ok) return;

    const supabase = createClient();
    const { error } = await supabase.from('family_links').delete().eq('id', member.id);
    if (error) {
      toast.error(humanizeError(error));
      return;
    }
    toast.success(t('removed'));
    fetchMembers();
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <ShimmerSkeleton className="h-9 w-56" />
        <ShimmerSkeleton className="h-20 w-full" rounded="lg" />
        <ShimmerSkeleton className="h-20 w-full" rounded="lg" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-[var(--radius-button)] bg-[var(--ds-accent)] px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--ds-accent-hover)]"
        >
          <Plus className="size-4" />
          {t('addMember')}
        </button>
      </div>

      {/* Family budget rollup */}
      <div className="flex items-center gap-3 rounded-[var(--radius-card)] border bg-[var(--ds-accent-soft)] p-4">
        <div className="flex size-10 items-center justify-center rounded-full bg-[var(--ds-accent)] text-white">
          <Wallet className="size-5" />
        </div>
        <div className="flex-1">
          <p className="text-xs text-muted-foreground">{t('totalBudget')}</p>
          <p className="text-lg font-semibold">{totalBudget.toFixed(0)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">{t('myBudget')}</p>
          <p className="text-sm font-medium">{(budgetByMember.get(null) ?? 0).toFixed(0)}</p>
        </div>
      </div>

      {/* Add form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="space-y-3 rounded-[var(--radius-card)] border bg-card p-4">
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
          icon={<Users className="size-7" />}
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
                <div className="flex size-10 items-center justify-center rounded-full bg-[var(--ds-accent-soft)] text-sm font-semibold text-[var(--ds-accent)]">
                  {member.member_name[0]?.toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{member.member_name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {t(member.relationship as 'child')} · {t('spent')}: {(budgetByMember.get(member.id) ?? 0).toFixed(0)}
                  </p>
                </div>
                <Link
                  href={`/book?for=${member.id}`}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-[var(--radius-button)] bg-[var(--ds-accent)] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[var(--ds-accent-hover)]"
                >
                  <Calendar className="size-3.5" />
                  {t('book')}
                </Link>
                <button
                  onClick={() => handleRemove(member)}
                  aria-label={t('remove')}
                  className="shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}
