/** --- YAML
 * name: Marketing — Test-send template to self
 * description: Renders a draft template (subject + body) against a sample context and pushes
 *              it to the master's own Telegram (or email) so they can preview the real message
 *              before flipping the automation on. Auth: cookie session, master must own the
 *              kind. Body without a subject still works (subject becomes a kind-default title).
 * created: 2026-04-25
 * updated: 2026-04-25
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { renderTemplate } from '@/lib/messaging/render-template';

const SAMPLE_CONTEXT_BY_KIND: Record<string, Record<string, string>> = {
  reminder_24h: {
    client_name: 'Анна',
    time: '15:30',
    service_name: 'Маникюр',
    confirm_url: 'https://cres-ca.com/confirm/sample',
    master_name: 'Даниил',
    date: 'завтра',
    service_price: '500 ₴',
  },
  reminder_2h: {
    client_name: 'Анна',
    time: '15:30',
    service_name: 'Маникюр',
    master_name: 'Даниил',
  },
  review_request: {
    client_name: 'Анна',
    masterName: 'Даниил',
    serviceName: 'Маникюр',
    master_name: 'Даниил',
    service_name: 'Маникюр',
  },
  cadence: {
    client_name: 'Анна',
    day_name: 'четверг',
    usual_time: '15:00',
    avg: '21',
    days: '28',
  },
  win_back: {
    client_name: 'Анна',
    client_id: 'sample-id',
    tag: '202604',
    master_name: 'Даниил',
  },
  nps: {
    client_name: 'Анна',
    total: '10',
    client_id: 'sample-id',
  },
  pre_visit_master: {
    client_name: 'Анна',
    service_name: 'Маникюр',
    time: '15:30',
    total_visits: '12',
  },
  birthday_client: {
    client_name: 'Анна',
    discount_text: 'Скидка 15% в день рождения',
    master_name: 'Даниил',
  },
};

const FALLBACK_SUBJECT_BY_KIND: Record<string, string> = {
  reminder_24h: '📅 Завтра у вас запись',
  reminder_2h: '⏰ Через 2 часа',
  review_request: '⭐ Оцените визит',
  cadence: '⏰ Пора записаться',
  win_back: '💜 Скучаем по вам',
  nps: '📊 Короткий опрос',
  pre_visit_master: '⏳ Через 30 минут',
  birthday_client: '🎂 С днём рождения!',
};

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null) as
    | { kind?: string; subject?: string; content?: string; channel?: 'telegram' | 'email' }
    | null;
  if (!body?.kind || !body?.content) {
    return NextResponse.json({ error: 'missing_params' }, { status: 400 });
  }

  const ctx = SAMPLE_CONTEXT_BY_KIND[body.kind] ?? SAMPLE_CONTEXT_BY_KIND.reminder_24h;
  const renderedSubject = body.subject
    ? renderTemplate(body.subject, ctx)
    : FALLBACK_SUBJECT_BY_KIND[body.kind] ?? `🧪 Тест шаблона: ${body.kind}`;
  const renderedBody = renderTemplate(body.content, ctx);
  const channel = body.channel === 'email' ? 'email' : 'telegram';

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: master } = await admin
    .from('masters').select('id').eq('profile_id', user.id).maybeSingle();
  if (!master) return NextResponse.json({ error: 'not_master' }, { status: 403 });

  const { error } = await admin.from('notifications').insert({
    profile_id: user.id,
    channel,
    title: `🧪 ${renderedSubject}`,
    body: renderedBody,
    data: { test_send: true, kind: body.kind, sample: true },
    scheduled_for: new Date().toISOString(),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    channel,
    subject: renderedSubject,
    body: renderedBody,
    sample_context: ctx,
  });
}
