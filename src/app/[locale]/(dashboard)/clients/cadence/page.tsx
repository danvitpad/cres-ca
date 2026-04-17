/** --- YAML
 * name: Visit Cadence Analyzer
 * description: Computes median interval between visits per client and flags overdue ones with one-click reminder.
 * created: 2026-04-12
 * updated: 2026-04-17
 * --- */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Clock3, BellRing } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';
import { Button } from '@/components/ui/button';
import { usePageTheme, FONT, FONT_FEATURES, pageContainer, cardStyle, labelStyle } from '@/lib/dashboard-theme';
import type { PageTheme } from '@/lib/dashboard-theme';

type AppointmentRow = {
  client_id: string;
  starts_at: string;
};
type ClientLite = {
  id: string;
  full_name: string;
  profile_id: string | null;
};
type Row = {
  id: string;
  full_name: string;
  profile_id: string | null;
  visits: number;
  median: number;
  daysSinceLast: number;
  overdueBy: number;
};

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export default function CadencePage() {
  const supabase = createClient();
  const { master } = useMaster();
  const { C } = usePageTheme();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!master?.id) return;
    setLoading(true);

    const [{ data: clients }, { data: apts }] = await Promise.all([
      supabase
        .from('clients')
        .select('id, full_name, profile_id')
        .eq('master_id', master.id),
      supabase
        .from('appointments')
        .select('client_id, starts_at')
        .eq('master_id', master.id)
        .eq('status', 'completed')
        .order('starts_at', { ascending: true }),
    ]);

    const byClient = new Map<string, Date[]>();
    for (const a of (apts ?? []) as AppointmentRow[]) {
      const arr = byClient.get(a.client_id) ?? [];
      arr.push(new Date(a.starts_at));
      byClient.set(a.client_id, arr);
    }

    const today = Date.now();
    const result: Row[] = ((clients ?? []) as ClientLite[])
      .map((c) => {
        const dates = byClient.get(c.id) ?? [];
        if (dates.length < 2) return null;
        const intervals: number[] = [];
        for (let i = 1; i < dates.length; i++) {
          intervals.push((dates[i].getTime() - dates[i - 1].getTime()) / 86400000);
        }
        const med = median(intervals);
        const daysSinceLast = (today - dates[dates.length - 1].getTime()) / 86400000;
        return {
          id: c.id,
          full_name: c.full_name,
          profile_id: c.profile_id,
          visits: dates.length,
          median: Math.round(med),
          daysSinceLast: Math.round(daysSinceLast),
          overdueBy: Math.round(daysSinceLast - med),
        };
      })
      .filter((r): r is Row => r !== null)
      .sort((a, b) => b.overdueBy - a.overdueBy);

    setRows(result);
    setLoading(false);
  }, [supabase, master?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const overdue = useMemo(() => rows.filter((r) => r.overdueBy > 0), [rows]);

  async function nudge(row: Row) {
    if (!row.profile_id) {
      toast.error('У клиента нет профиля для уведомления');
      return;
    }
    const { error } = await supabase.from('notifications').insert({
      profile_id: row.profile_id,
      channel: 'telegram',
      title: '⏰ Пора записаться',
      body: `${row.full_name}, обычно ты приходишь раз в ~${row.median} дней. Прошло уже ${row.daysSinceLast}. [cadence:${row.id}]`,
      scheduled_for: new Date().toISOString(),
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Напоминание отправлено');
  }

  return (
    <div style={{ ...pageContainer, maxWidth: 1024, background: C.bg, color: C.text }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 24, fontWeight: 600, margin: 0, color: C.text }}>
            <Clock3 style={{ width: 24, height: 24, color: C.accent }} />
            Периодичность визитов
          </h1>
          <p style={{ fontSize: 14, color: C.textSecondary, margin: '4px 0 0' }}>
            Медианный интервал между визитами. Просроченные — приоритет на напоминание.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          <Stat C={C} label="Постоянных" value={rows.length.toString()} />
          <Stat C={C} label="Просрочено" value={overdue.length.toString()} accent={overdue.length > 0} />
          <Stat
            C={C}
            label="Сред. интервал"
            value={rows.length > 0 ? `${Math.round(rows.reduce((a, r) => a + r.median, 0) / rows.length)} дн` : '—'}
          />
        </div>

        {loading ? (
          <p style={{ fontSize: 14, color: C.textSecondary }}>Загрузка…</p>
        ) : rows.length === 0 ? (
          <p style={{ fontSize: 14, color: C.textSecondary }}>Нет клиентов с 2+ визитами — анализ невозможен.</p>
        ) : (
          <div style={{ overflow: 'hidden', borderRadius: 10, border: `1px solid ${C.border}` }}>
            <table style={{ width: '100%', fontSize: 14, borderCollapse: 'collapse', fontFamily: FONT, fontFeatureSettings: FONT_FEATURES }}>
              <thead>
                <tr style={{ background: C.surfaceElevated }}>
                  <th style={{ padding: '8px 16px', textAlign: 'left', fontSize: 12, textTransform: 'uppercase', color: C.textTertiary, fontWeight: 510 }}>Клиент</th>
                  <th style={{ padding: '8px 16px', textAlign: 'right', fontSize: 12, textTransform: 'uppercase', color: C.textTertiary, fontWeight: 510 }}>Визитов</th>
                  <th style={{ padding: '8px 16px', textAlign: 'right', fontSize: 12, textTransform: 'uppercase', color: C.textTertiary, fontWeight: 510 }}>Раз в</th>
                  <th style={{ padding: '8px 16px', textAlign: 'right', fontSize: 12, textTransform: 'uppercase', color: C.textTertiary, fontWeight: 510 }}>Прошло</th>
                  <th style={{ padding: '8px 16px', textAlign: 'right', fontSize: 12, textTransform: 'uppercase', color: C.textTertiary, fontWeight: 510 }}>Статус</th>
                  <th style={{ padding: '8px 16px' }}></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const isOverdue = r.overdueBy > 0;
                  return (
                    <tr key={r.id} style={{ borderTop: `1px solid ${C.border}` }}>
                      <td style={{ padding: '12px 16px' }}>
                        <Link href={`/clients/${r.id}`} style={{ fontWeight: 510, color: C.text, textDecoration: 'none' }}>
                          {r.full_name}
                        </Link>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', color: C.textSecondary }}>{r.visits}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>{r.median} дн</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>{r.daysSinceLast} дн</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: isOverdue ? C.danger : C.success }}>
                        {isOverdue ? `+${r.overdueBy} дн` : 'в графике'}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        {isOverdue && (
                          <Button size="sm" variant="outline" onClick={() => nudge(r)}>
                            <BellRing className="mr-1 h-3 w-3" /> Напомнить
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ C, label, value, accent }: { C: PageTheme; label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ ...cardStyle(C), padding: 12 }}>
      <div style={{ ...labelStyle(C) }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 600, color: accent ? C.danger : C.text }}>{value}</div>
    </div>
  );
}
