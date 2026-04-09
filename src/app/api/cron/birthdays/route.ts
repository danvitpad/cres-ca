/** --- YAML
 * name: Birthday Greetings Cron
 * description: Daily cron that checks client/master birthdays and creates greeting notifications
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
  const month = today.getMonth() + 1;
  const day = today.getDate();

  // Find clients with birthdays today
  const { data: birthdayClients } = await supabase
    .from('clients')
    .select('id, full_name, master_id, date_of_birth')
    .not('date_of_birth', 'is', null);

  const clientBirthdays = (birthdayClients ?? []).filter((c) => {
    if (!c.date_of_birth) return false;
    const dob = new Date(c.date_of_birth);
    return dob.getMonth() + 1 === month && dob.getDate() === day;
  });

  // Notify masters about client birthdays
  for (const client of clientBirthdays) {
    // Get master's profile_id for notification
    const { data: master } = await supabase
      .from('masters')
      .select('profile_id, birthday_auto_greet, birthday_discount_percent')
      .eq('id', client.master_id)
      .single();

    if (!master) continue;

    // Notify master
    await supabase.from('notifications').insert({
      profile_id: master.profile_id,
      channel: 'telegram',
      title: 'Birthday',
      body: `Today is ${client.full_name}'s birthday! 🎂`,
      status: 'pending',
      scheduled_for: new Date().toISOString(),
    });

    // Auto-greet client if master enabled it
    if (master.birthday_auto_greet) {
      const discount = master.birthday_discount_percent ?? 0;
      const discountText = discount > 0
        ? ` Use code BDAY for ${discount}% off your next visit!`
        : '';

      // Get client's profile_id for notification
      const { data: clientRecord } = await supabase
        .from('clients')
        .select('profile_id')
        .eq('id', client.id)
        .single();

      if (clientRecord?.profile_id) {
        await supabase.from('notifications').insert({
          profile_id: clientRecord.profile_id,
          channel: 'telegram',
          title: 'Happy Birthday! 🎂',
          body: `Happy Birthday, ${client.full_name}!${discountText}`,
          status: 'pending',
          scheduled_for: new Date().toISOString(),
        });
      }
    }
  }

  // Find masters with birthdays today
  const { data: birthdayMasters } = await supabase
    .from('profiles')
    .select('id, full_name, date_of_birth')
    .eq('role', 'master')
    .not('date_of_birth', 'is', null);

  const masterBirthdays = (birthdayMasters ?? []).filter((m) => {
    if (!m.date_of_birth) return false;
    const dob = new Date(m.date_of_birth);
    return dob.getMonth() + 1 === month && dob.getDate() === day;
  });

  for (const master of masterBirthdays) {
    await supabase.from('notifications').insert({
      profile_id: master.id,
      channel: 'telegram',
      title: 'Happy Birthday! 🎂',
      body: `Happy Birthday, ${master.full_name}! Thank you for being part of CRES-CA.`,
      status: 'pending',
      scheduled_for: new Date().toISOString(),
    });
  }

  return NextResponse.json({
    clientBirthdays: clientBirthdays.length,
    masterBirthdays: masterBirthdays.length,
  });
}
