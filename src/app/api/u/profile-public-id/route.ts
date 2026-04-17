/** --- YAML
 * name: Resolve profile.public_id by id
 * description: Lightweight server endpoint for clients that can't directly
 *              query profiles (e.g. Telegram WebView without Supabase JWT).
 * created: 2026-04-17
 * --- */

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'missing_id' }, { status: 400 });

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data } = await admin
    .from('profiles')
    .select('public_id')
    .eq('id', id)
    .maybeSingle();

  return NextResponse.json({ publicId: data?.public_id ?? null });
}
