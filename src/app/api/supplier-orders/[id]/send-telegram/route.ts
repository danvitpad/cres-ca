/** --- YAML
 * name: Supplier Order Telegram Dispatch
 * description: POST /api/supplier-orders/[id]/send-telegram → отправляет черновик заказа поставщику
 *              в Telegram DM через бота. Требует supplier.telegram_id. Обновляет sent_via='telegram', sent_at, status='sent'.
 * created: 2026-04-19
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendMessage } from '@/lib/telegram/bot';

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface OrderItem {
  name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total: number;
}

function formatMessage(params: {
  masterName: string;
  supplierName: string;
  contactPerson: string | null;
  items: OrderItem[];
  total: number;
  currency: string;
  note: string | null;
}) {
  const { masterName, supplierName, contactPerson, items, total, currency, note } = params;
  const lines: string[] = [];
  lines.push(`<b>Заказ поставщику</b>`);
  lines.push(`От: ${masterName}`);
  lines.push(`Для: ${supplierName}${contactPerson ? ` (${contactPerson})` : ''}`);
  lines.push('');
  lines.push('<b>Позиции:</b>');
  for (const it of items) {
    const qty = `${it.quantity} ${it.unit}`;
    const price = it.unit_price ? ` × ${it.unit_price} ${currency}` : '';
    lines.push(`• ${it.name} — ${qty}${price}`);
  }
  lines.push('');
  lines.push(`<b>Итого:</b> ${total.toFixed(2)} ${currency}`);
  if (note) {
    lines.push('');
    lines.push(`<i>${note}</i>`);
  }
  return lines.join('\n');
}

export async function POST(_req: Request, { params }: RouteContext) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: master } = await supabase
    .from('masters')
    .select('id, display_name, profile:profile_id(full_name)')
    .eq('profile_id', user.id)
    .maybeSingle();
  if (!master) return NextResponse.json({ error: 'no_master' }, { status: 400 });

  const { data: order } = await supabase
    .from('supplier_orders')
    .select('id, master_id, supplier_id, status, items, total_cost, currency, note')
    .eq('id', id)
    .maybeSingle();

  if (!order) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (order.master_id !== master.id) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (!order.supplier_id) return NextResponse.json({ error: 'no_supplier' }, { status: 400 });

  const { data: supplier } = await supabase
    .from('suppliers')
    .select('name, contact_person, telegram_id')
    .eq('id', order.supplier_id)
    .maybeSingle();

  if (!supplier) return NextResponse.json({ error: 'supplier_not_found' }, { status: 404 });
  if (!supplier.telegram_id?.trim()) {
    return NextResponse.json({ error: 'supplier_telegram_missing' }, { status: 400 });
  }

  const profile = master.profile as { full_name: string | null } | { full_name: string | null }[] | null;
  const profileName = Array.isArray(profile) ? profile[0]?.full_name : profile?.full_name;
  const masterName = profileName || master.display_name || 'Мастер';

  const text = formatMessage({
    masterName,
    supplierName: supplier.name,
    contactPerson: supplier.contact_person,
    items: (order.items as OrderItem[]) ?? [],
    total: Number(order.total_cost ?? 0),
    currency: order.currency ?? 'UAH',
    note: order.note,
  });

  try {
    await sendMessage(supplier.telegram_id.trim(), text, { parse_mode: 'HTML' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'telegram_send_failed';
    return NextResponse.json({ error: message }, { status: 502 });
  }

  await supabase
    .from('supplier_orders')
    .update({
      status: 'sent',
      sent_via: 'telegram',
      sent_at: new Date().toISOString(),
    })
    .eq('id', order.id);

  return NextResponse.json({ ok: true });
}
