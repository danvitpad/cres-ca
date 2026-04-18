/** --- YAML
 * name: Public Invite Lookup
 * description: GET by code — returns invite info (salon name, role, expiry, used) for the acceptance page.
 *              Uses service_role to bypass RLS since invitee is not yet in salon_members.
 * created: 2026-04-19
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: invite } = await admin
    .from('salon_invites')
    .select('id, salon_id, role, expires_at, used_at, used_by')
    .eq('code', code)
    .maybeSingle();

  if (!invite) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const { data: salon } = await admin
    .from('salons')
    .select('id, name, logo_url, team_mode')
    .eq('id', invite.salon_id)
    .maybeSingle();

  const expired = new Date(invite.expires_at).getTime() < Date.now();

  return NextResponse.json({
    invite: {
      id: invite.id,
      role: invite.role,
      expires_at: invite.expires_at,
      used_at: invite.used_at,
      used_by: invite.used_by,
      expired,
    },
    salon: salon
      ? { id: salon.id, name: salon.name, logo_url: salon.logo_url, team_mode: salon.team_mode }
      : null,
  });
}
