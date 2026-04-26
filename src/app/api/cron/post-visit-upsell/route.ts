/** --- YAML
 * name: Post-Visit Upsell Cron
 * description: 2h after appointment completion, sends product recommendation notifications to clients based on product_recommendations linked to the service. Dedup via marker `[upsell:apt_id]` in notifications body.
 * created: 2026-04-16
 * updated: 2026-04-16
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

type Lang = 'ru' | 'uk' | 'en';

const FALLBACK_UPSELL: Record<Lang, { title: string; bodyFor: (clientName: string, name: string, price: number, cur: string) => string }> = {
  ru: {
    title: '💄 Рекомендация после визита',
    bodyFor: (n, p, pr, c) => `${n}, для закрепления результата рекомендуем: ${p} (${pr} ${c}). Купить в один клик`,
  },
  uk: {
    title: '💄 Рекомендація після візиту',
    bodyFor: (n, p, pr, c) => `${n}, для закріплення результату рекомендуємо: ${p} (${pr} ${c}). Купити в один клік`,
  },
  en: {
    title: '💄 Post-visit recommendation',
    bodyFor: (n, p, pr, c) => `${n}, to keep the result we recommend: ${p} (${pr} ${c}). One-click purchase`,
  },
};

function resolveLang(raw: unknown): Lang {
  return raw === 'uk' || raw === 'en' ? raw : 'ru';
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = await createClient();
  const now = new Date();
  // Window: appointments that ended 2–3 hours ago
  const from = new Date(now.getTime() - 180 * 60 * 1000); // 3h ago
  const to = new Date(now.getTime() - 120 * 60 * 1000);   // 2h ago

  /* ── 1. Completed appointments in window ── */
  const { data: appointments, error: aptErr } = await supabase
    .from('appointments')
    .select(
      'id, master_id, service_id, clients(id, profile_id, full_name)',
    )
    .eq('status', 'completed')
    .gte('ends_at', from.toISOString())
    .lte('ends_at', to.toISOString());

  if (aptErr || !appointments?.length) {
    return NextResponse.json({ ok: true, sent: 0, error: aptErr?.message ?? null });
  }

  /* ── 2. Dedup: skip appointments that already got an upsell notification ── */
  const aptIds = appointments.map((a) => a.id);
  const { data: existingNotifs } = await supabase
    .from('notifications')
    .select('body')
    .like('body', '%[upsell:%');

  const sentSet = new Set<string>();
  for (const n of existingNotifs ?? []) {
    const m = (n.body as string | null)?.match(/\[upsell:([0-9a-f-]{36})\]/i);
    if (m) sentSet.add(m[1]);
  }

  /* ── 3. Load product recommendations for relevant services + master langs ── */
  const serviceIds = Array.from(new Set(appointments.map((a) => a.service_id).filter(Boolean)));
  if (serviceIds.length === 0) return NextResponse.json({ ok: true, sent: 0 });

  const masterIds = Array.from(new Set(appointments.map((a) => a.master_id).filter(Boolean)));
  const { data: mastersLangRows } = await supabase
    .from('masters')
    .select('id, public_language')
    .in('id', masterIds);
  const langByMaster = new Map<string, Lang>();
  for (const m of (mastersLangRows ?? []) as Array<{ id: string; public_language: string | null }>) {
    langByMaster.set(m.id, resolveLang(m.public_language));
  }

  const { data: recs } = await supabase
    .from('product_recommendations')
    .select('service_id, message_template, products(id, name, price, currency, is_active)')
    .in('service_id', serviceIds);

  if (!recs?.length) return NextResponse.json({ ok: true, sent: 0 });

  // Group recommendations by service_id
  type Rec = {
    service_id: string;
    message_template: string | null;
    products: { id: string; name: string; price: number; currency: string; is_active: boolean } | null;
  };
  const recsByService = new Map<string, Rec[]>();
  for (const r of (recs as unknown as Rec[])) {
    if (!r.products?.is_active) continue;
    const arr = recsByService.get(r.service_id) ?? [];
    arr.push(r);
    recsByService.set(r.service_id, arr);
  }

  /* ── 4. Send notifications ── */
  let sent = 0;
  const errors: string[] = [];

  for (const apt of appointments) {
    try {
      if (sentSet.has(apt.id)) continue;

      const client = apt.clients as unknown as { id: string; profile_id: string | null; full_name: string | null } | null;
      if (!client?.profile_id || !apt.service_id) continue;

      const serviceRecs = recsByService.get(apt.service_id);
      if (!serviceRecs?.length) continue;

      // Pick first recommendation (could randomize or send all — keeping it simple)
      const rec = serviceRecs[0];
      const product = rec.products!;
      const clientName = client.full_name?.split(' ')[0] ?? 'клиент';

      const lang = langByMaster.get(apt.master_id as string) ?? 'ru';
      const fb = FALLBACK_UPSELL[lang];
      const body = rec.message_template
        ? rec.message_template
            .replace('{client_name}', clientName)
            .replace('{product_name}', product.name)
            .replace('{price}', `${product.price}`)
            .replace('{currency}', product.currency)
        : fb.bodyFor(clientName, product.name, product.price, product.currency);

      const finalBody = `${body} [upsell:${apt.id}]`;

      await supabase.from('notifications').insert({
        profile_id: client.profile_id,
        channel: 'telegram',
        title: fb.title,
        body: finalBody,
        scheduled_for: now.toISOString(),
        metadata: { appointment_id: apt.id, product_id: product.id },
      });
      sent++;
    } catch (err) {
      errors.push(`apt ${apt.id}: ${(err as Error).message}`);
    }
  }

  return NextResponse.json({ ok: true, sent, errors: errors.length ? errors : undefined });
}
