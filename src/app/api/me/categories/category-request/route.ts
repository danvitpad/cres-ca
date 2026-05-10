/** --- YAML
 * name: Request New Industry Category
 * description: Мастер предлагает новую категорию верхнего уровня (например, «Аэрография»).
 *              Создаётся pending запись через RPC + шлёт суперадмину TG-сообщение
 *              с inline-кнопками «Принять / Отклонить». Категория появится в
 *              каталоге после ручного апрува в @crescasuperadmin_bot.
 * created: 2026-05-10
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { notifySuperadmin } from '@/lib/notifications/superadmin-notify';

interface Body {
  text: string;
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Body | null;
  const text = body?.text?.trim();
  if (!text || text.length < 2 || text.length > 60) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const { data: categoryId, error } = await supabase.rpc('request_industry_category', { p_text: text });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Best-effort: уведомить суперадмина с inline approve/reject. Если TG-токены
  // не настроены — заявка всё равно создана, апрув можно сделать через SQL.
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', user.id)
    .maybeSingle();
  const who = profile?.full_name || profile?.email || 'мастер';

  await notifySuperadmin(
    `📂 <b>Новая категория-заявка</b>\n\n«${escapeHtml(text)}»\nот ${escapeHtml(who)}\n\nПринять — добавится в каталог. Отклонить — будет скрыта.`,
    {
      parseMode: 'HTML',
      buttons: [[
        { text: '✅ Принять', callback_data: `cat_approve:${categoryId}` },
        { text: '❌ Отклонить', callback_data: `cat_reject:${categoryId}` },
      ]],
    },
  ).catch(() => {});

  return NextResponse.json({ ok: true, categoryId });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
