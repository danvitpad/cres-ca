/** --- YAML
 * name: Retention Cron
 * description: Weekly cron that finds clients overdue for a visit and sends "come back" notifications (Pro+ tier)
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = await createClient();
  let created = 0;

  // Get all masters with Pro+ tier
  const { data: masters } = await supabase
    .from('masters')
    .select('id, profile_id, subscriptions:profiles!inner(subscriptions(tier))')
    .eq('is_active', true);

  if (!masters?.length) return NextResponse.json({ created: 0 });

  for (const master of masters) {
    // Check subscription tier (simplified — check if Pro or Business)
    const subs = master.subscriptions as unknown as { subscriptions: { tier: string }[] };
    const tier = subs?.subscriptions?.[0]?.tier;
    if (!tier || tier === 'starter') continue;

    // Get clients with their last visit
    const { data: clients } = await supabase
      .from('clients')
      .select('id, profile_id, full_name, last_visit_at')
      .eq('master_id', master.id)
      .not('last_visit_at', 'is', null)
      .not('profile_id', 'is', null);

    if (!clients?.length) continue;

    const now = new Date();

    for (const client of clients) {
      if (!client.last_visit_at || !client.profile_id) continue;

      const lastVisit = new Date(client.last_visit_at);
      const daysSince = Math.floor((now.getTime() - lastVisit.getTime()) / (1000 * 60 * 60 * 24));

      // If more than 30 days since last visit, send reminder
      if (daysSince > 30) {
        // Check if we already sent a retention notification recently (within 7 days)
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const { data: existing } = await supabase
          .from('notifications')
          .select('id')
          .eq('profile_id', client.profile_id)
          .eq('title', '💈 We miss you!')
          .gte('created_at', weekAgo.toISOString())
          .limit(1);

        if (existing?.length) continue;

        await supabase.from('notifications').insert({
          profile_id: client.profile_id,
          channel: 'telegram',
          title: '💈 We miss you!',
          body: `Hi ${client.full_name}! It's been ${daysSince} days since your last visit. Book your next appointment today!`,
          scheduled_for: now.toISOString(),
        });
        created++;
      }
    }
  }

  return NextResponse.json({ created });
}
