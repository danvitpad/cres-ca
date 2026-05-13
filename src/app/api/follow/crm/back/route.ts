/** --- YAML
 * name: Master Follow Client
 * description: POST {clientProfileId} — мастер подписывается на клиента
 *              (UPSERT row: master_follows_back=true). Если row не существовала
 *              (клиент не был подписан) — создаём с client_follows=false.
 *              DELETE — мастер отписывается. Снимаем master_follows_back; триггер
 *              удалит row если обе стороны теперь false.
 * created: 2026-04-16
 * updated: 2026-05-13
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { notifyUser } from '@/lib/notifications/notify';

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

  const body = (await req.json().catch(() => ({}))) as { clientProfileId?: string };
  const clientProfileId = body.clientProfileId?.trim();
  if (!clientProfileId) return NextResponse.json({ error: 'invalid_client' }, { status: 400 });

  const { data: master } = await supabase
    .from('masters')
    .select('id, display_name, profiles:profiles!masters_profile_id_fkey(full_name)')
    .eq('profile_id', user.id)
    .maybeSingle();
  if (!master) return NextResponse.json({ error: 'not_a_master' }, { status: 403 });

  const adm = admin();

  // UPSERT: если row есть — UPDATE, иначе INSERT с client_follows=false.
  const { data: existing } = await adm
    .from('client_master_links')
    .select('profile_id, client_follows')
    .eq('profile_id', clientProfileId)
    .eq('master_id', master.id)
    .maybeSingle();

  let mutual = false;
  if (existing) {
    mutual = existing.client_follows === true;
    await adm
      .from('client_master_links')
      .update({
        master_follows_back: true,
        master_followed_back_at: new Date().toISOString(),
        master_dismissed_back_request: false,
      })
      .eq('profile_id', clientProfileId)
      .eq('master_id', master.id);
  } else {
    const { error } = await adm.from('client_master_links').insert({
      profile_id: clientProfileId,
      master_id: master.id,
      client_follows: false,
      master_follows_back: true,
      master_followed_back_at: new Date().toISOString(),
    });
    if (error) return NextResponse.json({ error: 'insert_failed', detail: error.message }, { status: 500 });
  }

  // Ensure client record exists for this follower (mirror to master's CRM).
  const { data: clientProfile } = await adm
    .from('profiles')
    .select('full_name, phone, email')
    .eq('id', clientProfileId)
    .maybeSingle();

  if (clientProfile) {
    const { data: existingClient } = await adm
      .from('clients')
      .select('id')
      .eq('profile_id', clientProfileId)
      .eq('master_id', master.id)
      .maybeSingle();
    if (!existingClient) {
      await adm.from('clients').insert({
        profile_id: clientProfileId,
        master_id: master.id,
        full_name: clientProfile.full_name || 'Клиент',
        phone: clientProfile.phone || null,
        email: clientProfile.email || null,
      });
    }
  }

  // Notify client.
  const masterProfile = master.profiles as unknown as { full_name: string } | null;
  const masterName = master.display_name || masterProfile?.full_name || 'Мастер';
  await notifyUser(adm, {
    profileId: clientProfileId,
    title: mutual ? 'Подписка стала взаимной' : 'Новый подписчик',
    body: `${masterName} подписался на вас`,
    data: {
      type: 'master_followed_you',
      master_id: master.id,
      mutual,
    },
    deepLinkPath: '/telegram/profile',
    deepLinkLabel: 'Открыть',
  });

  return NextResponse.json({ mutual });
}

export async function DELETE(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const clientProfileId = searchParams.get('clientProfileId');
  if (!clientProfileId) return NextResponse.json({ error: 'invalid_client' }, { status: 400 });

  const { data: master } = await supabase
    .from('masters')
    .select('id')
    .eq('profile_id', user.id)
    .maybeSingle();
  if (!master) return NextResponse.json({ error: 'not_a_master' }, { status: 403 });

  // UPDATE flag → trigger удалит row если client_follows тоже false.
  await supabase
    .from('client_master_links')
    .update({
      master_follows_back: false,
      master_followed_back_at: null,
    })
    .eq('profile_id', clientProfileId)
    .eq('master_id', master.id);

  return NextResponse.json({ mutual: false });
}
