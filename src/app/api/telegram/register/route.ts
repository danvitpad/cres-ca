/** --- YAML
 * name: Telegram Register API
 * description: Creates/links a profile from validated Telegram initData + collected fields (phone, optional DoB). Called after user grants consent on welcome screen.
 * --- */

import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { isValidAsciiEmail } from '@/lib/errors';

interface TgUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
}

function validateInitData(initData: string): TgUser | null {
  const botToken = (process.env.TELEGRAM_BOT_TOKEN ?? '').trim();
  if (!botToken) return null;

  const searchParams = new URLSearchParams(initData);
  const hash = searchParams.get('hash');
  if (!hash) return null;

  searchParams.delete('hash');
  const dataCheckString = Array.from(searchParams.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hmac = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  if (hmac !== hash) return null;

  const userStr = searchParams.get('user');
  if (!userStr) return null;
  return JSON.parse(userStr) as TgUser;
}

function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  if (digits.length < 9 || digits.length > 15) return null;
  return '+' + digits;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const {
    initData,
    phone,
    email,
    password,
    firstName,
    lastName,
    middleName,
    dateOfBirth,
    fullNameOverride,
    salonName,
    linkTelegram = true,
    role = 'client',
  } = body as {
    initData?: string;
    phone?: string;
    email?: string;
    password?: string;
    firstName?: string;
    lastName?: string;
    middleName?: string | null;
    dateOfBirth?: string | null;
    fullNameOverride?: string;
    salonName?: string;
    linkTelegram?: boolean;
    role?: 'client' | 'master' | 'salon_admin';
  };

  const safeRole: 'client' | 'master' | 'salon_admin' =
    role === 'master' ? 'master' : role === 'salon_admin' ? 'salon_admin' : 'client';

  if (safeRole === 'salon_admin' && !salonName?.trim()) {
    return NextResponse.json({ error: 'missing_salon_name' }, { status: 400 });
  }

  if (!initData) return NextResponse.json({ error: 'missing_init_data' }, { status: 400 });
  if (!phone) return NextResponse.json({ error: 'missing_phone' }, { status: 400 });
  if (!firstName?.trim() || !lastName?.trim()) {
    return NextResponse.json({ error: 'missing_name' }, { status: 400 });
  }
  if (!email?.trim()) return NextResponse.json({ error: 'missing_email' }, { status: 400 });
  if (!isValidAsciiEmail(email)) return NextResponse.json({ error: 'invalid_email' }, { status: 400 });
  if (!password || password.length < 8) {
    return NextResponse.json({ error: 'weak_password' }, { status: 400 });
  }

  const tg = validateInitData(initData);
  if (!tg) return NextResponse.json({ error: 'invalid_init_data' }, { status: 403 });

  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) return NextResponse.json({ error: 'invalid_phone' }, { status: 400 });

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const personalName =
    fullNameOverride?.trim() ||
    [firstName, middleName, lastName]
      .map((s) => s?.trim())
      .filter((s): s is string => Boolean(s))
      .join(' ') ||
    `tg_${tg.id}`;

  // For salon_admin, `full_name` on the profile = salon name (matches web /register behaviour)
  const fullName = safeRole === 'salon_admin' ? salonName!.trim() : personalName;

  // Only store TG identifiers if user opted in (per consent checkbox).
  // Always stash the numeric id so we can recognize this user on next entry,
  // but skip username/photo/language if linkTelegram === false.
  const tgPatch: Record<string, unknown> = {
    telegram_id: tg.id,
    telegram_username: linkTelegram ? (tg.username ?? null) : null,
    telegram_photo_url: null,
    language_code: linkTelegram ? (tg.language_code ?? null) : null,
    telegram_linked_at: new Date().toISOString(),
    phone: normalizedPhone,
    email: email || null,
    date_of_birth: dateOfBirth || null,
  };

  // 1. Already linked by telegram_id → update missing fields
  const { data: byTg } = await admin
    .from('profiles')
    .select('id, role, public_id')
    .eq('telegram_id', tg.id)
    .maybeSingle();

  if (byTg) {
    await admin.from('profiles').update(tgPatch).eq('id', byTg.id);
    if (safeRole === 'master' && byTg.role !== 'master') {
      await admin.from('profiles').update({ role: 'master' }).eq('id', byTg.id);
      await ensureMasterRow(admin, byTg.id, fullName);
    }
    if (safeRole === 'salon_admin' && byTg.role !== 'salon_admin') {
      await admin.from('profiles').update({ role: 'salon_admin', full_name: fullName }).eq('id', byTg.id);
      await ensureSalonAndMaster(admin, byTg.id, fullName);
    }
    await admin.from('telegram_sessions').upsert({ chat_id: tg.id, profile_id: byTg.id, logged_in_at: new Date().toISOString() }, { onConflict: 'chat_id' });
    const resolvedRole = safeRole === 'client' ? byTg.role : safeRole;
    return NextResponse.json({ userId: byTg.id, role: resolvedRole, publicId: byTg.public_id, isNew: false });
  }

  // 2. Phone matches an existing profile without telegram_id → link
  const { data: byPhone } = await admin
    .from('profiles')
    .select('id, role, public_id, telegram_id')
    .eq('phone', normalizedPhone)
    .is('telegram_id', null)
    .maybeSingle();

  if (byPhone) {
    await admin.from('profiles').update(tgPatch).eq('id', byPhone.id);
    if (safeRole === 'master' && byPhone.role !== 'master') {
      await admin.from('profiles').update({ role: 'master' }).eq('id', byPhone.id);
      await ensureMasterRow(admin, byPhone.id, fullName);
    }
    if (safeRole === 'salon_admin' && byPhone.role !== 'salon_admin') {
      await admin.from('profiles').update({ role: 'salon_admin', full_name: fullName }).eq('id', byPhone.id);
      await ensureSalonAndMaster(admin, byPhone.id, fullName);
    }
    await admin.from('telegram_sessions').upsert({ chat_id: tg.id, profile_id: byPhone.id, logged_in_at: new Date().toISOString() }, { onConflict: 'chat_id' });
    const resolvedRole = safeRole === 'client' ? byPhone.role : safeRole;
    return NextResponse.json({ userId: byPhone.id, role: resolvedRole, publicId: byPhone.public_id, isNew: false, linkedExisting: true });
  }

  // 3. Create new auth user + profile via admin API
  const authEmail = email.trim().toLowerCase();

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: authEmail,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      role: safeRole,
      telegram_id: tg.id,
    },
  });

  if (createErr || !created.user) {
    const msg = createErr?.message?.toLowerCase() ?? '';
    if (msg.includes('already') || msg.includes('registered') || msg.includes('exists')) {
      return NextResponse.json({ error: 'email_taken', detail: createErr?.message }, { status: 409 });
    }
    if (msg.includes('invalid') && msg.includes('email')) {
      return NextResponse.json({ error: 'invalid_email', detail: createErr?.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'create_failed', detail: createErr?.message }, { status: 500 });
  }

  // Ensure profile row exists (in case DB trigger did not populate one)
  const { data: existingProfile } = await admin
    .from('profiles')
    .select('id')
    .eq('id', created.user.id)
    .maybeSingle();

  if (!existingProfile) {
    await admin.from('profiles').insert({
      id: created.user.id,
      role: safeRole,
      full_name: fullName,
      ...tgPatch,
    });
  } else {
    await admin.from('profiles').update({ role: safeRole, full_name: fullName, ...tgPatch }).eq('id', created.user.id);
  }

  if (safeRole === 'client') {
    const { data: existingClient } = await admin
      .from('clients')
      .select('id')
      .eq('profile_id', created.user.id)
      .maybeSingle();

    if (!existingClient) {
      await admin.from('clients').insert({
        profile_id: created.user.id,
        full_name: fullName,
        phone: normalizedPhone,
      });
    }
  } else if (safeRole === 'master') {
    await ensureMasterRow(admin, created.user.id, fullName);
  } else {
    // salon_admin — trigger creates salons+masters automatically, but we ensure as safety net
    await ensureSalonAndMaster(admin, created.user.id, fullName);
  }

  // Sign in on the server client so cookies are set for subsequent requests
  const supabase = await createClient();
  await supabase.auth.signInWithPassword({ email: authEmail, password });

  const { data: fresh } = await admin
    .from('profiles')
    .select('public_id')
    .eq('id', created.user.id)
    .single();

  // Record telegram session for voice/bot interactions
  await admin.from('telegram_sessions').upsert({ chat_id: tg.id, profile_id: created.user.id, logged_in_at: new Date().toISOString() }, { onConflict: 'chat_id' });

  return NextResponse.json({
    userId: created.user.id,
    role: safeRole,
    publicId: fresh?.public_id ?? null,
    isNew: true,
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ensureMasterRow(admin: any, profileId: string, displayName: string): Promise<void> {
  const { data: existing } = await admin
    .from('masters')
    .select('id')
    .eq('profile_id', profileId)
    .maybeSingle();
  if (existing) return;
  await admin.from('masters').insert({
    profile_id: profileId,
    display_name: displayName,
    is_active: true,
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ensureSalonAndMaster(admin: any, profileId: string, salonName: string): Promise<void> {
  let salonId: string | null = null;
  const { data: existingSalon } = await admin
    .from('salons')
    .select('id')
    .eq('owner_id', profileId)
    .maybeSingle();
  if (existingSalon) {
    salonId = existingSalon.id;
  } else {
    const { data: newSalon } = await admin
      .from('salons')
      .insert({ owner_id: profileId, name: salonName })
      .select('id')
      .single();
    salonId = newSalon?.id ?? null;
  }

  const { data: existingMaster } = await admin
    .from('masters')
    .select('id')
    .eq('profile_id', profileId)
    .maybeSingle();
  if (!existingMaster && salonId) {
    await admin.from('masters').insert({
      profile_id: profileId,
      display_name: salonName,
      salon_id: salonId,
      is_active: true,
    });
  }
}
