/** --- YAML
 * name: Master marketplace opt-in
 * description: POST — master toggles is_public. Generates slug on first opt-in.
 * created: 2026-04-24
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

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

  const body = (await req.json().catch(() => null)) as { is_public?: boolean; headline?: string | null } | null;
  if (!body) return NextResponse.json({ error: 'bad_request' }, { status: 400 });

  const db = admin();

  const { data: master } = await db
    .from('masters')
    .select('id, slug, specialization, city, profile:profiles!masters_profile_id_fkey(full_name, first_name)')
    .eq('profile_id', user.id)
    .maybeSingle();

  type Loaded = { id: string; slug: string | null; specialization: string | null; city: string | null; profile: { full_name: string | null; first_name: string | null } | null };
  const row = master as unknown as Loaded | null;
  if (!row) return NextResponse.json({ error: 'master_not_found' }, { status: 404 });

  let slug = row.slug;
  if (body.is_public && !slug) {
    // Generate slug via RPC on first opt-in
    const fullName = row.profile?.full_name ?? row.profile?.first_name ?? 'master';
    const { data: slugResult } = await db.rpc('generate_master_slug', {
      p_full_name: fullName,
      p_specialization: row.specialization ?? '',
      p_city: row.city ?? '',
    });
    slug = typeof slugResult === 'string' ? slugResult : null;
  }

  const { error } = await db
    .from('masters')
    .update({
      is_public: !!body.is_public,
      slug,
      headline: body.headline ?? null,
    })
    .eq('id', row.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, slug });
}
