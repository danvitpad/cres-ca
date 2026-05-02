/** --- YAML
 * name: Master ID Helper
 * description: Возвращает master_id текущего пользователя (если он мастер).
 *              Используется в /guilds/[id] чтобы определить isOwner на клиенте.
 * created: 2026-05-02
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: master } = await supabase
    .from('masters')
    .select('id')
    .eq('profile_id', user.id)
    .maybeSingle();

  return NextResponse.json({ master_id: (master as { id: string } | null)?.id ?? null });
}
