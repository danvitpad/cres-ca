/** --- YAML
 * name: Telegram Master Public Visibility API
 * description: PATCH masters.{phone_public, email_public, dob_public}. Управляет
 *              видимостью контактных данных мастера на его публичной странице
 *              (/m/{handle} и Mini App превью). Тумблеры из Settings → Видимость
 *              на публичной странице.
 * created: 2026-05-07
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { resolveUserId } from '@/lib/auth/resolve-user';

export async function POST(request: Request) {
  const userId = await resolveUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    phone_public?: boolean;
    email_public?: boolean;
    dob_public?: boolean;
  };

  const update: Record<string, boolean> = {};
  if (typeof body.phone_public === 'boolean') update.phone_public = body.phone_public;
  if (typeof body.email_public === 'boolean') update.email_public = body.email_public;
  if (typeof body.dob_public === 'boolean') update.dob_public = body.dob_public;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'no_fields' }, { status: 400 });
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { error } = await admin
    .from('masters')
    .update(update)
    .eq('profile_id', userId);
  if (error) {
    return NextResponse.json({ error: 'update_failed', detail: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
