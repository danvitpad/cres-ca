/** --- YAML
 * name: Notify partners after positive review
 * description: POST /api/reviews/[id]/notify-partners — после оставленного
 *              отзыва ≥4⭐ собирает active партнёров мастера из его групп
 *              и шлёт клиенту in-app + TG уведомление с ссылками на их
 *              публичные страницы. Если score < 4 либо партнёров нет —
 *              ничего не делает. Идемпотентно (можно дёрнуть повторно —
 *              в notifications добавится новая запись, но мы можем это
 *              отдельно дедуплицировать).
 * created: 2026-05-02
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { notifyUser } from '@/lib/notifications/notify';

interface RouteContext { params: Promise<{ id: string }> }

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://cres-ca.com';

export async function POST(_req: Request, { params }: RouteContext) {
  const { id: reviewId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const db = admin();
  const { data: review } = await db
    .from('reviews')
    .select('id, score, reviewer_id, target_type, target_id, appointment_id')
    .eq('id', reviewId)
    .maybeSingle();
  if (!review) return NextResponse.json({ error: 'review_not_found' }, { status: 404 });

  const r = review as { id: string; score: number; reviewer_id: string | null; target_type: string; target_id: string };

  // Только если оценка ≥ 4 и таргет — мастер
  if (r.score < 4) return NextResponse.json({ ok: true, skipped: 'low_score' });
  if (r.target_type !== 'master') return NextResponse.json({ ok: true, skipped: 'not_master_review' });

  // Определяем кто получит уведомление: reviewer_id (если есть) или
  // вызывающий user (если он клиент и review без reviewer_id).
  const recipientProfileId = r.reviewer_id || user?.id;
  if (!recipientProfileId) return NextResponse.json({ ok: true, skipped: 'no_recipient' });

  // Найти все active группы этого мастера
  const { data: groups } = await db
    .from('guild_members')
    .select('guild_id')
    .eq('master_id', r.target_id)
    .eq('status', 'active');
  const guildIds = (groups ?? []).map((g) => (g as { guild_id: string }).guild_id);
  if (guildIds.length === 0) return NextResponse.json({ ok: true, skipped: 'no_guilds' });

  // Active партнёры — все active member'ы тех же групп, кроме самого мастера
  const { data: partnerRows } = await db
    .from('guild_members')
    .select('master_id')
    .in('guild_id', guildIds)
    .eq('status', 'active')
    .neq('master_id', r.target_id);
  const partnerIds = Array.from(new Set((partnerRows ?? []).map((p) => (p as { master_id: string }).master_id)));
  if (partnerIds.length === 0) return NextResponse.json({ ok: true, skipped: 'no_partners' });

  const { data: partners } = await db
    .from('masters')
    .select('id, slug, display_name, specialization, profile:profiles!masters_profile_id_fkey(full_name)')
    .in('id', partnerIds)
    .eq('is_active', true)
    .eq('is_public', true)
    .limit(5);

  if (!partners || partners.length === 0) return NextResponse.json({ ok: true, skipped: 'no_public_partners' });

  // Имя самого мастера для текста
  const { data: master } = await db
    .from('masters')
    .select('display_name, profile:profiles!masters_profile_id_fkey(full_name)')
    .eq('id', r.target_id)
    .maybeSingle();
  const masterRow = master as Record<string, unknown> | null;
  const masterProfile = Array.isArray(masterRow?.profile) ? (masterRow.profile[0] as Record<string, unknown>) : (masterRow?.profile as Record<string, unknown> | null);
  const masterName = (masterRow?.display_name as string | null) || (masterProfile?.full_name as string | null) || 'Мастер';

  const partnerLines = partners.map((raw) => {
    const p = raw as Record<string, unknown>;
    const prof = Array.isArray(p.profile) ? (p.profile[0] as Record<string, unknown>) : (p.profile as Record<string, unknown> | null);
    const name = (p.display_name as string | null) || (prof?.full_name as string | null) || 'Мастер';
    const spec = (p.specialization as string | null) ?? '';
    const slug = p.slug as string | null;
    const url = slug ? `${SITE}/m/${slug}` : SITE;
    return `• ${name}${spec ? ` — ${spec}` : ''}\n  ${url}`;
  }).join('\n\n');

  const body =
    `Спасибо за высокую оценку!\n\n` +
    `${masterName} рекомендует своих партнёров — мастеров, которым доверяет:\n\n` +
    partnerLines +
    `\n\nМожно записаться, перейдя по любой ссылке.`;

  try {
    await notifyUser(db as unknown as Parameters<typeof notifyUser>[0], {
      profileId: recipientProfileId,
      title: `${masterName} рекомендует коллег`,
      body,
      data: {
        type: 'partner_recommendations',
        master_id: r.target_id,
        review_id: r.id,
        partner_ids: partnerIds,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, partners_count: partners.length });
}
