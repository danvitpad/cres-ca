/** --- YAML
 * name: Delete Account API
 * description: Permanently deletes the authenticated user's account and all related data. Uses service-role admin client to delete auth.users which cascades to profiles and beyond via FK.
 * created: 2026-04-17
 * updated: 2026-04-17
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Use service-role client to delete the auth user
    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    // Delete auth user — cascades to profiles / masters / clients / appointments / etc.
    const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
    if (delErr) {
      console.error('[delete-account] auth delete failed:', delErr);
      return NextResponse.json({ error: delErr.message }, { status: 500 });
    }

    // Sign out this session (client will redirect to /login)
    await supabase.auth.signOut();

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[delete-account] error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
