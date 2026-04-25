/** --- YAML
 * name: Supplier Order — Dispatch
 * description: Sends a saved supplier order to the supplier via Telegram (uses suppliers.telegram_id)
 *              OR returns a mailto: URL the master's browser opens (so master can review the
 *              prefilled draft in their own mail client before hitting Send).
 *              On Telegram success the order status flips to 'sent' and `sent_at` is stamped.
 * created: 2026-04-25
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { sendMessage } from '@/lib/telegram/bot';

interface OrderItem {
  inventory_item_id: string;
  name: string;
  qty: number;
  price_per_unit: number;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatOrderText(opts: {
  masterName: string;
  supplierName: string;
  items: OrderItem[];
  total: number;
  currency: string;
  note: string | null;
  html?: boolean;
}): string {
  const { masterName, supplierName, items, total, currency, note, html = false } = opts;
  const b = (s: string) => (html ? `<b>${escapeHtml(s)}</b>` : s);
  const e = (s: string) => (html ? escapeHtml(s) : s);

  const lines: string[] = [];
  lines.push(b('Заказ от ' + masterName));
  lines.push('');
  lines.push(`${e('Поставщик:')} ${e(supplierName)}`);
  lines.push('');
  lines.push(b('Позиции:'));
  for (const it of items) {
    const sub = it.qty * it.price_per_unit;
    lines.push(`• ${e(it.name)} — ${it.qty} × ${it.price_per_unit.toFixed(2)} = ${sub.toFixed(2)} ${e(currency)}`);
  }
  lines.push('');
  lines.push(b('Итого: ') + `${total.toFixed(2)} ${e(currency)}`);
  if (note) {
    lines.push('');
    lines.push(b('Комментарий:'));
    lines.push(e(note));
  }
  return lines.join(html ? '\n' : '\n');
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null) as { via?: 'telegram' | 'email' } | null;
  const via = body?.via;
  if (via !== 'telegram' && via !== 'email') {
    return NextResponse.json({ error: 'invalid_via' }, { status: 400 });
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  // Resolve master and master's display name
  const { data: master } = await admin
    .from('masters')
    .select('id, profile:profiles!masters_profile_id_fkey(full_name)')
    .eq('profile_id', user.id)
    .maybeSingle();
  if (!master) return NextResponse.json({ error: 'not_master' }, { status: 403 });

  // Load the order with supplier joined
  const { data: order, error: orderErr } = await admin
    .from('supplier_orders')
    .select(`
      id, master_id, supplier_id, status, items, total_cost, currency, note,
      supplier:suppliers(name, email, telegram_id)
    `)
    .eq('id', id)
    .maybeSingle();

  if (orderErr) return NextResponse.json({ error: orderErr.message }, { status: 500 });
  if (!order || order.master_id !== master.id) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (order.status === 'sent' || order.status === 'confirmed' || order.status === 'delivered') {
    return NextResponse.json({ error: 'already_sent' }, { status: 409 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supplier = order.supplier as any;
  if (!supplier) return NextResponse.json({ error: 'supplier_missing' }, { status: 400 });

  const items = ((order.items ?? []) as OrderItem[]).filter((i) => i && typeof i.qty === 'number');
  if (items.length === 0) return NextResponse.json({ error: 'no_items' }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const masterName = (master as any).profile?.full_name || 'Мастер CRES-CA';

  if (via === 'telegram') {
    if (!supplier.telegram_id) {
      return NextResponse.json({
        error: 'no_telegram',
        message: 'У поставщика не указан Telegram ID. Добавь его в карточке поставщика.',
      }, { status: 400 });
    }
    const text = formatOrderText({
      masterName,
      supplierName: supplier.name,
      items,
      total: Number(order.total_cost ?? 0),
      currency: order.currency || 'UAH',
      note: order.note,
      html: true,
    });
    const tgRes = await sendMessage(supplier.telegram_id, text, { parse_mode: 'HTML' }) as
      { ok?: boolean; description?: string; result?: { message_id?: number } };
    if (!tgRes.ok) {
      return NextResponse.json({
        error: 'tg_failed',
        message: tgRes.description || 'Не удалось отправить через Telegram',
      }, { status: 502 });
    }

    await admin
      .from('supplier_orders')
      .update({ status: 'sent', sent_at: new Date().toISOString(), sent_via: 'telegram' })
      .eq('id', id);

    return NextResponse.json({
      ok: true,
      via: 'telegram',
      message_id: tgRes.result?.message_id ?? null,
    });
  }

  // email path → return mailto URL for the master's mail client to open
  if (!supplier.email) {
    return NextResponse.json({
      error: 'no_email',
      message: 'У поставщика не указан email. Добавь его в карточке поставщика.',
    }, { status: 400 });
  }
  const text = formatOrderText({
    masterName,
    supplierName: supplier.name,
    items,
    total: Number(order.total_cost ?? 0),
    currency: order.currency || 'UAH',
    note: order.note,
    html: false,
  });
  const subject = `Заказ от ${masterName}`;
  const mailto = `mailto:${encodeURIComponent(supplier.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;

  // Mark optimistically — master will press Send in their mail client
  await admin
    .from('supplier_orders')
    .update({ status: 'sent', sent_at: new Date().toISOString(), sent_via: 'email' })
    .eq('id', id);

  return NextResponse.json({ ok: true, via: 'email', mailto, preview: text });
}
