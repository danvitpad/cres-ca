/** --- YAML
 * name: Superadmin offers API
 * description: POST (create draft/scheduled/sent with optional promo + target resolution + in-app notifications), PATCH (cancel scheduled), DELETE (remove draft). All actions audit-logged.
 * created: 2026-04-19
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { requireSuperadmin } from '@/lib/superadmin/auth';
import { logSuperadminAction } from '@/lib/superadmin/access';
import { generateUniquePromoCode, resolveTargetProfileIds, sendInAppNotifications, type OfferType, type OfferTarget, type TargetSegment } from '@/lib/superadmin/offers-data';

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

async function guard(): Promise<{ profileId: string; email: string } | NextResponse> {
  try {
    return await requireSuperadmin();
  } catch (r) {
    if (r instanceof NextResponse) return r;
    if (r instanceof Response) return new NextResponse(r.body, { status: r.status });
    return new NextResponse('not found', { status: 404 });
  }
}

interface CreateBody {
  title: Record<'ru' | 'en' | 'uk', string>;
  description?: Record<'ru' | 'en' | 'uk', string> | null;
  offer_type: OfferType;
  offer_value: number;
  target_type: OfferTarget;
  target_ids?: string[] | null;
  target_segment?: TargetSegment | null;
  delivery_channels?: string[];
  action: 'draft' | 'schedule' | 'send';
  scheduled_at?: string | null;
  generate_promo?: boolean;
}

export async function POST(req: Request) {
  const sa = await guard();
  if (sa instanceof NextResponse) return sa;

  const body = (await req.json().catch(() => null)) as CreateBody | null;
  if (!body) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  if (!body.title?.ru) return NextResponse.json({ error: 'title_ru_required' }, { status: 400 });
  if (!body.offer_type || !body.offer_value || !body.target_type) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
  }

  const db = admin();
  const channels = body.delivery_channels && body.delivery_channels.length > 0 ? body.delivery_channels : ['in_app'];

  let status: 'draft' | 'scheduled' | 'sent' = 'draft';
  let scheduledAt: string | null = null;
  let sentAt: string | null = null;
  if (body.action === 'schedule') {
    if (!body.scheduled_at) return NextResponse.json({ error: 'scheduled_at_required' }, { status: 400 });
    status = 'scheduled';
    scheduledAt = body.scheduled_at;
  } else if (body.action === 'send') {
    status = 'sent';
    sentAt = new Date().toISOString();
  }

  let promoCode: string | null = null;
  if (body.generate_promo) {
    promoCode = await generateUniquePromoCode(db);
  }

  let recipientIds: string[] = [];
  let recipientsCount = 0;
  if (status === 'sent') {
    recipientIds = await resolveTargetProfileIds(db, body.target_type, body.target_ids ?? null, body.target_segment ?? null);
    recipientsCount = recipientIds.length;
  }

  const { data, error } = await db
    .from('platform_offers')
    .insert({
      title: body.title,
      description: body.description ?? null,
      offer_type: body.offer_type,
      offer_value: body.offer_value,
      target_type: body.target_type,
      target_ids: body.target_ids ?? null,
      target_segment: body.target_segment ?? null,
      delivery_channels: channels,
      status,
      promo_code: promoCode,
      scheduled_at: scheduledAt,
      sent_at: sentAt,
      recipients_count: recipientsCount,
      conversions_count: 0,
      created_by: sa.profileId,
    })
    .select('id')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (status === 'sent' && recipientIds.length > 0) {
    const notifTitle = body.title.ru;
    const notifBody = promoCode
      ? `${body.description?.ru ?? ''}\nПромокод: ${promoCode}`.trim()
      : body.description?.ru ?? '';
    await sendInAppNotifications(db, recipientIds, notifTitle, notifBody, channels);
  }

  await logSuperadminAction(sa.profileId, status === 'sent' ? 'offer_sent' : status === 'scheduled' ? 'offer_scheduled' : 'offer_draft', 'offer', data?.id ?? null, {
    title_ru: body.title.ru,
    offer_type: body.offer_type,
    offer_value: body.offer_value,
    target_type: body.target_type,
    recipients_count: recipientsCount,
    promo_code: promoCode,
  });

  return NextResponse.json({ ok: true, id: data?.id, promoCode, recipientsCount });
}

export async function PATCH(req: Request) {
  const sa = await guard();
  if (sa instanceof NextResponse) return sa;
  const body = (await req.json().catch(() => null)) as { id?: string; action?: 'cancel' } | null;
  if (!body?.id || body.action !== 'cancel') return NextResponse.json({ error: 'bad_request' }, { status: 400 });

  const db = admin();
  const { error } = await db.from('platform_offers').update({ status: 'cancelled' }).eq('id', body.id).in('status', ['draft', 'scheduled']);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logSuperadminAction(sa.profileId, 'offer_cancelled', 'offer', body.id, null);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const sa = await guard();
  if (sa instanceof NextResponse) return sa;
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id_required' }, { status: 400 });

  const db = admin();
  const { data: row } = await db.from('platform_offers').select('status').eq('id', id).maybeSingle();
  if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (row.status === 'sent') return NextResponse.json({ error: 'cannot_delete_sent' }, { status: 400 });

  const { error } = await db.from('platform_offers').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logSuperadminAction(sa.profileId, 'offer_removed', 'offer', id, null);
  return NextResponse.json({ ok: true });
}
