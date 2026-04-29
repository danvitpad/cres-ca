/** --- YAML
 * name: Salon Follow API
 * description: POST/DELETE — клиент добавляет/убирает салон из контактов.
 *              POST: пишет в salon_follows + шлёт уведомление владельцу.
 *              DELETE: удаляет.
 *              Salon clients GET сам join-ит salon_follows + clients (см. salon/[id]/clients/route.ts).
 * created: 2026-04-29
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

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: salonId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: salon } = await supabase
    .from('salons')
    .select('id, name, owner_id')
    .eq('id', salonId)
    .maybeSingle();
  if (!salon) return NextResponse.json({ error: 'salon_not_found' }, { status: 404 });

  const { data: existing } = await supabase
    .from('salon_follows')
    .select('id')
    .eq('profile_id', user.id)
    .eq('salon_id', salonId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ following: true });
  }

  const { error } = await supabase
    .from('salon_follows')
    .insert({ profile_id: user.id, salon_id: salonId });
  if (error) {
    return NextResponse.json({ error: 'insert_failed', detail: error.message }, { status: 500 });
  }

  if (salon.owner_id && salon.owner_id !== user.id) {
    const adm = admin();
    const { data: profile } = await adm
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle();
    const clientName = profile?.full_name || 'Клиент';
    await notifyUser(adm, {
      profileId: salon.owner_id,
      title: 'Новый контакт салона',
      body: `${clientName} добавил ваш салон в контакты`,
      data: {
        type: 'salon_new_contact',
        follower_profile_id: user.id,
        salon_id: salonId,
        action_url: `/salon/${salonId}/clients`,
      },
      deepLinkPath: `/telegram/m/salon/${salonId}/clients`,
      deepLinkLabel: 'Открыть клиентов',
    });
  }

  return NextResponse.json({ following: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: salonId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  await supabase
    .from('salon_follows')
    .delete()
    .eq('profile_id', user.id)
    .eq('salon_id', salonId);

  return NextResponse.json({ following: false });
}
