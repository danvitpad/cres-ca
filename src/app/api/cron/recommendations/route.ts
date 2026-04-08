/** --- YAML
 * name: Post-Visit Recommendations Cron
 * description: 2 hours after visit, sends AI-generated personalized service/product recommendation
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { aiComplete } from '@/lib/ai/openrouter';
import { hasFeature } from '@/types';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = await createClient();
  let created = 0;

  // Find appointments completed 1.5-2.5 hours ago
  const now = new Date();
  const from = new Date(now.getTime() - 150 * 60 * 1000);
  const to = new Date(now.getTime() - 90 * 60 * 1000);

  const { data: appointments } = await supabase
    .from('appointments')
    .select('id, client_id, master_id, clients(profile_id, full_name), services(name), masters(profile_id)')
    .eq('status', 'completed')
    .gte('updated_at', from.toISOString())
    .lte('updated_at', to.toISOString());

  for (const apt of appointments || []) {
    const client = apt.clients as unknown as { profile_id: string | null; full_name: string } | null;
    const service = apt.services as unknown as { name: string } | null;
    const master = apt.masters as unknown as { profile_id: string } | null;

    if (!client?.profile_id || !master?.profile_id) continue;

    // Check if master has Business tier
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('tier')
      .eq('profile_id', master.profile_id)
      .single();

    if (!sub || !hasFeature(sub.tier as 'starter' | 'pro' | 'business' | 'trial', 'ai_features')) continue;

    // Get other services offered by this master
    const { data: otherServices } = await supabase
      .from('services')
      .select('name, price, currency')
      .eq('master_id', apt.master_id)
      .eq('is_active', true)
      .limit(10);

    const serviceList = otherServices?.map((s) => `${s.name} (${s.price} ${s.currency})`).join(', ') || '';

    const recommendation = await aiComplete(
      `You are a friendly service recommendation bot.
Write a very short recommendation (1-2 sentences) suggesting a complementary service.
Do not use emojis. Be natural and helpful.`,
      `Client: ${client.full_name}
Just completed: ${service?.name || 'an appointment'}
Other available services: ${serviceList}
Suggest one complementary service that pairs well with what they just had done.`,
    );

    if (recommendation) {
      await supabase.from('notifications').insert({
        profile_id: client.profile_id,
        channel: 'telegram',
        title: 'Recommendation for you',
        body: recommendation.slice(0, 500),
        scheduled_for: now.toISOString(),
      });
      created++;
    }
  }

  return NextResponse.json({ created });
}
