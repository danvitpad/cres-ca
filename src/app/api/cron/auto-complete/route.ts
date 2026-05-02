/** --- YAML
 * name: Cron: auto-complete past appointments
 * description: Каждый час берёт все записи у которых starts_at прошёл ≥ 30 минут
 *              назад, статус 'booked' или 'confirmed' (т.е. не отменена и
 *              не помечена no_show), и переводит в 'completed'. Раньше
 *              мастер должен был вручную нажимать «Завершить» — забывал,
 *              записи висели как booked, аналитика по доходам ехала.
 *              Теперь любая не-отменённая и не-перенесённая запись через
 *              30 минут после её времени окончания автоматически становится
 *              завершённой. Если мастер потом захочет — может в истории
 *              отменить, и запись уйдёт из отчётов.
 * created: 2026-05-02
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function GET(req: Request) {
  // Простая авторизация — Vercel Cron sends Authorization: Bearer <CRON_SECRET>
  const auth = req.headers.get('authorization') ?? '';
  const expected = `Bearer ${process.env.CRON_SECRET ?? ''}`;
  if (process.env.CRON_SECRET && auth !== expected) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const db = admin();

  // Берём записи которые УЖЕ ДОЛЖНЫ были закончиться (ends_at < now - 30 минут).
  // Если ends_at нет — fallback на starts_at + duration_minutes из service.
  // Простой вариант: берём по ends_at если он есть.
  const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();

  // Берём порциями чтобы не упереться в лимит на запрос
  const { data: candidates, error: selErr } = await db
    .from('appointments')
    .select('id, starts_at, ends_at, status')
    .in('status', ['booked', 'confirmed'])
    .lt('ends_at', cutoff)
    .limit(500);

  if (selErr) return NextResponse.json({ error: selErr.message }, { status: 500 });

  if (!candidates || candidates.length === 0) {
    return NextResponse.json({ ok: true, completed: 0 });
  }

  const ids = (candidates as Array<{ id: string }>).map((a) => a.id);
  const { error: upErr } = await db
    .from('appointments')
    .update({ status: 'completed' })
    .in('id', ids);

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, completed: ids.length });
}
