/** --- YAML
 * name: Supplier Order PDF download
 * description: GET /api/supplier-orders/[id]/pdf → возвращает PDF-накладную. Authorization: owner of master.
 * created: 2026-04-19
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildSupplierOrderPDF, type SupplierOrderItem } from '@/lib/pdf/supplier-order-pdf';

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface OrderRow {
  id: string;
  master_id: string;
  supplier_id: string | null;
  items: SupplierOrderItem[];
  currency: string;
  note: string | null;
  created_at: string;
}

interface MasterRow {
  display_name: string | null;
  profile: { full_name: string | null } | { full_name: string | null }[] | null;
}

interface SupplierRow {
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
}

export async function GET(_req: Request, { params }: RouteContext) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: order } = await supabase
    .from('supplier_orders')
    .select('id, master_id, supplier_id, items, currency, note, created_at')
    .eq('id', id)
    .maybeSingle();

  if (!order) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const row = order as OrderRow;

  const { data: master } = await supabase
    .from('masters')
    .select('display_name, profile:profiles!masters_profile_id_fkey(full_name)')
    .eq('id', row.master_id)
    .maybeSingle();
  const mRow = master as MasterRow | null;
  const profile = Array.isArray(mRow?.profile) ? mRow?.profile[0] : mRow?.profile;
  const masterName = mRow?.display_name ?? profile?.full_name ?? 'Master';

  let supplier: SupplierRow | null = null;
  if (row.supplier_id) {
    const { data } = await supabase
      .from('suppliers')
      .select('name, contact_person, phone, email')
      .eq('id', row.supplier_id)
      .maybeSingle();
    supplier = data as SupplierRow | null;
  }

  const pdfBytes = buildSupplierOrderPDF({
    orderNumber: row.id.slice(0, 8).toUpperCase(),
    orderDate: new Date(row.created_at).toISOString().slice(0, 10),
    masterName,
    supplierName: supplier?.name ?? 'Supplier',
    supplierContact: supplier?.contact_person ?? null,
    supplierPhone: supplier?.phone ?? null,
    supplierEmail: supplier?.email ?? null,
    items: Array.isArray(row.items) ? row.items : [],
    currency: row.currency,
    note: row.note,
  });

  return new NextResponse(new Uint8Array(pdfBytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="order-${row.id.slice(0, 8)}.pdf"`,
    },
  });
}
