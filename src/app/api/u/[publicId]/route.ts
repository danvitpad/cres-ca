/** --- YAML
 * name: Public Profile Lookup API
 * description: Returns public card (name, avatar, city, role) for a given CRES-ID (public_id). Used by master lookup and deep links.
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

const ALPHABET = /^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{6}$/;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ publicId: string }> },
) {
  const { publicId } = await params;
  const normalized = publicId.toUpperCase();
  if (!ALPHABET.test(normalized)) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: profile } = await admin
    .from('profiles')
    .select('id, public_id, role, full_name, avatar_url, telegram_username, telegram_photo_url')
    .eq('public_id', normalized)
    .maybeSingle();

  if (!profile) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  let city: string | null = null;
  if (profile.role === 'master') {
    const { data: master } = await admin
      .from('masters')
      .select('city')
      .eq('profile_id', profile.id)
      .maybeSingle();
    city = master?.city ?? null;
  }

  return NextResponse.json({
    publicId: profile.public_id,
    role: profile.role,
    fullName: profile.full_name,
    avatarUrl: profile.avatar_url ?? profile.telegram_photo_url ?? null,
    telegramUsername: profile.telegram_username,
    city,
  });
}
