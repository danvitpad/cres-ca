/** --- YAML
 * name: ClientFavorites
 * description: >
 *   GET  → { masterProfileIds: string[] }  — list of favorited master profile IDs.
 *   POST { masterProfileId } → toggle client_master_links; side-effects: notify master + auto-CRM.
 *   Auth: resolveUserId (cookie OR X-TG-Init-Data). Data stored in Supabase, not Telegram.
 * created: 2026-05-09
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { resolveUserId } from '@/lib/auth/resolve-user';
import { notifyUser } from '@/lib/notifications/notify';

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function GET(req: Request) {
  const userId = await resolveUserId(req);
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const adm = admin();
  const { data, error } = await adm
    .from('client_master_links')
    .select('masters:masters!client_master_links_master_id_fkey(profile_id)')
    .eq('profile_id', userId);

  if (error) return NextResponse.json({ error: 'query_failed' }, { status: 500 });

  const masterProfileIds = (data ?? [])
    .map((row) => (row.masters as unknown as { profile_id: string | null } | null)?.profile_id)
    .filter(Boolean) as string[];

  return NextResponse.json({ masterProfileIds });
}

export async function POST(req: Request) {
  const userId = await resolveUserId(req);
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({})) as { masterProfileId?: string };
  const masterProfileId = body.masterProfileId?.trim();
  if (!masterProfileId) return NextResponse.json({ error: 'missing_master_profile_id' }, { status: 400 });

  const adm = admin();

  const { data: masterRow } = await adm
    .from('masters')
    .select('id, profile_id')
    .eq('profile_id', masterProfileId)
    .maybeSingle();

  if (!masterRow) return NextResponse.json({ error: 'master_not_found' }, { status: 404 });

  const masterId = masterRow.id;

  const { data: existing } = await adm
    .from('client_master_links')
    .select('profile_id')
    .eq('profile_id', userId)
    .eq('master_id', masterId)
    .maybeSingle();

  if (existing) {
    await adm.from('client_master_links').delete().eq('profile_id', userId).eq('master_id', masterId);
    return NextResponse.json({ favorited: false });
  }

  const { error } = await adm.from('client_master_links').insert({ profile_id: userId, master_id: masterId });
  if (error) return NextResponse.json({ error: 'insert_failed' }, { status: 500 });

  // Auto-add client to master's CRM + notify master
  const [{ data: profile }] = await Promise.all([
    adm.from('profiles').select('full_name, phone, email, date_of_birth').eq('id', userId).maybeSingle(),
  ]);

  if (profile) {
    const { data: existingClient } = await adm
      .from('clients')
      .select('id')
      .eq('profile_id', userId)
      .eq('master_id', masterId)
      .maybeSingle();
    if (!existingClient) {
      await adm.from('clients').insert({
        profile_id: userId,
        master_id: masterId,
        full_name: profile.full_name || 'Клиент',
        phone: profile.phone || null,
        email: profile.email || null,
        date_of_birth: profile.date_of_birth || null,
      });
    }
  }

  if (masterRow.profile_id) {
    const clientName = profile?.full_name || 'Клиент';
    await notifyUser(adm, {
      profileId: masterRow.profile_id,
      title: 'Новый контакт',
      body: `${clientName} добавил вас в контакты`,
      data: { type: 'new_follower', follower_profile_id: userId },
      deepLinkPath: '/telegram/m/clients',
      deepLinkLabel: 'Открыть клиентов',
    });
  }

  return NextResponse.json({ favorited: true });
}
