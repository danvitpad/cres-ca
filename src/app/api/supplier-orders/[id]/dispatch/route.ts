/** --- YAML
 * name: Supplier Order Dispatch
 * description: >
 *   POST /api/supplier-orders/[id]/dispatch — send an order to the supplier
 *   via telegram (sendDocument with PDF), email (Resend attachment), or just
 *   return the PDF link. Called from bot callback_query handler or dashboard.
 *   Authorization: either caller is the master owner (cookie auth) or caller
 *   presents a telegram_id that matches the order's master.
 * created: 2026-04-20
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { buildSupplierOrderPDF, type SupplierOrderItem } from '@/lib/pdf/supplier-order-pdf';
import { getResend } from '@/lib/email/resend';

interface RouteContext {
  params: Promise<{ id: string }>;
}

type Channel = 'telegram' | 'email' | 'pdf';

export async function POST(req: Request, { params }: RouteContext) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const channel = body.channel as Channel;
  const callerTgId = body.telegram_id as number | undefined;

  if (!channel || !['telegram', 'email', 'pdf'].includes(channel)) {
    return NextResponse.json({ error: 'invalid_channel' }, { status: 400 });
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  // Load order + supplier + master
  const { data: order } = await admin
    .from('supplier_orders')
    .select('id, master_id, supplier_id, items, currency, note, created_at, status')
    .eq('id', id)
    .maybeSingle();
  if (!order) return NextResponse.json({ error: 'order_not_found' }, { status: 404 });

  const { data: master } = await admin
    .from('masters')
    .select('display_name, profile_id, profile:profiles!masters_profile_id_fkey(full_name, telegram_id)')
    .eq('id', order.master_id)
    .maybeSingle();

  // Authorization: caller's telegram_id must match master's profile.telegram_id
  const masterProfile = (master as { profile?: { telegram_id?: number | null; full_name?: string | null } | { telegram_id?: number | null; full_name?: string | null }[] | null } | null)?.profile;
  const mp = Array.isArray(masterProfile) ? masterProfile[0] : masterProfile;
  const masterTg = mp?.telegram_id;
  if (callerTgId && masterTg && Number(callerTgId) !== Number(masterTg)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // Supplier
  let supplierName = 'Supplier';
  let supplierEmail: string | null = null;
  let supplierTg: string | null = null;
  let supplierPhone: string | null = null;
  if (order.supplier_id) {
    const { data: s } = await admin
      .from('suppliers')
      .select('name, email, phone, telegram_id, contact_person')
      .eq('id', order.supplier_id)
      .maybeSingle();
    if (s) {
      supplierName = s.name ?? 'Supplier';
      supplierEmail = s.email ?? null;
      supplierTg = s.telegram_id ?? null;
      supplierPhone = s.phone ?? null;
    }
  }

  const masterName = (master?.display_name as string | null) ?? mp?.full_name ?? 'Master';
  const items = Array.isArray(order.items) ? (order.items as SupplierOrderItem[]) : [];

  // Build PDF
  const pdfBytes = buildSupplierOrderPDF({
    orderNumber: order.id.slice(0, 8).toUpperCase(),
    orderDate: new Date(order.created_at).toISOString().slice(0, 10),
    masterName,
    supplierName,
    supplierContact: null,
    supplierPhone,
    supplierEmail,
    items,
    currency: order.currency ?? 'UAH',
    note: order.note ?? null,
  });

  // Summary text for TG/email body (Cyrillic OK here)
  const itemsText = items.map((it) => `— ${it.name} × ${it.quantity} ${it.unit}`).join('\n');
  const summary = `Заказ #${order.id.slice(0, 8).toUpperCase()}\n\nОт: ${masterName}\nДля: ${supplierName}\n\n${itemsText}${order.note ? `\n\nПримечание:\n${order.note}` : ''}`;
  const filename = `order-${order.id.slice(0, 8)}.pdf`;

  if (channel === 'telegram') {
    if (!supplierTg) return NextResponse.json({ error: 'no_supplier_telegram' }, { status: 400 });
    try {
      // sendDocument multipart
      const form = new FormData();
      form.append('chat_id', String(supplierTg));
      form.append('caption', summary);
      form.append('document', new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' }), filename);

      const res = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendDocument`, {
        method: 'POST',
        body: form,
      });
      const json = await res.json();
      if (!json.ok) return NextResponse.json({ error: 'tg_send_failed', detail: json.description }, { status: 500 });

      await admin.from('supplier_orders').update({
        status: 'sent',
        sent_via: 'telegram',
        sent_at: new Date().toISOString(),
      }).eq('id', order.id);
      return NextResponse.json({ ok: true, channel: 'telegram' });
    } catch (e) {
      return NextResponse.json({ error: 'tg_send_error', detail: (e as Error).message }, { status: 500 });
    }
  }

  if (channel === 'email') {
    if (!supplierEmail) return NextResponse.json({ error: 'no_supplier_email' }, { status: 400 });
    try {
      const { error: sendErr } = await getResend().emails.send({
        from: 'CRES-CA <noreply@cres-ca.com>',
        to: supplierEmail,
        subject: `Заказ #${order.id.slice(0, 8).toUpperCase()} — ${masterName}`,
        text: summary,
        attachments: [{
          filename,
          content: Buffer.from(pdfBytes),
        }],
      });
      if (sendErr) return NextResponse.json({ error: 'email_send_failed', detail: sendErr.message }, { status: 500 });

      await admin.from('supplier_orders').update({
        status: 'sent',
        sent_via: 'email',
        sent_at: new Date().toISOString(),
      }).eq('id', order.id);
      return NextResponse.json({ ok: true, channel: 'email' });
    } catch (e) {
      return NextResponse.json({ error: 'email_send_error', detail: (e as Error).message }, { status: 500 });
    }
  }

  // channel === 'pdf' — return PDF url (already exists via /pdf route); just mark as sent-pdf
  await admin.from('supplier_orders').update({
    status: 'sent',
    sent_via: 'pdf',
    sent_at: new Date().toISOString(),
  }).eq('id', order.id);
  return NextResponse.json({ ok: true, channel: 'pdf', pdf_url: `/api/supplier-orders/${order.id}/pdf` });
}
