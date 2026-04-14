/** --- YAML
 * name: Recurring Bookings Cron
 * description: Daily cron that auto-creates appointments for active recurring bookings
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = await createClient();
  const today = new Date();
  const weekFromNow = new Date(today);
  weekFromNow.setDate(weekFromNow.getDate() + 7);

  // Find recurring bookings due within next 7 days
  const { data: recurrings } = await supabase
    .from('recurring_bookings')
    .select('*, service:services(duration_minutes)')
    .eq('is_active', true)
    .lte('next_booking_date', weekFromNow.toISOString().slice(0, 10));

  let created = 0;

  for (const rec of recurrings ?? []) {
    const preferredTime = rec.preferred_time ?? '10:00';
    const [hours, minutes] = preferredTime.split(':').map(Number);
    const startDate = new Date(rec.next_booking_date);
    startDate.setHours(hours, minutes, 0, 0);

    const durationMin = rec.service?.duration_minutes ?? 60;
    const endDate = new Date(startDate.getTime() + durationMin * 60000);

    // Check for conflicts
    const { data: conflicts } = await supabase
      .from('appointments')
      .select('id')
      .eq('master_id', rec.master_id)
      .not('status', 'in', '(cancelled,cancelled_by_client,cancelled_by_master)')
      .lt('starts_at', endDate.toISOString())
      .gt('ends_at', startDate.toISOString())
      .limit(1);

    if (conflicts && conflicts.length > 0) {
      // Slot taken — notify client and skip
      const { data: client } = await supabase
        .from('clients')
        .select('profile_id')
        .eq('id', rec.client_id)
        .single();

      if (client?.profile_id) {
        await supabase.from('notifications').insert({
          profile_id: client.profile_id,
          channel: 'telegram',
          title: 'Recurring booking conflict',
          body: `Your recurring appointment on ${rec.next_booking_date} at ${preferredTime} is not available. Please rebook manually.`,
          status: 'pending',
          scheduled_for: new Date().toISOString(),
        });
      }
      continue;
    }

    // Create appointment
    const { error } = await supabase.from('appointments').insert({
      client_id: rec.client_id,
      master_id: rec.master_id,
      service_id: rec.service_id,
      starts_at: startDate.toISOString(),
      ends_at: endDate.toISOString(),
      status: 'booked',
    });

    if (!error) {
      created++;
      // Update next booking date
      const nextDate = new Date(rec.next_booking_date);
      nextDate.setDate(nextDate.getDate() + rec.interval_days);
      await supabase
        .from('recurring_bookings')
        .update({ next_booking_date: nextDate.toISOString().slice(0, 10) })
        .eq('id', rec.id);
    }
  }

  return NextResponse.json({ created });
}
