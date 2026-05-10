/** --- YAML
 * name: Mini App — Master Template Mutate
 * description: Сохраняет/сбрасывает кастомный текст шаблона мастера. Действия:
 *              save (upsert) и reset (удалить кастом, вернуться к default).
 *              Для 6 стандартных kinds — пишет в message_templates.
 *              Для kind='birthday' — обновляет masters.birthday_settings.greeting_message
 *              (другие поля birthday_settings не трогаем — там есть discount config).
 * created: 2026-05-10
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { resolveUserId } from '@/lib/auth/resolve-user';

const STANDARD_KINDS = new Set([
  'reminder_24h',
  'reminder_2h',
  'review_request',
  'cadence',
  'win_back',
  'nps',
]);

// Виртуальный kind «reminder» — Mini App шлёт его как один пункт, а на сервере
// мы зеркалим в reminder_24h и reminder_2h (cron-задачи читают эти исторические kind'ы).
const REMINDER_VIRTUAL_KIND = 'reminder';
const REMINDER_REAL_KINDS = ['reminder_24h', 'reminder_2h'];

interface MutateBody {
  action?: 'save' | 'reset';
  kind?: string;
  subject?: string;
  content?: string;
}

export async function POST(req: Request) {
  const userId = await resolveUserId(req);
  if (!userId) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as MutateBody | null;
  if (!body?.action || !body?.kind) {
    return NextResponse.json({ error: 'missing_params' }, { status: 400 });
  }
  const isStandard = STANDARD_KINDS.has(body.kind);
  const isBirthday = body.kind === 'birthday';
  const isReminder = body.kind === REMINDER_VIRTUAL_KIND;
  if (!isStandard && !isBirthday && !isReminder) {
    return NextResponse.json({ error: 'unknown_kind' }, { status: 400 });
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: master } = await admin
    .from('masters')
    .select('id, birthday_settings')
    .eq('profile_id', userId)
    .maybeSingle<{ id: string; birthday_settings: Record<string, unknown> | null }>();
  if (!master) return NextResponse.json({ error: 'not_master' }, { status: 403 });

  if (body.action === 'save') {
    const content = (body.content ?? '').trim();
    if (!content) return NextResponse.json({ error: 'empty_content' }, { status: 400 });

    if (isBirthday) {
      const next = { ...(master.birthday_settings ?? {}), greeting_message: content };
      const { error } = await admin
        .from('masters')
        .update({ birthday_settings: next })
        .eq('id', master.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    // Reminder — зеркалим в обе исторических записи (reminder_24h + reminder_2h)
    // одинаковым текстом. Cron'ы reminders.ts читают каждую по своему расписанию.
    const subject = (body.subject ?? '').trim() || null;
    const targetKinds = isReminder ? REMINDER_REAL_KINDS : [body.kind];

    for (const k of targetKinds) {
      const { data: existing } = await admin
        .from('message_templates')
        .select('id')
        .eq('master_id', master.id)
        .eq('kind', k)
        .eq('is_active', true)
        .maybeSingle<{ id: string }>();
      if (existing) {
        const { error } = await admin
          .from('message_templates')
          .update({ subject, content })
          .eq('id', existing.id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      } else {
        const { error } = await admin
          .from('message_templates')
          .insert({
            master_id: master.id,
            kind: k,
            name: k,
            subject,
            content,
            is_active: true,
          });
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }
    return NextResponse.json({ ok: true });
  }

  if (body.action === 'reset') {
    if (isBirthday) {
      const next = { ...(master.birthday_settings ?? {}) };
      delete (next as Record<string, unknown>).greeting_message;
      const { error } = await admin
        .from('masters')
        .update({ birthday_settings: next })
        .eq('id', master.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }
    // Reminder reset — удаляем оба зеркальных kind'а.
    const targetKinds = isReminder ? REMINDER_REAL_KINDS : [body.kind];
    const { error } = await admin
      .from('message_templates')
      .delete()
      .eq('master_id', master.id)
      .in('kind', targetKinds);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'bad_action' }, { status: 400 });
}
