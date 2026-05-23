/** --- YAML
 * name: Supplier order status PATCH
 * description: PATCH /api/supplier-orders/[id] — мастер обновляет статус заказа
 *   ('confirmed' / 'delivered' / 'cancelled'). При 'delivered' автоматически
 *   увеличиваем inventory_items.quantity на ordered qty (закрывает цикл
 *   «заказал — получил — на складе»). Используется кнопкой «Получен» в
 *   /services?tab=orders и /supplier-orders.
 * created: 2026-05-23
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

type Status = 'draft' | 'sent' | 'confirmed' | 'delivered' | 'cancelled';

interface OrderItem {
  inventory_item_id?: string;
  name?: string;
  qty?: number;
  quantity?: number;
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: 'no_id' }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { status?: Status };
  const newStatus = body.status;
  if (!newStatus || !['confirmed', 'delivered', 'cancelled'].includes(newStatus)) {
    return NextResponse.json({ error: 'bad_status' }, { status: 400 });
  }

  // Проверка владения через masters.profile_id
  const { data: master } = await supabase
    .from('masters').select('id').eq('profile_id', user.id).maybeSingle();
  if (!master) return NextResponse.json({ error: 'no_master' }, { status: 403 });

  const { data: order } = await supabase
    .from('supplier_orders')
    .select('id, master_id, status, items')
    .eq('id', id)
    .maybeSingle();
  if (!order || order.master_id !== master.id) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  // Идемпотентность: если уже в нужном статусе — просто ok.
  if (order.status === newStatus) return NextResponse.json({ ok: true, status: newStatus });

  // Запретим бессмысленные переходы (delivered → cancelled и т.п.)
  if (order.status === 'delivered' || order.status === 'cancelled') {
    return NextResponse.json({ error: 'terminal_status' }, { status: 409 });
  }

  const patch: Record<string, unknown> = { status: newStatus };
  if (newStatus === 'delivered') patch.delivered_at = new Date().toISOString();

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { error: updErr } = await admin
    .from('supplier_orders').update(patch).eq('id', id);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  // При delivered — добавляем количества к inventory_items.
  if (newStatus === 'delivered') {
    const items = (Array.isArray(order.items) ? order.items : []) as OrderItem[];
    for (const it of items) {
      const itemId = it.inventory_item_id;
      const qty = Number(it.qty ?? it.quantity ?? 0);
      if (!itemId || qty <= 0) continue;
      // Читаем текущее quantity, прибавляем, пишем обратно.
      const { data: inv } = await admin
        .from('inventory_items').select('quantity').eq('id', itemId).maybeSingle();
      if (!inv) continue;
      const next = Number(inv.quantity ?? 0) + qty;
      await admin.from('inventory_items').update({ quantity: next }).eq('id', itemId);
    }
  }

  return NextResponse.json({ ok: true, status: newStatus });
}
