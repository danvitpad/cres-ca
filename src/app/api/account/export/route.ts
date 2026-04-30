/** --- YAML
 * name: Account Self Export (Master)
 * description: GDPR — мастер/клиент скачивает СВОИ данные. Поддерживается
 *              format=json (один файл) и format=zip (JSON + CSV-листы по
 *              основным сущностям + README). Лимит 1 экспорт / 30 дней
 *              общий для обоих форматов. Audit log: дата, IP, user-agent.
 * created: 2026-04-30
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import JSZip from 'jszip';

const RATE_LIMIT_DAYS = 30;

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

function toCsv(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) return '';
  const headers = Array.from(
    rows.reduce((acc: Set<string>, r) => {
      Object.keys(r).forEach((k) => acc.add(k));
      return acc;
    }, new Set<string>()),
  );
  const escape = (v: unknown): string => {
    if (v === null || v === undefined) return '';
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const head = headers.join(',');
  const body = rows.map((r) => headers.map((h) => escape(r[h])).join(',')).join('\n');
  return head + '\n' + body;
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const url = new URL(request.url);
  const format = (url.searchParams.get('format') ?? 'json').toLowerCase() === 'zip' ? 'zip' : 'json';

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
        broadcasts, templates, beforeAfter,
      ] = await Promise.all([
        db.from('services').select('id, name, description, price, currency, duration_minutes, is_active, created_at').eq('master_id', masterId),
        db.from('inventory_items').select('id, name, quantity, unit, cost_per_unit, low_stock_threshold, preferred_supplier_id, created_at').eq('master_id', masterId),
        db.from('suppliers').select('id, name, contact_person, phone, email, website, note, is_active, created_at').eq('master_id', masterId),
        db.from('supplier_orders').select('id, supplier_id, status, items, total_cost, currency, sent_at, delivered_at, note, created_at').eq('master_id', masterId),
        // Записи без PII клиентов: только время, статус, услуга, сумма.
        db.from('appointments').select('id, starts_at, ends_at, status, price, currency, tip_amount, service_id, cancellation_reason, created_at').eq('master_id', masterId).order('starts_at', { ascending: false }).limit(10000),
        // Manual-клиенты: те, кого мастер сам добавил в кабинете (не контакты-«друзья»).
        // Берём clients где profile_id IS NULL (без TG-аккаунта = ручные).
        db.from('clients').select('id, full_name, phone, email, notes, behavior_indicators, total_visits, total_spent, created_at').eq('master_id', masterId).is('profile_id', null),
        db.from('manual_incomes').select('id, amount, currency, category, client_name, service_name, payment_method, note, date, created_at').eq('master_id', masterId),
        db.from('expenses').select('id, amount, currency, category, description, vendor, payment_method, date, created_at').eq('master_id', masterId),
        db.from('master_broadcasts').select('id, subject, body, audience, recipients_count, delivered_count, failed_count, status, sent_at, created_at').eq('master_id', masterId),
        db.from('message_templates').select('id, kind, name, subject, content, is_active, created_at').eq('master_id', masterId),
        db.from('before_after_photos').select('id, before_url, after_url, caption, service_id, appointment_id, created_at').eq('master_id', masterId),
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
      db.from('reviews').select('id, target_type, target_id, score, comment, is_anonymous, created_at').eq('reviewer_id', user.id),
      clientIds.length
        ? db.from('consent_forms').select('id, master_id, title, form_text, client_agreed, agreed_at, created_at').in('client_id', clientIds)
        : Promise.resolve({ data: [] }),
      db.from('loyalty_balances').select('master_id, balance, lifetime_earned, lifetime_spent, last_earned_at, last_spent_at, updated_at').eq('profile_id', user.id),
    ]);
    payload.appointments = appts.data ?? [];
    payload.reviews = reviews.data ?? [];
    payload.consent_forms = consents.data ?? [];
    payload.loyalty_balances = loyalty.data ?? [];
  }

  // 4) Сериализуем JSON.
  const json = JSON.stringify(payload, null, 2);
  const datePart = new Date().toISOString().slice(0, 10);
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || null;
  const ua = request.headers.get('user-agent') || null;
  const exportKind = role === 'master' || role === 'salon_admin' ? 'master_self' : 'client_self';

  if (format === 'zip') {
    // Собираем zip: data.json + CSV-листы по основным сущностям + README.txt
    const zip = new JSZip();
    zip.file('data.json', json);

    const sheetsFromPayload: Array<[string, unknown]> = [
      ['services', payload.services],
      ['inventory', payload.inventory],
      ['suppliers', payload.suppliers],
      ['supplier_orders', payload.supplier_orders],
      ['appointments', payload.appointments],
      ['manual_clients', payload.manual_clients],
      ['manual_incomes', payload.manual_incomes],
      ['expenses', payload.expenses],
      ['broadcasts', payload.broadcasts],
      ['message_templates', payload.message_templates],
      ['before_after_photos', payload.before_after_photos],
      ['reviews', payload.reviews],
      ['consent_forms', payload.consent_forms],
      ['loyalty_balances', payload.loyalty_balances],
    ];
    for (const [name, rows] of sheetsFromPayload) {
      if (Array.isArray(rows) && rows.length > 0) {
        zip.file(`csv/${name}.csv`, toCsv(rows as Array<Record<string, unknown>>));
      }
    }

    const readme = [
      'CRES-CA — экспорт ваших данных',
      '',
      `Дата экспорта: ${new Date().toLocaleString('ru-RU')}`,
      `Email: ${(profile as { email?: string } | null)?.email ?? '—'}`,
      `Роль: ${role}`,
      '',
      'Содержимое архива:',
      '  data.json   — полный набор данных в одном JSON-файле',
      '  csv/*.csv   — те же данные разбиты по таблицам для удобства Excel/Google Sheets',
      '',
      'Согласно GDPR (статья 20) вы вправе получить эти данные в переносимом',
      'формате. Контактные данные клиентов, добавивших вас в свои контакты в',
      'CRES-CA, в архив не входят — это их персональные данные.',
      '',
      'Если у вас есть вопросы по содержимому — напишите нам через',
      '«Настройки → Обратная связь» в кабинете.',
      '',
    ].join('\n');
    zip.file('README.txt', readme);

    const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    const sizeBytes = buf.byteLength;

    await db.from('data_exports').insert({
      profile_id: user.id,
      kind: exportKind,
      format: 'zip',
      size_bytes: sizeBytes,
      ip_address: ip,
      user_agent: ua,
    });

    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        'content-type': 'application/zip',
        'content-disposition': `attachment; filename="cres-ca-export-${datePart}.zip"`,
        'x-export-size-bytes': String(sizeBytes),
      },
    });
  }

  // JSON-формат (по умолчанию).
  const sizeBytes = Buffer.byteLength(json, 'utf-8');
  await db.from('data_exports').insert({
    profile_id: user.id,
    kind: exportKind,
    format: 'json',
    size_bytes: sizeBytes,
    ip_address: ip,
    user_agent: ua,
  });

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
