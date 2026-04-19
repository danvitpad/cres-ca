/** --- YAML
 * name: Superadmin offers data
 * description: List + create helpers for platform_offers. Resolves target recipients (all_masters/all_salons/specific/segment), generates unique promo codes, seeds in-app notifications on send.
 * created: 2026-04-19
 * --- */

import { createClient as createAdminClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export type OfferType = 'discount_percent' | 'discount_fixed' | 'free_months' | 'plan_upgrade';
export type OfferTarget = 'all_masters' | 'all_salons' | 'specific' | 'segment';
export type OfferStatus = 'draft' | 'scheduled' | 'sent' | 'cancelled';

export interface OfferListRow {
  id: string;
  title: string;
  description: string | null;
  offerType: OfferType;
  offerValue: number;
  targetType: OfferTarget;
  targetIds: string[] | null;
  targetSegment: Record<string, unknown> | null;
  deliveryChannels: string[];
  status: OfferStatus;
  promoCode: string | null;
  scheduledAt: string | null;
  sentAt: string | null;
  recipientsCount: number;
  conversionsCount: number;
  createdAt: string;
}

function pickLocale(v: unknown): string {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const obj = v as Record<string, unknown>;
    return (obj.ru as string) || (obj.en as string) || (obj.uk as string) || '';
  }
  return typeof v === 'string' ? v : '';
}

export async function listOffers(): Promise<OfferListRow[]> {
  const db = admin();
  const { data } = await db
    .from('platform_offers')
    .select('id, title, description, offer_type, offer_value, target_type, target_ids, target_segment, delivery_channels, status, promo_code, scheduled_at, sent_at, recipients_count, conversions_count, created_at')
    .order('created_at', { ascending: false })
    .limit(200);

  type Row = {
    id: string;
    title: unknown;
    description: unknown;
    offer_type: OfferType;
    offer_value: number;
    target_type: OfferTarget;
    target_ids: string[] | null;
    target_segment: Record<string, unknown> | null;
    delivery_channels: string[] | null;
    status: OfferStatus;
    promo_code: string | null;
    scheduled_at: string | null;
    sent_at: string | null;
    recipients_count: number;
    conversions_count: number;
    created_at: string;
  };

  return ((data ?? []) as Row[]).map((r) => ({
    id: r.id,
    title: pickLocale(r.title),
    description: pickLocale(r.description) || null,
    offerType: r.offer_type,
    offerValue: Number(r.offer_value),
    targetType: r.target_type,
    targetIds: r.target_ids,
    targetSegment: r.target_segment,
    deliveryChannels: r.delivery_channels ?? [],
    status: r.status,
    promoCode: r.promo_code,
    scheduledAt: r.scheduled_at,
    sentAt: r.sent_at,
    recipientsCount: r.recipients_count,
    conversionsCount: r.conversions_count,
    createdAt: r.created_at,
  }));
}

export async function generateUniquePromoCode(db: SupabaseClient, prefix = 'CRES'): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
    const code = `${prefix}-${rand}`;
    const { data } = await db.from('platform_offers').select('id').eq('promo_code', code).maybeSingle();
    if (!data) return code;
  }
  return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
}

export interface TargetSegment {
  plan?: 'trial' | 'starter' | 'pro' | 'business' | 'free';
  registered_before?: string;
  registered_after?: string;
  city?: string;
}

export async function resolveTargetProfileIds(
  db: SupabaseClient,
  targetType: OfferTarget,
  targetIds: string[] | null,
  targetSegment: TargetSegment | null,
): Promise<string[]> {
  if (targetType === 'specific') {
    return targetIds ?? [];
  }

  if (targetType === 'all_masters') {
    const { data } = await db.from('masters').select('profile_id').is('deleted_at', null);
    return (data ?? []).map((r) => (r as { profile_id: string }).profile_id).filter(Boolean);
  }

  if (targetType === 'all_salons') {
    const { data } = await db.from('salons').select('owner_id').is('deleted_at', null);
    return (data ?? []).map((r) => (r as { owner_id: string }).owner_id).filter(Boolean);
  }

  if (targetType === 'segment') {
    let q = db.from('profiles').select('id, created_at, city').is('deleted_at', null);
    if (targetSegment?.registered_before) q = q.lt('created_at', targetSegment.registered_before);
    if (targetSegment?.registered_after) q = q.gt('created_at', targetSegment.registered_after);
    if (targetSegment?.city) q = q.eq('city', targetSegment.city);
    const { data: profiles } = await q.limit(5000);
    let ids = (profiles ?? []).map((r) => (r as { id: string }).id);

    if (targetSegment?.plan) {
      const { data: subs } = await db
        .from('subscriptions')
        .select('profile_id, tier, status')
        .in('profile_id', ids);
      const matching = new Set(
        (subs ?? [])
          .filter((s) => (s as { tier: string; status: string }).tier === targetSegment.plan && (s as { status: string }).status !== 'cancelled')
          .map((s) => (s as { profile_id: string }).profile_id),
      );
      if (targetSegment.plan === 'free') {
        const withSub = new Set((subs ?? []).map((s) => (s as { profile_id: string }).profile_id));
        ids = ids.filter((id) => !withSub.has(id));
      } else {
        ids = ids.filter((id) => matching.has(id));
      }
    }
    return ids;
  }

  return [];
}

export async function sendInAppNotifications(
  db: SupabaseClient,
  profileIds: string[],
  title: string,
  body: string,
  channels: string[],
): Promise<void> {
  if (!channels.includes('in_app') && !channels.includes('telegram')) return;
  if (profileIds.length === 0) return;

  const now = new Date().toISOString();
  const rows = profileIds.map((profile_id) => ({
    profile_id,
    channel: channels.includes('telegram') ? 'telegram' : 'push',
    title,
    body,
    scheduled_for: now,
  }));
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    await db.from('notifications').insert(rows.slice(i, i + CHUNK));
  }
}
