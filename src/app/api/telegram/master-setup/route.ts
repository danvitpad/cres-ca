/** --- YAML
 * name: Telegram Master Setup
 * description: Saves vertical, specialization and first services after Mini App
 *              onboarding. Called from /telegram/m/onboarding. Uses admin client
 *              to bypass cookie-unreliability in Telegram WebView.
 * created: 2026-04-29
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

interface ServiceInput {
  name: string;
  duration_minutes: number;
  price: number;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    userId?: string;
    vertical?: string;
    specialization?: string;
    workMode?: 'cabinet' | 'mobile' | 'both';
    address?: string;
    services?: ServiceInput[];
  };

  if (!body.userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  // Verify the user exists
  const { data: { user } } = await admin.auth.admin.getUserById(body.userId);
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const userId = user.id;

  // Update profiles.vertical so web guard get_next_onboarding_step() stays satisfied
  if (body.vertical) {
    await admin.from('profiles').update({ vertical: body.vertical }).eq('id', userId);
  }

  // Update masters row
  const masterUpdate: Record<string, unknown> = {};
  if (body.vertical) masterUpdate.vertical = body.vertical;
  if (body.specialization) masterUpdate.specialization = body.specialization;
  if (body.workMode && ['cabinet', 'mobile', 'both'].includes(body.workMode)) {
    masterUpdate.work_mode = body.workMode;
  }
  if (body.address) masterUpdate.address = body.address;

  if (Object.keys(masterUpdate).length > 0) {
    await admin.from('masters').update(masterUpdate).eq('profile_id', userId);
  }

  // Insert services if any
  if (body.services && body.services.length > 0) {
    const { data: masterRow } = await admin
      .from('masters')
      .select('id')
      .eq('profile_id', userId)
      .maybeSingle();

    if (masterRow) {
      const rows = body.services.map((s) => ({
        master_id: masterRow.id,
        name: s.name,
        duration_minutes: s.duration_minutes,
        price: s.price,
        currency: 'UAH',
        is_active: true,
      }));
      const { error } = await admin.from('services').insert(rows);
      if (error) {
        return NextResponse.json(
          { error: 'services_insert_failed', detail: error.message },
          { status: 500 },
        );
      }
    }
  }

  // For salon_admin — also update salons.vertical and return salonId so the
  // onboarding page can redirect to the correct salon dashboard.
  const { data: profileRow } = await admin
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();

  let salonId: string | null = null;
  if (profileRow?.role === 'salon_admin' && body.vertical) {
    const { data: salonRow } = await admin
      .from('salons')
      .update({ vertical: body.vertical })
      .eq('owner_id', userId)
      .select('id')
      .maybeSingle();
    salonId = salonRow?.id ?? null;
  } else if (profileRow?.role === 'salon_admin') {
    // No vertical provided but still need the salonId for redirect
    const { data: salonRow } = await admin
      .from('salons')
      .select('id')
      .eq('owner_id', userId)
      .maybeSingle();
    salonId = salonRow?.id ?? null;
  }

  return NextResponse.json({ ok: true, salonId });
}
