/** --- YAML
 * name: CRM Follow Toggle
 * description: POST {masterId} → toggles client↔master follow. Creates notification on follow. Returns {following, mutual}.
 * created: 2026-04-16
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { notifyUser } from '@/lib/notifications/notify';

// Service-role client used after auth validation to bypass RLS for the
// auto-create-client + notification side-effects. The primary follow toggle
// (client_master_links) runs as the user via cookies, so RLS still enforces
// that they can only toggle their own row.
function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { masterId?: string };
  const masterId = body.masterId?.trim();
  if (!masterId) return NextResponse.json({ error: 'invalid_master' }, { status: 400 });

  const { data: existing } = await supabase
    .from('client_master_links')
    .select('profile_id, master_follows_back')
    .eq('profile_id', user.id)
    .eq('master_id', masterId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from('client_master_links')
      .delete()
      .eq('profile_id', user.id)
      .eq('master_id', masterId);
    return NextResponse.json({ following: false, mutual: false });
  }

  const { error } = await supabase
    .from('client_master_links')
    .insert({ profile_id: user.id, master_id: masterId });

  if (error) {
    return NextResponse.json({ error: 'insert_failed', detail: error.message }, { status: 500 });
  }

  // Auto-create clients record so master can select this person in calendar/appointments.
  // RLS on `clients` only allows the master to insert — a client following their own
  // future master can't insert their own clients row directly. Use admin (post auth-check)
  // to mirror the link into the master's CRM.
  const adm = admin();
  const [{ data: profile }, { data: master }] = await Promise.all([
    adm.from('profiles').select('full_name, phone, email, date_of_birth').eq('id', user.id).maybeSingle(),
    adm.from('masters').select('id, profile_id').eq('id', masterId).maybeSingle(),
  ]);

  if (profile) {
    // Use SELECT + INSERT (not upsert) since clients has a partial unique index
    // (profile_id, master_id) WHERE profile_id IS NOT NULL — Postgres ON CONFLICT
    // can't target partial indexes with simple onConflict spec.
    const { data: existingClient } = await adm
      .from('clients')
      .select('id')
      .eq('profile_id', user.id)
      .eq('master_id', masterId)
      .maybeSingle();
    if (!existingClient) {
      await adm.from('clients').insert({
        profile_id: user.id,
        master_id: masterId,
        full_name: profile.full_name || 'Клиент',
        phone: profile.phone || null,
        email: profile.email || null,
        date_of_birth: profile.date_of_birth || null,
      });
    }
  }

  if (master?.profile_id) {
    const clientName = profile?.full_name || 'Клиент';
    await notifyUser(adm, {
      profileId: master.profile_id,
      title: 'Новый контакт',
      body: `${clientName} добавил вас в контакты`,
      data: { type: 'new_follower', follower_profile_id: user.id },
      deepLinkPath: '/telegram/m/clients',
      deepLinkLabel: 'Открыть клиентов',
    });
  }

  return NextResponse.json({ following: true, mutual: false });
}
