/** --- YAML
 * name: Client Blacklist
 * description: Lists clients with elevated cancellation_count or no_show_count for risk review.
 * created: 2026-04-12
 * updated: 2026-04-17
 * --- */

'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';
import { usePageTheme, FONT, FONT_FEATURES, pageContainer, cardStyle, labelStyle } from '@/lib/dashboard-theme';

type Row = {
  id: string;
  full_name: string;
  cancellation_count: number;
  no_show_count: number;
  total_visits: number;
  last_visit_at: string | null;
};

const CANCEL_THRESHOLD = 3;
const NOSHOW_THRESHOLD = 2;

export default function BlacklistPage() {
  const supabase = createClient();
  const { master } = useMaster();
  const { C } = usePageTheme();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!master?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from('clients')
      .select('id, full_name, cancellation_count, no_show_count, total_visits, last_visit_at')
      .eq('master_id', master.id)
      .or(`cancellation_count.gte.${CANCEL_THRESHOLD},no_show_count.gte.${NOSHOW_THRESHOLD}`)
      .order('cancellation_count', { ascending: false });
    setRows((data as Row[] | null) ?? []);
    setLoading(false);
  }, [supabase, master?.id]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div style={{ ...pageContainer, background: C.bg, color: C.text }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 24, fontWeight: 600, margin: 0, color: C.text }}>
            <ShieldAlert style={{ width: 24, height: 24, color: C.danger }} />
            Чёрный список
          </h1>
          <p style={{ fontSize: 14, color: C.textSecondary, margin: '4px 0 0' }}>
            Клиенты с {CANCEL_THRESHOLD}+ отменами или {NOSHOW_THRESHOLD}+ no-show. Стоит требовать предоплату.
          </p>
        </div>

        {loading ? (
          <p style={{ fontSize: 14, color: C.textSecondary }}>Загрузка…</p>
        ) : rows.length === 0 ? (
          <div style={{ ...cardStyle(C), padding: 32, textAlign: 'center', fontSize: 14, color: C.textSecondary }}>
            Никто пока не в зоне риска — все клиенты надёжные.
          </div>
        ) : (
          <div style={{ overflow: 'hidden', borderRadius: 10, border: `1px solid ${C.border}` }}>
            <table style={{ width: '100%', fontSize: 14, borderCollapse: 'collapse', fontFamily: FONT, fontFeatureSettings: FONT_FEATURES }}>
              <thead>
                <tr style={{ background: C.surfaceElevated }}>
                  <th style={{ padding: '8px 16px', textAlign: 'left', fontSize: 12, textTransform: 'uppercase', color: C.textTertiary, fontWeight: 510 }}>Клиент</th>
                  <th style={{ padding: '8px 16px', textAlign: 'right', fontSize: 12, textTransform: 'uppercase', color: C.textTertiary, fontWeight: 510 }}>Отмен</th>
                  <th style={{ padding: '8px 16px', textAlign: 'right', fontSize: 12, textTransform: 'uppercase', color: C.textTertiary, fontWeight: 510 }}>No-show</th>
                  <th style={{ padding: '8px 16px', textAlign: 'right', fontSize: 12, textTransform: 'uppercase', color: C.textTertiary, fontWeight: 510 }}>Всего визитов</th>
                  <th style={{ padding: '8px 16px', textAlign: 'right', fontSize: 12, textTransform: 'uppercase', color: C.textTertiary, fontWeight: 510 }}>Последний визит</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} style={{ borderTop: `1px solid ${C.border}` }}>
                    <td style={{ padding: '12px 16px' }}>
                      <Link href={`/clients/${r.id}`} style={{ fontWeight: 510, color: C.text, textDecoration: 'none' }}>
                        {r.full_name}
                      </Link>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: r.cancellation_count >= CANCEL_THRESHOLD ? C.danger : C.text }}>
                      {r.cancellation_count}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: r.no_show_count >= NOSHOW_THRESHOLD ? C.danger : C.text }}>
                      {r.no_show_count}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', color: C.textSecondary }}>{r.total_visits}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', color: C.textSecondary }}>
                      {r.last_visit_at ? new Date(r.last_visit_at).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
