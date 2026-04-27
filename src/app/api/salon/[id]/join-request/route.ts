/** --- YAML
 * name: Salon Join Request — master creates pending application
 * description:
 *   POST /api/salon/[id]/join-request — мастер запрашивает вступление в команду.
 *     body: { message?: string }
 *     auth: cookie (master profile_id). Должен быть профиль с salons.id, у которого
 *     recruitment_open=true; иначе 403.
 *     creates salon_join_requests row (status=pending) — RLS гарантирует что
 *     один pending на пару salon+master.
 *   GET /api/salon/[id]/join-request — список заявок этого мастера в этот салон
 *     (для UI: «у тебя уже отправлена заявка»).
 * created: 2026-04-26
 * --- */

import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { notifyUser } from '@/lib/notifications/notify';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, ctx: RouteContext) {
  const { id: salonId } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // Find caller's master row
  const { data: master } = await supabase
    .from('masters')
    .select('id, salon_id')
    .eq('profile_id', user.id)
    .maybeSingle();

  if (!master) {
    return NextResponse.json(
      { error: 'not_a_master', message: 'Только мастера могут запрашивать вступление в команду.' },
      { status: 403 },
    );
  }

  if (master.salon_id === salonId) {
    return NextResponse.json(
      { error: 'already_member', message: 'Ты уже состоишь в этой команде.' },
      { status: 400 },
    );
  }

  // Check the salon exists and recruitment is open
  const { data: salon } = await supabase
    .from('salons')
    .select('id, name, owner_id, recruitment_open')
    .eq('id', salonId)
    .maybeSingle();

  if (!salon) {
    return NextResponse.json({ error: 'salon_not_found' }, { status: 404 });
  }

  if (salon.owner_id === user.id) {
    return NextResponse.json(
      { error: 'self_join', message: 'Ты владелец — состоишь в команде по умолчанию.' },
      { status: 400 },
    );
  }

  if (!salon.recruitment_open) {
    return NextResponse.json(
      { error: 'recruitment_closed', message: 'Этот салон закрыл набор — заявки временно не принимаются.' },
      { status: 403 },
    );
  }

  // Already member?
  const { data: existingMember } = await supabase
    .from('salon_members')
    .select('id, status')
    .eq('salon_id', salonId)
    .eq('master_id', master.id)
    .eq('status', 'active')
    .maybeSingle();
  if (existingMember) {
    return NextResponse.json(
      { error: 'already_member', message: 'Ты уже в команде этого салона.' },
      { status: 400 },
    );
  }

  // Already pending?
  const { data: existingRequest } = await supabase
    .from('salon_join_requests')
    .select('id, status, created_at')
    .eq('salon_id', salonId)
    .eq('master_id', master.id)
    .eq('status', 'pending')
    .maybeSingle();
  if (existingRequest) {
    return NextResponse.json(
      { error: 'already_pending', message: 'Заявка уже отправлена — ждёт ответа админа.', request_id: existingRequest.id },
      { status: 400 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as { message?: string };
  const message = (body.message ?? '').trim().slice(0, 600) || null;

  const { data: created, error } = await supabase
    .from('salon_join_requests')
    .insert({
      salon_id: salonId,
      master_id: master.id,
      message,
      status: 'pending',
    })
    .select('id, created_at')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Notify salon owner (best-effort, не валит запрос если notification fails)
  await notifyUser(supabase, {
    profileId: salon.owner_id,
    title: 'Новая заявка в команду',
    body: `Мастер хочет присоединиться к ${salon.name}.${message ? `\n\n«${message}»` : ''}`,
    data: { type: 'salon_join_request', salon_id: salonId, request_id: created.id },
    deepLinkPath: `/telegram/m/salon/${salonId}/team`,
    deepLinkLabel: 'Посмотреть заявку',
  });

  return NextResponse.json({ ok: true, request_id: created.id, created_at: created.created_at });
}

export async function GET(_req: NextRequest, ctx: RouteContext) {
  const { id: salonId } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { data: master } = await supabase
    .from('masters')
    .select('id')
    .eq('profile_id', user.id)
    .maybeSingle();

  if (!master) {
    return NextResponse.json({ requests: [] });
  }

  const { data: requests } = await supabase
    .from('salon_join_requests')
    .select('id, status, message, created_at, decided_at')
    .eq('salon_id', salonId)
    .eq('master_id', master.id)
    .order('created_at', { ascending: false })
    .limit(5);

  return NextResponse.json({ requests: requests ?? [] });
}
