/** --- YAML
 * name: Superadmin beta — approve / reject / delete
 * description: PATCH — изменить статус заявки (approved | rejected). На approve
 *   отправляем юзеру в TG (если у него telegram_id) сообщение «вас добавили».
 *   DELETE — удалить заявку.
 * created: 2026-04-29
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { requireSuperadmin } from '@/lib/superadmin/auth';
import { logSuperadminAction } from '@/lib/superadmin/access';
import { sendViaSuperadminBot } from '@/lib/notifications/superadmin-notify';

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

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const sa = await guard();
  if (sa instanceof NextResponse) return sa;

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    status?: 'approved' | 'rejected';
    rejection_reason?: string;
    note?: string;
  };

  if (!body.status || !['approved', 'rejected'].includes(body.status)) {
    return NextResponse.json({ error: 'invalid_status' }, { status: 400 });
  }

  const db = admin();
  const patch: Record<string, unknown> = { status: body.status };
  if (body.status === 'approved') {
    patch.approved_at = new Date().toISOString();
    patch.approved_by = sa.profileId;
  } else {
    patch.rejected_at = new Date().toISOString();
    if (body.rejection_reason) patch.rejection_reason = body.rejection_reason;
  }
  if (body.note !== undefined) patch.note = body.note;

  const { data: updated, error } = await db
    .from('beta_invites')
    .update(patch)
    .eq('id', id)
    .select('id, email, telegram_id, full_name, status')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // ── Уведомление пользователю в TG если одобрили ──
  if (body.status === 'approved' && updated.telegram_id) {
    const greeting = updated.full_name ? `, ${updated.full_name}` : '';
    const text =
      `<b>Вас добавили в бета-тестировщики CRES-CA</b>${greeting}.\n\n` +
      `Теперь можете зарегистрироваться: откройте <a href="https://cres-ca.com">cres-ca.com</a> или нажмите кнопку ниже.\n\n` +
      `На время бета-тестирования и ещё 6 месяцев после релиза — полный функционал бесплатно.\n\n` +
      `Если найдёте баг или неудобство — пишите нам в этом же боте, мы быстро всё чиним.`;
    await sendViaSuperadminBot(updated.telegram_id, text, {
      buttons: [[{ text: 'Открыть сайт', url: 'https://cres-ca.com' }]],
    });
  }

  await logSuperadminAction(sa.profileId, `beta_${body.status}`, 'beta_invite', id, patch);

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const sa = await guard();
  if (sa instanceof NextResponse) return sa;

  const { id } = await params;
  const db = admin();
  const { error } = await db.from('beta_invites').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logSuperadminAction(sa.profileId, 'beta_delete', 'beta_invite', id, {});
  return NextResponse.json({ ok: true });
}
