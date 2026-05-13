/** --- YAML
 * name: Pending Client Subscribers (master side)
 * description: GET — клиенты, которые подписались на меня (мастера), но я ещё на них не подписался.
 *              Используется в /telegram/m/clients (секция "Новые подписчики").
 *              Скрываем те, где master_dismissed_back_request=true.
 * created: 2026-05-13
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { resolveUserId } from '@/lib/auth/resolve-user';

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

  const { data: master } = await adm
    .from('masters')
    .select('id')
    .eq('profile_id', userId)
    .maybeSingle();
  if (!master) return NextResponse.json({ error: 'not_a_master' }, { status: 403 });

  const { data: links } = await adm
    .from('client_master_links')
    .select('profile_id, created_at')
    .eq('master_id', master.id)
    .eq('client_follows', true)
    .eq('master_follows_back', false)
    .eq('master_dismissed_back_request', false)
    .order('created_at', { ascending: false });

  const rows = (links ?? []) as Array<{ profile_id: string; created_at: string | null }>;
  if (rows.length === 0) return NextResponse.json({ clients: [] });

  const { data: profileRows } = await adm
    .from('profiles')
    .select('id, full_name, avatar_url, phone, email, public_id')
    .in('id', rows.map((r) => r.profile_id));

  type Row = {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    phone: string | null;
    email: string | null;
    public_id: string | null;
  };

  const byCreated = new Map(rows.map((r) => [r.profile_id, r.created_at]));
  const clients = ((profileRows ?? []) as Row[]).map((p) => ({
    profileId: p.id,
    name: p.full_name ?? 'Клиент',
    avatar: p.avatar_url,
    phone: p.phone,
    email: p.email,
    publicId: p.public_id,
    subscribedAt: byCreated.get(p.id) ?? null,
  }));

  return NextResponse.json({ clients });
}
