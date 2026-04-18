/** --- YAML
 * name: Salon Invites API — list + create
 * description: GET returns pending/used invites for a salon. POST creates a new invite (admin-only).
 *              Uses RLS: only admins of the salon can see/manage invites.
 * created: 2026-04-19
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserRole } from '@/lib/team/roles';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: salonId } = await params;
  const role = await getCurrentUserRole(salonId);
  if (role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('salon_invites')
    .select('id, code, role, email, phone, telegram_username, expires_at, used_at, used_by, created_at')
    .eq('salon_id', salonId)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ invites: data ?? [] });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: salonId } = await params;
  const role = await getCurrentUserRole(salonId);
  if (role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as {
    role?: 'master' | 'receptionist';
    email?: string;
    phone?: string;
    telegram_username?: string;
  };

  if (body.role !== 'master' && body.role !== 'receptionist') {
    return NextResponse.json({ error: 'invalid_role' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('salon_invites')
    .insert({
      salon_id: salonId,
      role: body.role,
      email: body.email ?? null,
      phone: body.phone ?? null,
      telegram_username: body.telegram_username ?? null,
      invited_by: user.id,
    })
    .select('id, code, role, expires_at')
    .single();

  if (error || !data) return NextResponse.json({ error: error?.message ?? 'insert_failed' }, { status: 500 });
  return NextResponse.json({ invite: data });
}
