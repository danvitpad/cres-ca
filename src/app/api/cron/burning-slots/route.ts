/** --- YAML
 * name: Burning Slots Cron
 * description: Daily cron that finds empty slots for next 24h and creates burning slot promotions
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = await createClient();

  // Get masters with burning slots enabled and Pro+ tier
  const { data: masters } = await supabase
    .from('masters')
    .select('id, burning_slots_enabled, burning_slots_discount, profile_id')
    .eq('is_active', true)
    .eq('burning_slots_enabled', true);

  if (!masters || masters.length === 0) {
    return NextResponse.json({ processed: 0 });
  }

  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  let postsCreated = 0;

  for (const master of masters) {
    // Get master's working hours for tomorrow's day of week
    const tomorrowDay = tomorrow.getDay(); // 0=Sun
    const { data: schedule } = await supabase
      .from('schedules')
      .select('start_time, end_time')
      .eq('master_id', master.id)
      .eq('day_of_week', tomorrowDay)
      .eq('is_working', true)
      .single();

    if (!schedule) continue;

    // Calculate total available slots (assuming 60min slots)
    const startHour = parseInt(schedule.start_time.split(':')[0], 10);
    const endHour = parseInt(schedule.end_time.split(':')[0], 10);
    const totalSlots = endHour - startHour;
    if (totalSlots <= 0) continue;

    // Count booked appointments for tomorrow
    const tomorrowStart = new Date(tomorrow);
    tomorrowStart.setHours(0, 0, 0, 0);
    const tomorrowEnd = new Date(tomorrow);
    tomorrowEnd.setHours(23, 59, 59, 999);

    const { count: bookedCount } = await supabase
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('master_id', master.id)
      .gte('starts_at', tomorrowStart.toISOString())
      .lte('starts_at', tomorrowEnd.toISOString())
      .in('status', ['booked', 'confirmed', 'in_progress']);

    const { data: existingPost } = await supabase
      .from('feed_posts')
      .select('id')
      .eq('master_id', master.id)
      .eq('type', 'burning_slot')
      .gte('created_at', tomorrowStart.toISOString())
      .limit(1);
    if (existingPost?.length) continue;

    const booked = bookedCount ?? 0;
    const emptySlots = totalSlots - booked;
    const emptyPercent = emptySlots / totalSlots;

    // Only create promo if >30% slots are empty
    if (emptyPercent <= 0.3) continue;

    const discount = master.burning_slots_discount ?? 20;

    // Get a popular service for this master
    const { data: service } = await supabase
      .from('services')
      .select('id, name')
      .eq('master_id', master.id)
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    // Create feed post
    await supabase.from('feed_posts').insert({
      master_id: master.id,
      type: 'burning_slot',
      title: `${discount}% off tomorrow!`,
      body: service
        ? `Book ${service.name} tomorrow and get ${discount}% off. Limited slots available!`
        : `${discount}% off all services tomorrow. Limited slots available!`,
      linked_service_id: service?.id ?? null,
      expires_at: tomorrowEnd.toISOString(),
    });

    const { data: followers } = await supabase
      .from('client_master_links')
      .select('profile_id')
      .eq('master_id', master.id);

    if (followers?.length) {
      const notifications = followers
        .filter((f) => !!f.profile_id)
        .map((f) => ({
          profile_id: f.profile_id,
          channel: 'telegram' as const,
          title: '🔥 Flash Deal!',
          body: service
            ? `${service.name} tomorrow with ${discount}% off! [burning:${master.id}:${tomorrow.toISOString().split('T')[0]}]`
            : `${discount}% off tomorrow! [burning:${master.id}:${tomorrow.toISOString().split('T')[0]}]`,
          status: 'pending' as const,
          scheduled_for: new Date().toISOString(),
        }));
      if (notifications.length > 0) await supabase.from('notifications').insert(notifications);
    }

    postsCreated++;
  }

  return NextResponse.json({ processed: masters.length, postsCreated });
}
