/** --- YAML
 * name: Review Collection Cron
 * description: 2 hours after appointment completion, creates notification asking client to rate
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

  // Find appointments completed 1.5-2.5 hours ago
  const now = new Date();
  const from = new Date(now.getTime() - 150 * 60 * 1000);
  const to = new Date(now.getTime() - 90 * 60 * 1000);

  const { data: appointments } = await supabase
    .from('appointments')
    .select('id, client_id, master_id, clients(profile_id, full_name), services(name)')
    .eq('status', 'completed')
    .gte('updated_at', from.toISOString())
    .lte('updated_at', to.toISOString());

  for (const apt of appointments || []) {
    const client = apt.clients as unknown as { profile_id: string | null; full_name: string } | null;
    const service = apt.services as unknown as { name: string } | null;

    if (!client?.profile_id) continue;

    // Check if review notification already sent
    const { data: existing } = await supabase
      .from('notifications')
      .select('id')
      .eq('profile_id', client.profile_id)
      .like('body', `%rate%${apt.id}%`)
      .limit(1);

    if (existing?.length) continue;

    await supabase.from('notifications').insert({
      profile_id: client.profile_id,
      channel: 'telegram',
      title: '⭐ How was your visit?',
      body: `Please rate your ${service?.name || 'appointment'} experience! Your feedback helps improve service quality.`,
      scheduled_for: now.toISOString(),
    });
    created++;
  }

  return NextResponse.json({ created });
}
