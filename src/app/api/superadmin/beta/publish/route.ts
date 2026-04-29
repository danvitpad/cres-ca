/** --- YAML
 * name: Superadmin — publish product
 * description: POST — переключает глобальный флаг public_signup_open в true (релиз).
 *   После этого регистрация открыта всем без проверки бета-листа.
 *   Также возвращаем флаг в false (если случайно включили).
 * created: 2026-04-29
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { requireSuperadmin } from '@/lib/superadmin/auth';
import { logSuperadminAction } from '@/lib/superadmin/access';
import { notifySuperadmin } from '@/lib/notifications/superadmin-notify';

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

async function guard(): Promise<{ profileId: string; email: string } | NextResponse> {
  try {
    return await requireSuperadmin();
  } catch (r) {
    if (r instanceof NextResponse) return r;
    if (r instanceof Response) return new NextResponse(r.body, { status: r.status });
    return new NextResponse('not found', { status: 404 });
  }
}

export async function POST(req: Request) {
  const sa = await guard();
  if (sa instanceof NextResponse) return sa;

  const body = (await req.json().catch(() => ({}))) as { open?: boolean };
  const next = body.open === true;

  const db = admin();
  const { error } = await db
    .from('app_settings')
    .update({
      value: next as unknown as object,
      updated_at: new Date().toISOString(),
      updated_by: sa.profileId,
    })
    .eq('key', 'public_signup_open');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logSuperadminAction(
    sa.profileId,
    next ? 'public_signup_opened' : 'public_signup_closed',
    'app_settings',
    null,
    { value: next },
  );

  // Уведомляем самого Данила в @crescasuperadmin_bot — это критическое действие
  const kyivTime = new Date().toLocaleString('ru-RU', {
    timeZone: 'Europe/Kyiv',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
  await notifySuperadmin(
    next
      ? `<b>Сервис опубликован для всех</b>\n\nРегистрация теперь открыта без бета-проверки.\nДата: ${kyivTime}`
      : `<b>Сервис снова закрыт (только бета)</b>\n\nРегистрация снова требует бета-приглашения.\nДата: ${kyivTime}`,
  );

  return NextResponse.json({ ok: true, public_signup_open: next });
}
