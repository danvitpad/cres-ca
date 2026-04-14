/** --- YAML
 * name: Receipt/Invoice Generator
 * description: Генерирует HTML чек ФОП для одного визита — мастер открывает страницу и печатает в PDF. Включает реквизиты мастера, клиента, услуги, сумму, налог.
 * created: 2026-04-13
 * updated: 2026-04-13
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ appointment_id: string }> },
) {
  const { appointment_id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: apt } = await supabase
    .from('appointments')
    .select(
      'id, starts_at, total_price, currency, master_id, clients(full_name, phone), services(name, duration_minutes), masters(display_name, business_name, tax_id, tax_group, tax_rate_percent, address, city, profiles(full_name, phone))',
    )
    .eq('id', appointment_id)
    .single();

  if (!apt) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: ownerMaster } = await supabase
    .from('masters')
    .select('id')
    .eq('profile_id', user.id)
    .single();
  if (ownerMaster?.id !== apt.master_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const client = apt.clients as unknown as { full_name: string | null; phone: string | null } | null;
  const service = apt.services as unknown as { name: string; duration_minutes: number } | null;
  const master = apt.masters as unknown as {
    display_name: string | null;
    business_name: string | null;
    tax_id: string | null;
    tax_group: string | null;
    tax_rate_percent: number | null;
    address: string | null;
    city: string | null;
    profiles: { full_name: string | null; phone: string | null } | null;
  } | null;

  const total = Number(apt.total_price ?? 0);
  const currency = apt.currency ?? 'UAH';
  const taxRate = Number(master?.tax_rate_percent ?? 0);
  const taxAmount = (total * taxRate) / 100;
  const masterName = master?.business_name ?? master?.display_name ?? master?.profiles?.full_name ?? 'ФОП';
  const dateStr = new Date(apt.starts_at).toLocaleString('uk-UA');
  const receiptNo = apt.id.slice(0, 8).toUpperCase();

  const html = `<!DOCTYPE html>
<html lang="uk">
<head>
<meta charset="UTF-8">
<title>Чек ${receiptNo}</title>
<style>
  body { font-family: -apple-system, system-ui, sans-serif; max-width: 600px; margin: 40px auto; padding: 40px; color: #111; }
  h1 { font-size: 24px; margin: 0 0 8px; }
  .muted { color: #666; font-size: 13px; }
  .row { display: flex; justify-content: space-between; padding: 6px 0; }
  .divider { border-top: 1px dashed #ccc; margin: 16px 0; }
  .total { font-size: 22px; font-weight: 700; border-top: 2px solid #111; padding-top: 12px; margin-top: 12px; }
  .footer { margin-top: 40px; text-align: center; color: #999; font-size: 11px; }
  @media print { body { margin: 0; } .no-print { display: none; } }
</style>
</head>
<body>
  <h1>${masterName}</h1>
  <div class="muted">
    ${master?.tax_id ? `ІПН: ${master.tax_id}<br>` : ''}
    ${master?.tax_group ? `Група ФОП: ${master.tax_group}<br>` : ''}
    ${master?.address ? `${master.address}<br>` : ''}
    ${master?.city ?? ''}
    ${master?.profiles?.phone ? `<br>Тел: ${master.profiles.phone}` : ''}
  </div>

  <div class="divider"></div>

  <div class="row"><span>Чек №</span><strong>${receiptNo}</strong></div>
  <div class="row"><span>Дата</span><span>${dateStr}</span></div>
  <div class="row"><span>Клієнт</span><span>${client?.full_name ?? '—'}</span></div>

  <div class="divider"></div>

  <div class="row">
    <span>${service?.name ?? 'Послуга'}${service?.duration_minutes ? ` (${service.duration_minutes} хв)` : ''}</span>
    <span>${total.toFixed(2)} ${currency}</span>
  </div>

  ${taxAmount > 0 ? `<div class="row muted"><span>У т.ч. податок (${taxRate}%)</span><span>${taxAmount.toFixed(2)} ${currency}</span></div>` : ''}

  <div class="row total">
    <span>До сплати</span>
    <span>${total.toFixed(2)} ${currency}</span>
  </div>

  <div class="footer">
    Дякуємо! · Створено через CRES-CA
  </div>

  <div class="no-print" style="text-align:center; margin-top:24px;">
    <button onclick="window.print()" style="padding:10px 20px; font-size:14px; cursor:pointer;">Друк / Зберегти PDF</button>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}
