/** --- YAML
 * name: Mini App — Master Templates List
 * description: Возвращает текущие тексты шаблонов мастера для всех 7 типов
 *              (reminder_24h, reminder_2h, review_request, cadence, win_back, nps, birthday).
 *              Шесть «стандартных» — из message_templates (kind, subject, content).
 *              Birthday — из masters.birthday_settings.greeting_message.
 *              Если кастомного шаблона нет — возвращаем null, клиент покажет default.
 * created: 2026-05-10
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { resolveUserId } from '@/lib/auth/resolve-user';

export const TEMPLATE_KINDS = [
  'reminder_24h',
  'reminder_2h',
  'review_request',
  'cadence',
  'win_back',
  'nps',
] as const;

export async function POST(req: Request) {
  const userId = await resolveUserId(req);
  if (!userId) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: master } = await admin
    .from('masters')
    .select('id, birthday_settings')
    .eq('profile_id', userId)
    .maybeSingle<{ id: string; birthday_settings: { greeting_message?: string | null } | null }>();
  if (!master) return NextResponse.json({ error: 'not_master' }, { status: 403 });

  const { data: rows } = await admin
    .from('message_templates')
    .select('kind, subject, content')
    .eq('master_id', master.id)
    .eq('is_active', true)
    .in('kind', [...TEMPLATE_KINDS]);

  const byKind: Record<string, { subject: string | null; content: string }> = {};
  for (const r of (rows ?? []) as Array<{ kind: string; subject: string | null; content: string }>) {
    byKind[r.kind] = { subject: r.subject, content: r.content };
  }

  // Birthday — отдельная единица, текст лежит в masters.birthday_settings.greeting_message.
  if (master.birthday_settings?.greeting_message) {
    byKind.birthday = { subject: null, content: master.birthday_settings.greeting_message };
  }

  return NextResponse.json({ templates: byKind });
}
