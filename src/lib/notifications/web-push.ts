/** --- YAML
 * name: Web Push delivery helper
 * description: Single helper to deliver a payload to ALL of a user's browser
 *              push subscriptions. On 410/404 (subscription expired) — auto-
 *              deletes the row. On other errors — increments failure_count;
 *              after 5 failures the row is auto-deleted on next attempt.
 * created: 2026-04-29
 * updated: 2026-05-01
 * --- */

import type { SupabaseClient } from '@supabase/supabase-js';

let configured = false;
async function ensureConfigured() {
  if (configured) return;
  const subj = process.env.VAPID_SUBJECT || 'mailto:noreply@cres-ca.com';
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) {
    throw new Error('VAPID keys not configured');
  }
  const webpush = await import('web-push');
  webpush.setVapidDetails(subj, pub, priv);
  configured = true;
}

export interface WebPushPayload {
  title: string;
  body: string;
  url?: string;             // Куда вести при клике (например /telegram/m/tasks)
  tag?: string;             // Дедуп идентичных уведомлений
  icon?: string;
  data?: Record<string, unknown>;
}

interface PushSub {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  failure_count: number;
}

/**
 * Best-effort: посылает payload на все подписки пользователя.
 * Не бросает наружу — fail-soft чтобы не валить вызывающий cron/handler.
 * Возвращает количество доставленных и удалённых мёртвых подписок.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function sendWebPush(supabase: SupabaseClient<any, any, any>, profileId: string, payload: WebPushPayload): Promise<{ delivered: number; pruned: number }> {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY;
  if (!pub || !process.env.VAPID_PRIVATE_KEY) {
    return { delivered: 0, pruned: 0 };
  }

  let subs: PushSub[] = [];
  try {
    const { data } = await supabase
      .from('web_push_subscriptions')
      .select('id, endpoint, p256dh, auth, failure_count')
      .eq('profile_id', profileId);
    subs = (data ?? []) as PushSub[];
  } catch {
    return { delivered: 0, pruned: 0 };
  }

  if (subs.length === 0) return { delivered: 0, pruned: 0 };

  let webpush: typeof import('web-push');
  try {
    await ensureConfigured();
    webpush = await import('web-push');
  } catch {
    return { delivered: 0, pruned: 0 };
  }

  const json = JSON.stringify(payload);

  let delivered = 0;
  let pruned = 0;

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          json,
        );
        delivered++;
        await supabase
          .from('web_push_subscriptions')
          .update({ last_used_at: new Date().toISOString(), failure_count: 0 })
          .eq('id', sub.id)
          .then(() => undefined, () => undefined);
      } catch (err) {
        const status = (err as { statusCode?: number })?.statusCode ?? 0;
        // 404/410 = subscription gone forever
        if (status === 404 || status === 410 || sub.failure_count >= 4) {
          await supabase.from('web_push_subscriptions').delete().eq('id', sub.id)
            .then(() => undefined, () => undefined);
          pruned++;
        } else {
          await supabase
            .from('web_push_subscriptions')
            .update({ failure_count: sub.failure_count + 1 })
            .eq('id', sub.id)
            .then(() => undefined, () => undefined);
        }
      }
    }),
  );

  return { delivered, pruned };
}
