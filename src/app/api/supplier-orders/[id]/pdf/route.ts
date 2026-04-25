/** --- YAML
 * name: Supplier Order PDF download
 * description: GET /api/supplier-orders/[id]/pdf → возвращает PDF-накладную. Authorization: owner of master.
 * created: 2026-04-19
 * --- */

import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { buildSupplierOrderPDF, type SupplierOrderItem } from '@/lib/pdf/supplier-order-pdf';

/** Compute a deterministic share token for a supplier order. */
export function signSupplierOrderToken(orderId: string): string {
  const secret = process.env.PDF_SHARE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return crypto.createHmac('sha256', secret).update(`supplier-order:${orderId}`).digest('hex').slice(0, 32);
}

function verifyToken(orderId: string, token: string): boolean {
  if (!token || token.length !== 32) return false;
  const expected = signSupplierOrderToken(orderId);
  try {
    return crypto.timingSafeEqual(Buffer.from(token, 'utf8'), Buffer.from(expected, 'utf8'));
  } catch {
    return false;
  }
}

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface OrderItemRow {
  inventory_item_id?: string;
  name: string;
  qty?: number;
  quantity?: number;
  price_per_unit?: number;
  unit_price?: number;
  unit?: string;
  total?: number;
}

export async function GET(req: Request, { params }: RouteContext) {
  const { id } = await params;
  const url = new URL(req.url);
  const token = url.searchParams.get('t');

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: order } = await admin
    .from('supplier_orders')
    .select('id, master_id, supplier_id, items, currency, note, created_at')
    .eq('id', id)
    .maybeSingle();
  if (!order) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  // Auth path 1: signed share token (supplier opens link from TG/email)
  // Auth path 2: cookie-authenticated owning master (master views from dashboard)
  if (token) {
    if (!verifyToken(id, token)) {
      return NextResponse.json({ error: 'invalid_token' }, { status: 403 });
    }
  } else {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const { data: callerMaster } = await admin
      .from('masters').select('id').eq('profile_id', user.id).maybeSingle();
    if (!callerMaster || callerMaster.id !== order.master_id) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
  }

  const { data: master } = await admin
    .from('masters')
    .select(`
      id, display_name,
      profile:profiles!masters_profile_id_fkey(full_name, phone, email, username, telegram_id)
    `)
    .eq('id', order.master_id)
    .maybeSingle();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const profile = Array.isArray((master as any)?.profile)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? (master as any).profile[0]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    : (master as any)?.profile;
  // Prefer profile.full_name; legacy display_name often holds 'Мастер' placeholder.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const masterName = profile?.full_name ?? (master as any)?.display_name ?? 'Мастер';

  type SupplierShape = { name: string; contact_person: string | null; phone: string | null; email: string | null };
  let supplier: SupplierShape | null = null;
  if (order.supplier_id) {
    const { data: s } = await admin
      .from('suppliers')
      .select('name, contact_person, phone, email')
      .eq('id', order.supplier_id)
      .maybeSingle();
    supplier = (s ?? null) as SupplierShape | null;
  }

  const rawItems = Array.isArray(order.items) ? (order.items as OrderItemRow[]) : [];
  const itemIds = rawItems.map((r) => r.inventory_item_id).filter(Boolean) as string[];
  const { data: invRows } = itemIds.length
    ? await admin.from('inventory_items').select('id, unit').in('id', itemIds)
    : { data: [] as { id: string; unit: string }[] };
  const unitById = new Map((invRows ?? []).map((i) => [i.id, i.unit]));

  const items: SupplierOrderItem[] = rawItems.map((it) => {
    const qty = Number(it.qty ?? it.quantity ?? 0);
    const unitPrice = Number(it.price_per_unit ?? it.unit_price ?? 0);
    return {
      name: it.name,
      quantity: qty,
      unit: it.unit || unitById.get(it.inventory_item_id || '') || 'шт',
      unit_price: unitPrice,
      total: it.total ?? qty * unitPrice,
    };
  });

  const pdfBytes = buildSupplierOrderPDF({
    orderNumber: order.id.slice(0, 8).toUpperCase(),
    orderDate: new Date(order.created_at).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    masterName,
    masterPhone: profile?.phone ?? null,
    masterEmail: profile?.email ?? null,
    masterTelegram: profile?.username ? `@${profile.username}` : (profile?.telegram_id ? String(profile.telegram_id) : null),
    supplierName: supplier?.name ?? 'Поставщик',
    supplierContact: supplier?.contact_person ?? null,
    supplierPhone: supplier?.phone ?? null,
    supplierEmail: supplier?.email ?? null,
    items,
    currency: order.currency || 'UAH',
    note: order.note ?? null,
  });

  return new NextResponse(new Uint8Array(pdfBytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="order-${order.id.slice(0, 8)}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}
