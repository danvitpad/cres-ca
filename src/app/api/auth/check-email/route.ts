/** --- YAML
 * name: Check Email Existence API
 * description: Returns whether an email is already registered. Used by login page to redirect new users to /register and existing users to password step.
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  const { email } = await request.json();
  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'email required' }, { status: 400 });
  }

  const lower = email.toLowerCase();
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(lower)}`;
  const res = await fetch(url, {
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
    },
  });

  if (!res.ok) return NextResponse.json({ exists: false });

  const json = (await res.json()) as { users?: Array<{ id: string; email?: string }> };
  const user = json.users?.find((u) => u.email?.toLowerCase() === lower);
  if (!user) return NextResponse.json({ exists: false });

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data: profile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  return NextResponse.json({ exists: true, role: profile?.role ?? null });
}
