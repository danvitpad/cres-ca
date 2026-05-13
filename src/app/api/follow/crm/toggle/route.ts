/** --- YAML
 * name: CRM Follow Toggle (client → master)
 * description: POST {masterId} — клиент подписывается / отписывается от мастера.
 *              Работа с симметричной моделью (00155): UPSERT row, тогглим
 *              client_follows. Триггер удаляет row если обе стороны false.
 *              Side effects: auto-create clients row in master CRM + notify master.
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

  const body = (await req.json().catch(() => ({}))) as { masterId?: string };
  const masterId = body.masterId?.trim();
  if (!masterId) return NextResponse.json({ error: 'invalid_master' }, { status: 400 });

  const adm = admin();

  const { data: existing } = await adm
    .from('client_master_links')
    .select('profile_id, client_follows, master_follows_back')
    .eq('profile_id', user.id)
    .eq('master_id', masterId)
    .maybeSingle();

  // Toggle off: клиент уже подписан → снимаем client_follows.
  if (existing && existing.client_follows === true) {
    await adm
      .from('client_master_links')
      .update({ client_follows: false, client_dismissed_back_request: false })
      .eq('profile_id', user.id)
      .eq('master_id', masterId);
    return NextResponse.json({ following: false, mutual: false });
  }

  // Toggle on. Если row есть (мастер подписан, клиент нет) → UPDATE.
  // Иначе INSERT.
  let isMutual = false;
  if (existing) {
    isMutual = existing.master_follows_back === true;
    await adm
      .from('client_master_links')
      .update({ client_follows: true, client_dismissed_back_request: false })
      .eq('profile_id', user.id)
      .eq('master_id', masterId);
  } else {
    const { error } = await adm
      .from('client_master_links')
      .insert({ profile_id: user.id, master_id: masterId, client_follows: true });
    if (error) {
      return NextResponse.json({ error: 'insert_failed', detail: error.message }, { status: 500 });
    }
  }

  // Auto-create clients record so master can select this person.
  const [{ data: profile }, { data: master }] = await Promise.all([
    adm.from('profiles').select('full_name, phone, email, date_of_birth').eq('id', user.id).maybeSingle(),
    adm.from('masters').select('id, profile_id').eq('id', masterId).maybeSingle(),
  ]);

  if (profile) {
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
      title: isMutual ? 'Подписка стала взаимной' : 'Новый подписчик',
      body: `${clientName} подписался на вас`,
      data: { type: 'client_followed_you', follower_profile_id: user.id, mutual: isMutual },
      deepLinkPath: '/telegram/m/clients',
      deepLinkLabel: 'Открыть клиентов',
    });
  }

  return NextResponse.json({ following: true, mutual: isMutual });
}
