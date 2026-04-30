/** --- YAML
 * name: Account Self Export (Master)
 * description: GDPR — мастер скачивает СВОИ данные одним JSON-архивом:
 *              профиль, услуги, склад, поставщики, заказы поставщикам,
 *              записи (без контактов клиентов-друзей), финансы, manual-клиенты,
 *              shop-photos URLs, broadcasts, темплейты.
 *              Защита от абуза: лимит 1 экспорт / 30 дней (через data_exports).
 *              Audit log: дата, IP, user-agent.
 * created: 2026-04-30
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

const RATE_LIMIT_DAYS = 30;

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const db = admin();

  // 1) Проверка лимита: один экспорт в 30 дней.
  const cutoff = new Date(Date.now() - RATE_LIMIT_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data: recent } = await db
    .from('data_exports')
    .select('exported_at')
    .eq('profile_id', user.id)
    .gte('exported_at', cutoff)
    .order('exported_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recent) {
    const lastAt = new Date((recent as { exported_at: string }).exported_at);
    const nextAvailable = new Date(lastAt.getTime() + RATE_LIMIT_DAYS * 24 * 60 * 60 * 1000);
    return NextResponse.json(
      {
        error: 'rate_limited',
        message: `Экспорт данных доступен один раз в ${RATE_LIMIT_DAYS} дней. Следующий экспорт будет доступен ${nextAvailable.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}.`,
        next_available_at: nextAvailable.toISOString(),
      },
      { status: 429 },
    );
  }

  // 2) Узнаём роль пользователя — чтобы понять что выгружать.
  const { data: profile } = await db
    .from('profiles')
    .select('id, email, role, full_name, phone, locale, created_at, telegram_id, deleted_at')
    .eq('id', user.id)
    .maybeSingle();

  const role = (profile as { role?: string } | null)?.role ?? 'client';

  // 3) Собираем данные мастера (или клиента — в зависимости от роли).
  const payload: Record<string, unknown> = {
    exported_at: new Date().toISOString(),
    profile,
    notice: {
      ru: 'Это все ваши персональные данные, хранящиеся в системе CRES-CA. ' +
          'Согласно GDPR (статья 20) вы имеете право получить эти данные в переносимом формате. ' +
          'Контактные данные клиентов, добавивших вас в свои контакты в CRES-CA, в этот файл не включены — ' +
          'они являются персональными данными этих клиентов и принадлежат им. ' +
          'Отзывы и публичный рейтинг также не включены — это публичная репутация, привязанная к публичной странице.',
    },
  };

  if (role === 'master' || role === 'salon_admin') {
    const { data: master } = await db
      .from('masters')
      .select('id, display_name, slug, invite_code, specialization, bio, address, city, working_hours, created_at')
      .eq('profile_id', user.id)
      .maybeSingle();

    if (master) {
      const masterId = (master as { id: string }).id;

      const [
        services, inventory, suppliers, supplierOrders,
        appointments, manualClients, manualIncomes, expenses,
        broadcasts, templates, beforeAfter, giftCards,
      ] = await Promise.all([
        db.from('services').select('id, name, description, price, currency, duration_minutes, is_active, created_at').eq('master_id', masterId),
        db.from('inventory_items').select('id, name, current_stock, unit, cost_per_unit, low_stock_threshold, preferred_supplier_id, created_at').eq('master_id', masterId),
        db.from('suppliers').select('id, name, contact_phone, contact_email, notes, created_at').eq('master_id', masterId),
        db.from('supplier_orders').select('id, supplier_id, status, total_amount, created_at, ordered_at, delivered_at').eq('master_id', masterId),
        // Записи без PII клиентов: только время, статус, услуга, сумма.
        db.from('appointments').select('id, starts_at, ends_at, status, price, currency, tip_amount, service_id, cancellation_reason, created_at').eq('master_id', masterId).order('starts_at', { ascending: false }).limit(10000),
        // Manual-клиенты: те, кого мастер сам добавил в кабинете (не контакты-«друзья»).
        // Детектим по client_master_links: если связь автоматическая через TG → клиент-«друг», иначе — manual.
        // Простейше: берём clients где profile_id IS NULL (без TG-аккаунта = ручные).
        db.from('clients').select('id, name, phone, email, notes, behavior_indicator, created_at').eq('master_id', masterId).is('profile_id', null),
        db.from('manual_incomes').select('id, amount, currency, category, description, occurred_at, created_at').eq('master_id', masterId),
        db.from('expenses').select('id, amount, currency, category, description, occurred_at, created_at').eq('master_id', masterId),
        db.from('master_broadcasts').select('id, subject, body, audience, recipients_count, delivered_count, status, sent_at, created_at').eq('master_id', masterId),
        db.from('message_templates').select('id, kind, subject, content, created_at').eq('master_id', masterId),
        db.from('before_after_photos').select('id, before_url, after_url, service_id, created_at').eq('master_id', masterId),
        db.from('gift_cards').select('id, code, value, currency, balance, status, expires_at, created_at').eq('master_id', masterId),
      ]);

      payload.master = master;
      payload.services = services.data ?? [];
      payload.inventory = inventory.data ?? [];
      payload.suppliers = suppliers.data ?? [];
      payload.supplier_orders = supplierOrders.data ?? [];
      payload.appointments = appointments.data ?? [];
      payload.manual_clients = manualClients.data ?? [];
      payload.manual_incomes = manualIncomes.data ?? [];
      payload.expenses = expenses.data ?? [];
      payload.broadcasts = broadcasts.data ?? [];
      payload.message_templates = templates.data ?? [];
      payload.before_after_photos = beforeAfter.data ?? [];
      payload.gift_cards = giftCards.data ?? [];
      payload.excluded = {
        client_friends_contacts: 'Контактные данные клиентов, добавивших вас в свои контакты в CRES-CA, не включены. Это их персональные данные.',
        public_reviews: 'Отзывы и публичный рейтинг привязаны к публичной странице и не подлежат экспорту мастером.',
        referral_network: 'Сеть рекомендаций и реферальные хвосты остаются в системе.',
        ai_recommendations: 'AI-рекомендации и предиктивная аналитика рассчитываются на серверах в реальном времени и не выгружаются.',
        client_loyalty_balances: 'Бонусы лояльности клиентов привязаны к системе и не являются вашими данными.',
      };
    }
  } else {
    // Клиент: его записи + бонусы + отзывы + consent.
    const { data: clientRows } = await db.from('clients').select('id, master_id').eq('profile_id', user.id);
    const clientIds = ((clientRows ?? []) as Array<{ id: string }>).map((c) => c.id);
    const [appts, reviews, consents, loyalty] = await Promise.all([
      clientIds.length
        ? db.from('appointments').select('id, master_id, service_id, starts_at, ends_at, status, price, currency, created_at').in('client_id', clientIds)
        : Promise.resolve({ data: [] }),
      db.from('reviews').select('id, master_id, score, comment, is_anonymous, created_at').eq('client_profile_id', user.id),
      db.from('consent_forms').select('id, master_id, kind, signed_at, content').eq('client_profile_id', user.id),
      db.from('loyalty_balances').select('master_id, balance, locked_in, updated_at').eq('profile_id', user.id),
    ]);
    payload.appointments = appts.data ?? [];
    payload.reviews = reviews.data ?? [];
    payload.consent_forms = consents.data ?? [];
    payload.loyalty_balances = loyalty.data ?? [];
  }

  // 4) Сериализуем + считаем размер.
  const json = JSON.stringify(payload, null, 2);
  const sizeBytes = Buffer.byteLength(json, 'utf-8');

  // 5) Пишем audit log.
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || null;
  const ua = request.headers.get('user-agent') || null;
  await db.from('data_exports').insert({
    profile_id: user.id,
    kind: role === 'master' || role === 'salon_admin' ? 'master_self' : 'client_self',
    format: 'json',
    size_bytes: sizeBytes,
    ip_address: ip,
    user_agent: ua,
  });

  // 6) Отдаём файл.
  const datePart = new Date().toISOString().slice(0, 10);
  return new NextResponse(json, {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="cres-ca-export-${datePart}.json"`,
      'x-export-size-bytes': String(sizeBytes),
    },
  });
}

/**
 * GET со специальным заголовком `x-check-only=1` — возвращает доступность экспорта
 * без скачивания (для UI чтобы показать «доступен через X дней»).
 */
export async function HEAD(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse(null, { status: 401 });

  const cutoff = new Date(Date.now() - RATE_LIMIT_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data: recent } = await admin()
    .from('data_exports')
    .select('exported_at')
    .eq('profile_id', user.id)
    .gte('exported_at', cutoff)
    .order('exported_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recent) {
    const lastAt = new Date((recent as { exported_at: string }).exported_at);
    const nextAvailable = new Date(lastAt.getTime() + RATE_LIMIT_DAYS * 24 * 60 * 60 * 1000);
    return new NextResponse(null, {
      status: 429,
      headers: { 'x-next-available-at': nextAvailable.toISOString() },
    });
  }
  return new NextResponse(null, { status: 200 });
}
