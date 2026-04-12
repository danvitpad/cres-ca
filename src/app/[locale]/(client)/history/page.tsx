/** --- YAML
 * name: Client History Page
 * description: Client's booking history with upcoming/past tabs and repeat booking button
 * --- */

'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { CalendarDays, Clock, RefreshCw, User } from 'lucide-react';

interface HistoryAppointment {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  price: number;
  currency: string;
  master_id: string;
  service_id: string;
  service: { name: string; color: string; duration_minutes: number } | null;
  client: {
    master_id: string;
    master: {
      display_name: string | null;
      avatar_url: string | null;
      profile: { full_name: string; avatar_url: string | null } | null;
    } | null;
  } | null;
}

const statusVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  booked: 'outline',
  confirmed: 'default',
  in_progress: 'default',
  completed: 'secondary',
  cancelled: 'destructive',
  no_show: 'destructive',
};

export default function HistoryPage() {
  const t = useTranslations('booking');
  const tc = useTranslations('common');
  const router = useRouter();
  const { userId } = useAuthStore();
  const [appointments, setAppointments] = useState<HistoryAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');

  useEffect(() => {
    async function load() {
      if (!userId) return;
      const supabase = createClient();

      // Get all client IDs for this user
      const { data: clients } = await supabase
        .from('clients')
        .select('id, master_id, master:masters(display_name, avatar_url, profile:profiles(full_name, avatar_url))')
        .eq('profile_id', userId);

      if (!clients?.length) {
        setLoading(false);
        return;
      }

      const clientIds = clients.map((c) => c.id);

      const { data } = await supabase
        .from('appointments')
        .select('id, starts_at, ends_at, status, price, currency, master_id, service_id, service:services(name, color, duration_minutes)')
        .in('client_id', clientIds)
        .order('starts_at', { ascending: false });

      if (data) {
        // Attach master info from clients
        const enriched = data.map((a) => {
          const clientRecord = clients.find((c) => c.master_id === a.master_id);
          return {
            ...a,
            service: a.service as unknown as HistoryAppointment['service'],
            client: clientRecord ? {
              master_id: clientRecord.master_id,
              master: clientRecord.master as unknown as HistoryAppointment['client'] extends infer C
                ? C extends { master: infer M } ? M : never
                : never,
            } : null,
          };
        });
        setAppointments(enriched);
      }
      setLoading(false);
    }
    load();
  }, [userId]);

  const now = new Date().toISOString();
  const upcoming = appointments.filter((a) => a.starts_at >= now && a.status !== 'cancelled' && a.status !== 'no_show');
  const past = appointments.filter((a) => a.starts_at < now || a.status === 'cancelled' || a.status === 'no_show');
  const displayed = tab === 'upcoming' ? upcoming : past;

  function handleRepeat(appointment: HistoryAppointment) {
    router.push(`/book?master_id=${appointment.master_id}&service_id=${appointment.service_id}`);
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function formatTime(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }

  function getStatusKey(status: string) {
    const map: Record<string, string> = {
      booked: 'statusBooked',
      confirmed: 'statusConfirmed',
      completed: 'statusCompleted',
      cancelled: 'statusCancelled',
      in_progress: 'statusConfirmed',
      no_show: 'statusCancelled',
    };
    return map[status] ?? 'statusBooked';
  }

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 pb-24">
      <h2 className="text-2xl font-bold">{t('upcomingAppointments')}</h2>

      {/* Tabs */}
      <div className="flex gap-2">
        {(['upcoming', 'past'] as const).map((key) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'relative px-4 py-2 text-sm font-medium rounded-lg transition-colors',
              tab === key ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t(key === 'upcoming' ? 'upcomingAppointments' : 'pastAppointments')}
            {tab === key && (
              <motion.div
                layoutId="history-tab"
                className="absolute inset-0 rounded-lg bg-primary/10"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative z-10">
              ({key === 'upcoming' ? upcoming.length : past.length})
            </span>
          </button>
        ))}
      </div>

      {/* Appointments list */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="space-y-3"
        >
          {displayed.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CalendarDays className="size-12 mx-auto mb-3 opacity-30" />
              <p>{t('noAppointments')}</p>
            </div>
          ) : (
            displayed.map((appointment) => (
              <Card key={appointment.id} size="sm">
                <CardContent className="pt-3 space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {appointment.service && (
                          <span
                            className="size-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: appointment.service.color }}
                          />
                        )}
                        <span className="font-medium truncate">
                          {appointment.service?.name ?? '—'}
                        </span>
                      </div>
                      {appointment.client?.master && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                          <User className="size-3" />
                          {appointment.client.master.display_name ?? appointment.client.master.profile?.full_name ?? '—'}
                        </div>
                      )}
                    </div>
                    <Badge variant={statusVariant[appointment.status] ?? 'outline'}>
                      {t(getStatusKey(appointment.status))}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <CalendarDays className="size-3.5" />
                        {formatDate(appointment.starts_at)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="size-3.5" />
                        {formatTime(appointment.starts_at)}
                      </span>
                    </div>
                    <span className="font-medium">
                      {Number(appointment.price).toFixed(0)} {appointment.currency}
                    </span>
                  </div>

                  {/* Repeat button for past completed appointments */}
                  {tab === 'past' && appointment.status === 'completed' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full gap-2 mt-1"
                      onClick={() => handleRepeat(appointment)}
                    >
                      <RefreshCw className="size-3.5" />
                      {t('repeatBooking') ?? tc('create')}
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
