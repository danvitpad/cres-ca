/** --- YAML
 * name: Invoice Page
 * description: Публичный HTML-инвойс по визиту. Оптимизирован под print (Save as PDF). Используется как "счёт" для корпоративных клиентов.
 * created: 2026-04-13
 * updated: 2026-04-13
 * --- */

import { notFound } from 'next/navigation';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { PrintButton } from './print-button';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ apt_id: string }>;
}

export default async function InvoicePage({ params }: Props) {
  const { apt_id } = await params;
  const supabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const { data: apt } = await supabase
    .from('appointments')
    .select(
      `id, starts_at, price, currency, tip_amount,
       service:services(name, duration_minutes),
       client:clients(full_name, phone, email),
       master:masters(handle, profile:profiles!masters_profile_id_fkey(full_name, phone))`,
    )
    .eq('id', apt_id)
    .maybeSingle();

  if (!apt) notFound();

  type A = {
    id: string;
    starts_at: string;
    price: number | null;
    currency: string | null;
    tip_amount: number | null;
    service: { name: string | null; duration_minutes: number | null } | { name: string | null; duration_minutes: number | null }[] | null;
    client: { full_name: string | null; phone: string | null; email: string | null } | { full_name: string | null; phone: string | null; email: string | null }[] | null;
    master: { handle: string | null; profile: { full_name: string | null; phone: string | null } | null } | { handle: string | null; profile: { full_name: string | null; phone: string | null } | null }[] | null;
  };

  const a = apt as unknown as A;
  const svc = Array.isArray(a.service) ? a.service[0] : a.service;
  const cli = Array.isArray(a.client) ? a.client[0] : a.client;
  const mst = Array.isArray(a.master) ? a.master[0] : a.master;
  const mstProfile = mst?.profile;

  const date = new Date(a.starts_at);
  const invoiceNo = `INV-${a.id.slice(0, 8).toUpperCase()}`;
  const total = Number(a.price ?? 0) + Number(a.tip_amount ?? 0);
  const currency = a.currency ?? 'UAH';

  return (
    <div
      style={{
        maxWidth: 720,
        margin: '40px auto',
        padding: 40,
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
        background: '#fff',
        color: '#111',
      }}
    >
      <style>{`
        @media print {
          body { background: white; }
          .no-print { display: none !important; }
          .invoice-root { margin: 0 !important; padding: 16px !important; }
        }
      `}</style>

      <div className="invoice-root">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
          <div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>Счёт</div>
            <div style={{ color: '#666', fontSize: 14 }}>№ {invoiceNo}</div>
            <div style={{ color: '#666', fontSize: 14 }}>от {date.toLocaleDateString('ru-RU')}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 16, fontWeight: 600 }}>{mstProfile?.full_name ?? '—'}</div>
            {mst?.handle && <div style={{ color: '#666', fontSize: 14 }}>@{mst.handle}</div>}
            {mstProfile?.phone && <div style={{ color: '#666', fontSize: 14 }}>{mstProfile.phone}</div>}
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, color: '#888', textTransform: 'uppercase', marginBottom: 4 }}>Кому</div>
          <div style={{ fontSize: 15, fontWeight: 500 }}>{cli?.full_name ?? '—'}</div>
          {cli?.phone && <div style={{ color: '#666', fontSize: 14 }}>{cli.phone}</div>}
          {cli?.email && <div style={{ color: '#666', fontSize: 14 }}>{cli.email}</div>}
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24, fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #111' }}>
              <th style={{ padding: '10px 0', textAlign: 'left' }}>Услуга</th>
              <th style={{ padding: '10px 0', textAlign: 'right' }}>Длит.</th>
              <th style={{ padding: '10px 0', textAlign: 'right' }}>Сумма</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '14px 0' }}>{svc?.name ?? '—'}</td>
              <td style={{ padding: '14px 0', textAlign: 'right', color: '#666' }}>
                {svc?.duration_minutes ?? '—'} мин
              </td>
              <td style={{ padding: '14px 0', textAlign: 'right' }}>
                {Number(a.price ?? 0).toFixed(2)} {currency}
              </td>
            </tr>
            {Number(a.tip_amount ?? 0) > 0 && (
              <tr style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '14px 0', color: '#666' }}>Чаевые</td>
                <td></td>
                <td style={{ padding: '14px 0', textAlign: 'right' }}>
                  {Number(a.tip_amount).toFixed(2)} {currency}
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2} style={{ padding: '16px 0', textAlign: 'right', fontWeight: 600 }}>ИТОГО</td>
              <td style={{ padding: '16px 0', textAlign: 'right', fontSize: 18, fontWeight: 700 }}>
                {total.toFixed(2)} {currency}
              </td>
            </tr>
          </tfoot>
        </table>

        <div style={{ fontSize: 12, color: '#888', borderTop: '1px solid #eee', paddingTop: 16 }}>
          Счёт сгенерирован через cres.ca. Для сохранения в PDF нажмите Ctrl/⌘+P → «Сохранить как PDF».
        </div>

        <div className="no-print" style={{ marginTop: 24, textAlign: 'center' }}>
          <PrintButton />
        </div>
      </div>
    </div>
  );
}
