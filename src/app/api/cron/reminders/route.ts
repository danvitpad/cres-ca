/** --- YAML
 * name: Appointment Reminder Cron
 * description: Creates reminder notifications for appointments starting in ~24h and ~2h
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
  let created = 0;

  // 24-hour reminders: appointments starting in 23-25 hours
  const in23h = new Date(now.getTime() + 23 * 60 * 60 * 1000);
  const in25h = new Date(now.getTime() + 25 * 60 * 60 * 1000);

  const { data: upcoming24 } = await supabase
    .from('appointments')
    .select('id, starts_at, status, client_id, master_id, clients(profile_id, full_name), services(name), masters(profile_id)')
    .in('status', ['booked', 'confirmed'])
    .gte('starts_at', in23h.toISOString())
    .lte('starts_at', in25h.toISOString());

  for (const apt of upcoming24 || []) {
    const client = apt.clients as unknown as { profile_id: string | null; full_name: string } | null;
    const service = apt.services as unknown as { name: string } | null;
    const master = apt.masters as unknown as { profile_id: string } | null;
    const time = new Date(apt.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const date = new Date(apt.starts_at).toLocaleDateString();

    // Notify client
    if (client?.profile_id) {
      await supabase.from('notifications').insert({
        profile_id: client.profile_id,
        channel: 'telegram',
        title: '📅 Reminder: Appointment tomorrow',
        body: `${service?.name || 'Appointment'} on ${date} at ${time}`,
        scheduled_for: now.toISOString(),
      });
      created++;
    }

    // Notify master
    if (master?.profile_id) {
      await supabase.from('notifications').insert({
        profile_id: master.profile_id,
        channel: 'telegram',
        title: '📅 Upcoming appointment tomorrow',
        body: `${client?.full_name || 'Client'} — ${service?.name || ''} at ${time}`,
        scheduled_for: now.toISOString(),
      });
      created++;
    }
  }

  // 2-hour reminders: appointments starting in 1.5-2.5 hours
  const in90m = new Date(now.getTime() + 90 * 60 * 1000);
  const in150m = new Date(now.getTime() + 150 * 60 * 1000);

  const { data: upcoming2 } = await supabase
    .from('appointments')
    .select('id, starts_at, status, client_id, master_id, clients(profile_id, full_name), services(name), masters(profile_id)')
    .in('status', ['booked', 'confirmed'])
    .gte('starts_at', in90m.toISOString())
    .lte('starts_at', in150m.toISOString());

  for (const apt of upcoming2 || []) {
    const client = apt.clients as unknown as { profile_id: string | null; full_name: string } | null;
    const service = apt.services as unknown as { name: string } | null;
    const time = new Date(apt.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (client?.profile_id) {
      await supabase.from('notifications').insert({
        profile_id: client.profile_id,
        channel: 'telegram',
        title: '⏰ Appointment in 2 hours',
        body: `${service?.name || 'Appointment'} at ${time}. Don't be late!`,
        scheduled_for: now.toISOString(),
      });
      created++;
    }
  }

  return NextResponse.json({ created });
}
