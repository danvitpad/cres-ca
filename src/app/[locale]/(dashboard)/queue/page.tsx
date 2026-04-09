/** --- YAML
 * name: QueuePage
 * description: Master live queue management for walk-in clients
 * --- */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Play, Check, X, Clock, Users } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/shared/primitives/empty-state';

interface QueueEntry {
  id: string;
  client_name: string | null;
  position: number;
  status: string;
  estimated_start: string | null;
  joined_at: string;
  started_at: string | null;
  service: { name: string } | null;
  client: { full_name: string } | null;
}

export default function QueuePage() {
  const t = useTranslations('queue');
  const { master } = useMaster();
  const [entries, setEntries] = useState<QueueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [walkInName, setWalkInName] = useState('');

  const fetchQueue = useCallback(async () => {
    if (!master) return;
    const supabase = createClient();
    const { data } = await supabase
      .from('queue_entries')
      .select('*, service:services(name), client:clients(full_name)')
      .eq('master_id', master.id)
      .in('status', ['waiting', 'in_service'])
      .order('position');
    setEntries((data ?? []) as unknown as QueueEntry[]);
    setLoading(false);
  }, [master]);

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, 15000);
    return () => clearInterval(interval);
  }, [fetchQueue]);

  async function addWalkIn() {
    if (!walkInName.trim() || !master) return;
    const supabase = createClient();
    const maxPos = entries.reduce((max, e) => Math.max(max, e.position), 0);
    await supabase.from('queue_entries').insert({
      master_id: master.id,
      client_name: walkInName.trim(),
      position: maxPos + 1,
      status: 'waiting',
    });
    setWalkInName('');
    setShowAddForm(false);
    fetchQueue();
  }

  async function startNext() {
    const nextWaiting = entries.find((e) => e.status === 'waiting');
    if (!nextWaiting) return;
    const supabase = createClient();
    await supabase
      .from('queue_entries')
      .update({ status: 'in_service', started_at: new Date().toISOString() })
      .eq('id', nextWaiting.id);
    fetchQueue();
  }

  async function updateStatus(id: string, status: string) {
    const supabase = createClient();
    const update: Record<string, unknown> = { status };
    if (status === 'completed' || status === 'cancelled') {
      update.completed_at = new Date().toISOString();
    }
    await supabase.from('queue_entries').update(update).eq('id', id);
    fetchQueue();
  }

  const inService = entries.find((e) => e.status === 'in_service');
  const waiting = entries.filter((e) => e.status === 'waiting');

  function minutesSince(dateStr: string) {
    return Math.round((Date.now() - new Date(dateStr).getTime()) / 60000);
  }

  if (loading) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{t('title')}</h2>
        <div className="flex gap-2">
          {waiting.length > 0 && !inService && (
            <button
              onClick={startNext}
              className="inline-flex items-center gap-1.5 rounded-[var(--radius-button)] bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
            >
              <Play className="h-4 w-4" />
              {t('next')}
            </button>
          )}
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-button)] bg-[var(--ds-accent)] px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--ds-accent-hover)]"
          >
            <Plus className="h-4 w-4" />
            {t('addWalkIn')}
          </button>
        </div>
      </div>

      {/* Add walk-in form */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="flex gap-2 rounded-[var(--radius-card)] border bg-card p-3">
              <input
                value={walkInName}
                onChange={(e) => setWalkInName(e.target.value)}
                placeholder={t('clientName')}
                className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2"
                onKeyDown={(e) => e.key === 'Enter' && addWalkIn()}
              />
              <button
                onClick={addWalkIn}
                disabled={!walkInName.trim()}
                className="rounded-[var(--radius-button)] bg-[var(--ds-accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {t('addWalkIn')}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Currently in service */}
      {inService && (
        <div className="rounded-[var(--radius-card)] border-2 border-emerald-500 bg-emerald-50 p-4 dark:bg-emerald-950">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-medium uppercase text-emerald-600 dark:text-emerald-400">{t('inService')}</span>
              <p className="text-lg font-bold">{inService.client?.full_name ?? inService.client_name}</p>
              {inService.service && <p className="text-sm text-muted-foreground">{inService.service.name}</p>}
            </div>
            <div className="flex items-center gap-2">
              {inService.started_at && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  {t('timer', { minutes: minutesSince(inService.started_at) })}
                </div>
              )}
              <button
                onClick={() => updateStatus(inService.id, 'completed')}
                className="rounded-lg bg-emerald-600 p-2 text-white hover:bg-emerald-700"
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                onClick={() => updateStatus(inService.id, 'no_show')}
                className="rounded-lg bg-red-600 p-2 text-white hover:bg-red-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Waiting list */}
      {waiting.length === 0 && !inService ? (
        <EmptyState
          icon={<Users className="h-7 w-7" />}
          title={t('empty')}
          description={t('emptyDescription')}
        />
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {waiting.map((entry, i) => (
              <motion.div
                key={entry.id}
                layout
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                className="flex items-center gap-3 rounded-[var(--radius-card)] border bg-card p-3"
              >
                <div className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold',
                  i === 0 ? 'bg-[var(--ds-accent)] text-white' : 'bg-muted text-muted-foreground',
                )}>
                  {entry.position}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{entry.client?.full_name ?? entry.client_name}</p>
                  {entry.service && <p className="text-xs text-muted-foreground">{entry.service.name}</p>}
                </div>
                <span className="text-xs text-muted-foreground">
                  {minutesSince(entry.joined_at)} min
                </span>
                <button
                  onClick={() => updateStatus(entry.id, 'cancelled')}
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
