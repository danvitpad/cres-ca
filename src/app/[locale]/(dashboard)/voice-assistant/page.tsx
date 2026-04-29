/** --- YAML
 * name: Voice Assistant (Web)
 * description: Dashboard page showcasing voice commands, recent AI actions timeline, and undo. Primary CTA points to the Telegram bot.
 * created: 2026-04-18
 * updated: 2026-04-18
 * --- */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic,
  Bell,
  Calendar,
  Receipt,
  Coins,
  NotebookPen,
  Package,
  XCircle,
  Clock,
  UserPlus,
  ExternalLink,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type ActionLog = {
  id: string;
  source: 'voice' | 'automation' | 'rules';
  action_type: string;
  input_text: string | null;
  result: Record<string, unknown> | null;
  status: 'success' | 'needs_confirmation' | 'failed';
  error_message: string | null;
  created_at: string;
};

type CommandCard = {
  icon: typeof Mic;
  titleKey: string;
  exampleKey: string;
};

const COMMANDS: CommandCard[] = [
  { icon: Bell, titleKey: 'cmdReminder', exampleKey: 'cmdReminderEx' },
  { icon: Calendar, titleKey: 'cmdAppointment', exampleKey: 'cmdAppointmentEx' },
  { icon: Receipt, titleKey: 'cmdExpense', exampleKey: 'cmdExpenseEx' },
  { icon: Coins, titleKey: 'cmdRevenue', exampleKey: 'cmdRevenueEx' },
  { icon: NotebookPen, titleKey: 'cmdClientNote', exampleKey: 'cmdClientNoteEx' },
  { icon: Package, titleKey: 'cmdInventory', exampleKey: 'cmdInventoryEx' },
  { icon: XCircle, titleKey: 'cmdCancel', exampleKey: 'cmdCancelEx' },
  { icon: Clock, titleKey: 'cmdReschedule', exampleKey: 'cmdRescheduleEx' },
  { icon: UserPlus, titleKey: 'cmdCreateClient', exampleKey: 'cmdCreateClientEx' },
];

const BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'crescacom_bot';

export default function VoiceAssistantPage() {
  const t = useTranslations('voice_assistant');
  const { master, loading: masterLoading } = useMaster();
  const [logs, setLogs] = useState<ActionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [undoing, setUndoing] = useState<string | null>(null);

  const botHandle = `@${BOT_USERNAME}`;

  const loadLogs = useCallback(async () => {
    if (!master?.id) return;
    const supabase = createClient();
    const { data } = await supabase
      .from('ai_actions_log')
      .select('id, source, action_type, input_text, result, status, error_message, created_at')
      .eq('master_id', master.id)
      .order('created_at', { ascending: false })
      .limit(50);
    setLogs((data ?? []) as ActionLog[]);
    setLoading(false);
  }, [master?.id]);

  useEffect(() => {
    if (masterLoading) return;
    loadLogs();
  }, [masterLoading, loadLogs]);

  async function handleUndo(logId: string) {
    setUndoing(logId);
    try {
      const res = await fetch(`/api/ai-actions/${logId}/undo`, { method: 'POST' });
      if (res.ok) {
        toast.success(t('undone'));
        await loadLogs();
      } else {
        toast.error(t('undoFailed'));
      }
    } catch {
      toast.error(t('undoFailed'));
    } finally {
      setUndoing(null);
    }
  }

  const isUndoable = (log: ActionLog) =>
    log.source === 'voice' &&
    log.status === 'success' &&
    (log.action_type === 'client_created' || log.action_type === 'appointment_reschedule');

  const hasVoiceAction = logs.some((l) => l.source === 'voice');

  return (
    <div className="min-h-screen bg-[var(--f-bg)] p-6 md:p-10">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-[var(--f-fg)] flex items-center gap-3">
              <Mic className="w-7 h-7 text-[var(--f-accent)]" />
              {t('title')}
            </h1>
            <p className="mt-2 text-[var(--f-fg-muted)] max-w-xl">{t('subtitle')}</p>
          </div>

          <a
            href={`https://t.me/${BOT_USERNAME}`}
            target="_blank"
            rel="noreferrer"
            className={cn(
              'inline-flex items-center gap-2 px-5 py-2.5 rounded-lg',
              'bg-[var(--f-accent)] text-white font-medium',
              'hover:opacity-90 transition-opacity',
            )}
          >
            <ExternalLink className="w-4 h-4" />
            {botHandle}
          </a>
        </div>

        {/* Status */}
        <Card className="border-[var(--f-border)]">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'w-2.5 h-2.5 rounded-full',
                  hasVoiceAction ? 'bg-emerald-500' : 'bg-amber-500',
                )}
              />
              <span className="font-medium text-[var(--f-fg)]">
                {hasVoiceAction ? t('statusConnected') : t('statusNotConnected')}
              </span>
            </div>
            <span className="text-sm text-[var(--f-fg-muted)]">
              {t('statusHint', { botHandle })}
            </span>
          </CardContent>
        </Card>

        {/* Commands */}
        <section>
          <h2 className="text-lg font-semibold text-[var(--f-fg)] mb-3">{t('commandsTitle')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {COMMANDS.map((cmd) => {
              const Icon = cmd.icon;
              return (
                <motion.div
                  key={cmd.titleKey}
                  whileHover={{ y: -2 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  className="rounded-xl border border-[var(--f-border)] bg-[var(--f-card)] p-4"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="w-4 h-4 text-[var(--f-accent)]" />
                    <span className="font-medium text-[var(--f-fg)]">{t(cmd.titleKey)}</span>
                  </div>
                  <p className="text-sm text-[var(--f-fg-muted)] italic">{t(cmd.exampleKey)}</p>
                </motion.div>
              );
            })}
          </div>
        </section>

        {/* Timeline */}
        <section>
          <h2 className="text-lg font-semibold text-[var(--f-fg)] mb-3">{t('timelineTitle')}</h2>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : logs.length === 0 ? (
            <Card className="border-[var(--f-border)]">
              <CardContent className="p-8 text-center text-[var(--f-fg-muted)]">
                {t('timelineEmpty')}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              <AnimatePresence initial={false}>
                {logs.map((log) => (
                  <motion.div
                    key={log.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="rounded-xl border border-[var(--f-border)] bg-[var(--f-card)] p-4 flex items-start gap-3"
                  >
                    <StatusIcon status={log.status} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-[var(--f-fg)]">{log.action_type}</span>
                        <Badge variant="secondary" className="text-xs">
                          {t(`source${capitalize(log.source)}`)}
                        </Badge>
                        <span className="text-xs text-[var(--f-fg-muted)]">
                          {new Date(log.created_at).toLocaleString(undefined, {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      {log.input_text && (
                        <p className="mt-1 text-sm text-[var(--f-fg-muted)] truncate">
                          &ldquo;{log.input_text}&rdquo;
                        </p>
                      )}
                      {log.error_message && log.error_message !== 'undone_by_user' && (
                        <p className="mt-1 text-xs text-red-500">{log.error_message}</p>
                      )}
                    </div>
                    {isUndoable(log) && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUndo(log.id)}
                        disabled={undoing === log.id}
                      >
                        <RotateCcw className="w-3.5 h-3.5 mr-1" />
                        {t('undo')}
                      </Button>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: ActionLog['status'] }) {
  if (status === 'success') return <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />;
  if (status === 'failed') return <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />;
  return <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
