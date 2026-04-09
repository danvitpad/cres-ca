/** --- YAML
 * name: Web Push
 * description: Server-side web push notification sender using web-push library
 * --- */

interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

/**
 * Send a web push notification to a subscription.
 * Uses the web-push npm package server-side.
 */
export async function sendWebPush(
  subscription: PushSubscription,
  payload: { title: string; body: string; url?: string },
): Promise<boolean> {
  try {
    // Dynamic import to avoid bundling on client
    const webpush = await import('web-push');

    webpush.setVapidDetails(
      'mailto:support@cres-ca.com',
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!,
    );

    await webpush.sendNotification(
      subscription,
      JSON.stringify(payload),
    );

    return true;
  } catch {
    return false;
  }
}
