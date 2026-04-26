/** --- YAML
 * name: Salon Join Requests — admin lists / approves / rejects
 * description:
 *   GET /api/salon/[id]/join-requests — список pending+recent заявок (для admin dashboard).
 *   POST /api/salon/[id]/join-requests — { request_id, action: 'approve'|'reject', reason? }
 *   Только для owner салона + admin members. RLS на таблицах + RPC functions
 *   approve_salon_join_request / reject_salon_join_request делают auth check
 *   повторно (security_definer).
 * created: 2026-04-26
 * --- */

import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function isAdmin(supabase: Awaited<ReturnType<typeof createClient>>, salonId: string, userId: string): Promise<boolean> {
  const { data: salon } = await supabase
    .from('salons')
    .select('owner_id')
    .eq('id', salonId)
    .maybeSingle();
  if ((salon as { owner_id: string } | null)?.owner_id === userId) return true;

  const { data: member } = await supabase
    .from('salon_members')
    .select('role, master:masters!salon_members_master_id_fkey(profile_id)')
    .eq('salon_id', salonId)
    .eq('status', 'active')
    .eq('role', 'admin');
  type MemberRow = { role: string; master: { profile_id: string } | { profile_id: string }[] | null };
  const rows = (member as unknown as MemberRow[] | null) ?? [];
  return rows.some((r) => {
    const profile = Array.isArray(r.master) ? r.master[0] : r.master;
    return profile?.profile_id === userId;
  });
}

export async function GET(_req: NextRequest, ctx: RouteContext) {
  const { id: salonId } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  if (!(await isAdmin(supabase, salonId, user.id))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { data: requests } = await supabase
    .from('salon_join_requests')
    .select(`
      id, status, message, created_at, decided_at, decided_by,
      master:masters!salon_join_requests_master_id_fkey(
        id, display_name, specialization, avatar_url, invite_code, rating, total_reviews,
        profile:profiles!masters_profile_id_fkey(full_name)
      )
    `)
    .eq('salon_id', salonId)
    .order('created_at', { ascending: false })
    .limit(50);

  return NextResponse.json({ requests: requests ?? [] });
}

export async function POST(req: NextRequest, ctx: RouteContext) {
  const { id: salonId } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  if (!(await isAdmin(supabase, salonId, user.id))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as
    | { request_id: string; action: 'approve' | 'reject'; reason?: string }
    | null;

  if (!body || !body.request_id || (body.action !== 'approve' && body.action !== 'reject')) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  // Read request to get master_id for notification
  const { data: requestRow } = await supabase
    .from('salon_join_requests')
    .select(`
      id, salon_id, master_id, status,
      master:masters!salon_join_requests_master_id_fkey(profile_id, display_name)
    `)
    .eq('id', body.request_id)
    .maybeSingle();

  if (!requestRow || (requestRow as { salon_id: string }).salon_id !== salonId) {
    return NextResponse.json({ error: 'request_not_found' }, { status: 404 });
  }

  type Profile = { profile_id: string | null; display_name: string | null };
  const masterField = (requestRow as unknown as { master: Profile | Profile[] | null }).master;
  const masterProfile = Array.isArray(masterField) ? masterField[0] : masterField;

  if (body.action === 'approve') {
    const { error } = await supabase.rpc('approve_salon_join_request', { p_request_id: body.request_id });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else {
    const { error } = await supabase.rpc('reject_salon_join_request', {
      p_request_id: body.request_id,
      p_reason: body.reason ?? null,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  // Notify the master (best-effort)
  if (masterProfile?.profile_id) {
    const { data: salon } = await supabase
      .from('salons')
      .select('name')
      .eq('id', salonId)
      .maybeSingle();
    const salonName = (salon as { name: string } | null)?.name ?? 'команда';
    try {
      await supabase.from('notifications').insert({
        recipient_id: masterProfile.profile_id,
        kind: body.action === 'approve' ? 'salon_join_approved' : 'salon_join_rejected',
        title: body.action === 'approve'
          ? `Тебя приняли в ${salonName}`
          : `Заявка в ${salonName} отклонена`,
        body: body.action === 'approve'
          ? `Теперь ты в команде. Открой /telegram/m/salon/${salonId}/dashboard.`
          : (body.reason || 'Админ отклонил твою заявку.'),
        meta: { salon_id: salonId, request_id: body.request_id, action: body.action },
      });
    } catch { /* ignore */ }
  }

  return NextResponse.json({ ok: true });
}
