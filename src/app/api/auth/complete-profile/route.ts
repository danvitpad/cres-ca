/** --- YAML
 * name: Complete Profile API
 * description: Сохраняет имя/фамилию/телефон/ДР после Google OAuth signup'а.
 *              Обновляет profiles.full_name + дополнительные поля + auth.users
 *              user_metadata. Возвращает next-URL по роли.
 * created: 2026-04-28
 * --- */

import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

function adminDb() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    first_name?: string;
    last_name?: string;
    phone?: string;
    date_of_birth?: string;
    password_set?: boolean;
  };

  const firstName = (body.first_name || '').trim();
  const lastName = (body.last_name || '').trim();
  const phone = (body.phone || '').trim();
  const dob = (body.date_of_birth || '').trim();
  const passwordSet = body.password_set === true;

  if (!firstName) {
    return NextResponse.json({ error: 'first_name_required' }, { status: 400 });
  }

  const fullName = `${firstName} ${lastName}`.trim();

  const update: Record<string, unknown> = {
    full_name: fullName,
    phone: phone || null,
    date_of_birth: dob || null,
  };
  if (passwordSet) update.password_set = true;

  const { error: profErr } = await supabase
    .from('profiles')
    .update(update)
    .eq('id', user.id);
  if (profErr) {
    return NextResponse.json({ error: profErr.message }, { status: 500 });
  }

  // Обновляем user_metadata тоже — некоторые места читают именно оттуда.
  try {
    const admin = adminDb();
    await admin.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...user.user_metadata,
        full_name: fullName,
        first_name: firstName,
        last_name: lastName,
        phone: phone || null,
        date_of_birth: dob || null,
      },
    });
  } catch { /* не критично */ }

  // Узнаём роль и возвращаем next URL.
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  const role = (profile?.role as 'client' | 'master' | 'salon_admin') ?? 'client';

  const next = role === 'client' ? '/feed' : '/onboarding/account-type';
  return NextResponse.json({ ok: true, next });
}
