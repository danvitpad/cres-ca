/** --- YAML
 * name: Pairing Issue API
 * description: Authenticated user generates a 6-digit pairing code valid for 60 seconds. Used for master↔client quick connect.
 * --- */

import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@/lib/supabase/server';

const CODE_TTL_SECONDS = 60;

function generateNumericCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) code += crypto.randomInt(0, 10).toString();
  return code;
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .single();

  if (!profile) return NextResponse.json({ error: 'no_profile' }, { status: 404 });

  // Avoid PK collisions — retry only on unique_violation (23505)
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateNumericCode();
    const expiresAt = new Date(Date.now() + CODE_TTL_SECONDS * 1000).toISOString();
    const { error } = await supabase.from('pairing_codes').insert({
      code,
      issuer_id: profile.id,
      issuer_role: profile.role,
      expires_at: expiresAt,
    });
    if (!error) {
      return NextResponse.json({ code, expiresAt, ttl: CODE_TTL_SECONDS });
    }
    if (error.code !== '23505') {
      return NextResponse.json({ error: 'insert_failed', detail: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ error: 'code_collision' }, { status: 500 });
}
