/** --- YAML
 * name: Telegram Unlink (Hard Sign-Out)
 * description: Detaches caller's telegram_id from their profile so the next
 *              /telegram/auth ping doesn't auto-relink them back to the same
 *              account. Called from Mini App signOut flow before
 *              supabase.auth.signOut().
 * created: 2026-04-20
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  await admin
    .from('profiles')
    .update({ telegram_id: null, telegram_linked_at: null })
    .eq('id', user.id);

  return NextResponse.json({ ok: true });
}
