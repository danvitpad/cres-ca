/** --- YAML
 * name: Pairing Consume API
 * description: Consumes a 6-digit pairing code and creates a client_master_links row between the issuer and the current user. Both sides must be opposite roles (client ↔ master).
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  const { code } = await request.json().catch(() => ({}));
  if (!code || typeof code !== 'string' || code.length !== 6) {
    return NextResponse.json({ error: 'invalid_code' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: me } = await admin
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .single();

  if (!me) return NextResponse.json({ error: 'no_profile' }, { status: 404 });

  const { data: pairing } = await admin
    .from('pairing_codes')
    .select('code, issuer_id, issuer_role, expires_at, consumed_by')
    .eq('code', code)
    .maybeSingle();

  if (!pairing) return NextResponse.json({ error: 'code_not_found' }, { status: 404 });
  if (pairing.consumed_by) return NextResponse.json({ error: 'already_consumed' }, { status: 410 });
  if (new Date(pairing.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: 'expired' }, { status: 410 });
  }
  if (pairing.issuer_id === me.id) {
    return NextResponse.json({ error: 'self_pairing' }, { status: 400 });
  }

  // Determine client vs master
  const masterRoles = ['master', 'salon'];
  const issuerIsMaster = masterRoles.includes(pairing.issuer_role);
  const consumerIsMaster = masterRoles.includes(me.role);

  if (issuerIsMaster === consumerIsMaster) {
    return NextResponse.json({ error: 'role_mismatch' }, { status: 400 });
  }

  const clientProfileId = issuerIsMaster ? me.id : pairing.issuer_id;
  const masterProfileId = issuerIsMaster ? pairing.issuer_id : me.id;

  // Resolve masters.id from master profile
  const { data: masterRow } = await admin
    .from('masters')
    .select('id')
    .eq('profile_id', masterProfileId)
    .maybeSingle();

  if (!masterRow) {
    return NextResponse.json({ error: 'master_row_missing' }, { status: 500 });
  }

  await admin.from('pairing_codes').update({
    consumed_by: me.id,
    consumed_at: new Date().toISOString(),
  }).eq('code', code);

  await admin.from('client_master_links').upsert(
    { profile_id: clientProfileId, master_id: masterRow.id, source: 'pair' },
    { onConflict: 'profile_id,master_id' },
  );

  const { data: issuerProfile } = await admin
    .from('profiles')
    .select('public_id, full_name, telegram_username, avatar_url, telegram_photo_url')
    .eq('id', pairing.issuer_id)
    .single();

  return NextResponse.json({
    linked: true,
    role: issuerIsMaster ? 'master' : 'client',
    partner: issuerProfile,
  });
}
