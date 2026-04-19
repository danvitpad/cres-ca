/** --- YAML
 * name: Superadmin profile search
 * description: GET ?q=... — returns up to 10 profile matches for whitelist / offer forms. 404 for non-superadmin callers.
 * created: 2026-04-19
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { requireSuperadmin } from '@/lib/superadmin/auth';

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function GET(req: Request) {
  try {
    await requireSuperadmin();
  } catch (r) {
    if (r instanceof Response) return r;
    return new NextResponse('not found', { status: 404 });
  }

  const url = new URL(req.url);
  const q = (url.searchParams.get('q') ?? '').trim();
  if (!q) return NextResponse.json({ results: [] });

  const term = q.replace(/%/g, '');
  const db = admin();
  const { data } = await db
    .from('profiles')
    .select('id, full_name, first_name, email, phone, role')
    .or(`full_name.ilike.%${term}%,first_name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`)
    .is('deleted_at', null)
    .limit(10);

  const results = (data ?? []).map((r) => ({
    id: r.id,
    name: r.full_name || r.first_name || 'Без имени',
    email: r.email,
    phone: r.phone,
    role: r.role,
  }));

  return NextResponse.json({ results });
}
