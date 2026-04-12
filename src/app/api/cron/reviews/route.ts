/** --- YAML
 * name: Review Collection Cron
 * description: 2 hours after appointment ends, create a review-request notification for the client (skipped if already reviewed or already sent)
 * created: 2026-04-12
 * updated: 2026-04-12
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = await createClient();
  const now = new Date();
  const from = new Date(now.getTime() - 150 * 60 * 1000);
  const to = new Date(now.getTime() - 90 * 60 * 1000);

  const { data: appointments } = await supabase
    .from('appointments')
    .select('id, master_id, ends_at, clients(profile_id, full_name), services(name), masters(display_name, profiles(full_name))')
    .eq('status', 'completed')
    .gte('ends_at', from.toISOString())
    .lte('ends_at', to.toISOString());

  if (!appointments?.length) return NextResponse.json({ created: 0 });

  const aptIds = appointments.map((a) => a.id);

  const { data: existingReviews } = await supabase
    .from('reviews')
    .select('appointment_id')
    .in('appointment_id', aptIds)
    .eq('target_type', 'master');
  const reviewedSet = new Set((existingReviews ?? []).map((r) => r.appointment_id));

  const { data: existingNotifs } = await supabase
    .from('notifications')
    .select('body')
    .like('body', '%[review:%');
  const notifiedSet = new Set<string>();
  (existingNotifs ?? []).forEach((n) => {
    const m = n.body?.match(/\[review:([0-9a-f-]{36})\]/i);
    if (m) notifiedSet.add(m[1]);
  });

  const profileIds = appointments
    .map((a) => (a.clients as unknown as { profile_id: string | null } | null)?.profile_id)
    .filter((x): x is string => !!x);
  const { data: prefs } = await supabase
    .from('notification_prefs')
    .select('profile_id, review_requests')
    .in('profile_id', profileIds);
  const prefMap = new Map((prefs ?? []).map((p) => [p.profile_id, p.review_requests !== false]));

  let created = 0;
  for (const apt of appointments) {
    if (reviewedSet.has(apt.id) || notifiedSet.has(apt.id)) continue;

    const client = apt.clients as unknown as { profile_id: string | null } | null;
    if (!client?.profile_id) continue;
    if (prefMap.get(client.profile_id) === false) continue;

    const service = apt.services as unknown as { name: string } | null;
    const master = apt.masters as unknown as { display_name: string | null; profiles: { full_name: string | null } | null } | null;
    const masterName = master?.display_name ?? master?.profiles?.full_name ?? 'your master';
    const serviceName = service?.name ?? 'the visit';

    await supabase.from('notifications').insert({
      profile_id: client.profile_id,
      channel: 'telegram',
      title: '⭐ Rate your visit',
      body: `How was "${serviceName}" with ${masterName}? Open History to leave a review. [review:${apt.id}]`,
      scheduled_for: now.toISOString(),
    });
    created++;
  }

  return NextResponse.json({ created });
}
