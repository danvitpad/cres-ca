/** --- YAML
 * name: Birthday Greetings Cron
 * description: Daily cron — checks client/master birthdays and creates greeting notifications. Dedup via [bday:<scope>:<id>:<YYYY-MM-DD>] marker so multiple runs same day are no-ops.
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
  const today = new Date();
  const month = today.getMonth() + 1;
  const day = today.getDate();
  const dayKey = today.toISOString().split('T')[0];

  // Pre-fetch today's existing birthday notifications so we don't double-send
  const { data: alreadySent } = await supabase
    .from('notifications')
    .select('body')
    .ilike('body', `%[bday:%:${dayKey}]%`);
  const sentMarkers = new Set(
    (alreadySent ?? [])
      .map((n) => n.body?.match(/\[bday:[^\]]+\]/)?.[0])
      .filter((m): m is string => !!m),
  );

  const inserts: Array<{
    profile_id: string;
    channel: string;
    title: string;
    body: string;
    scheduled_for: string;
  }> = [];

  // 1. Client birthdays — notify the master + (if opted-in) the client
  const { data: clientsWithBirthdays } = await supabase
    .from('clients')
    .select('id, full_name, master_id, profile_id, date_of_birth')
    .not('date_of_birth', 'is', null);

  const clientHits = (clientsWithBirthdays ?? []).filter((c) => {
    if (!c.date_of_birth) return false;
    const dob = new Date(c.date_of_birth);
    return dob.getMonth() + 1 === month && dob.getDate() === day;
  });

  const masterIds = [...new Set(clientHits.map((c) => c.master_id))];
  const masterMap = new Map<
    string,
    { profile_id: string | null; birthday_auto_greet: boolean | null; birthday_discount_percent: number | null; birthday_bonus_amount: number | null }
  >();
  if (masterIds.length) {
    const { data: masters } = await supabase
      .from('masters')
      .select('id, profile_id, birthday_auto_greet, birthday_discount_percent, birthday_bonus_amount')
      .in('id', masterIds);
    for (const m of masters ?? []) masterMap.set(m.id, m);
  }

  for (const client of clientHits) {
    const master = masterMap.get(client.master_id);
    if (!master?.profile_id) continue;

    const masterMarker = `[bday:master:${client.id}:${dayKey}]`;
    if (!sentMarkers.has(masterMarker)) {
      inserts.push({
        profile_id: master.profile_id,
        channel: 'telegram',
        title: '🎂 Birthday today',
        body: `${client.full_name} has a birthday today! ${masterMarker}`,
        scheduled_for: new Date().toISOString(),
      });
    }

    if (master.birthday_auto_greet && client.profile_id) {
      const clientMarker = `[bday:client:${client.id}:${dayKey}]`;
      if (!sentMarkers.has(clientMarker)) {
        const discount = master.birthday_discount_percent ?? 0;
        const bonus = Number(master.birthday_bonus_amount ?? 0);
        const discountText = discount > 0 ? ` Use BDAY for ${discount}% off your next visit!` : '';
        const bonusText = bonus > 0 ? ` 🎁 We credited ${bonus} to your bonus balance.` : '';
        inserts.push({
          profile_id: client.profile_id,
          channel: 'telegram',
          title: 'Happy Birthday! 🎂',
          body: `Happy Birthday, ${client.full_name}!${discountText}${bonusText} ${clientMarker}`,
          scheduled_for: new Date().toISOString(),
        });
        if (bonus > 0) {
          const { data: cur } = await supabase
            .from('clients')
            .select('bonus_balance')
            .eq('id', client.id)
            .single();
          const newBalance = Number((cur as { bonus_balance: number } | null)?.bonus_balance ?? 0) + bonus;
          await supabase
            .from('clients')
            .update({ bonus_balance: newBalance })
            .eq('id', client.id);
        }
      }
    }
  }

  // 1b. Client anniversaries — one year (or multiples of a year) since first registration in master's book
  const { data: anniClients } = await supabase
    .from('clients')
    .select('id, full_name, master_id, profile_id, created_at')
    .not('created_at', 'is', null);

  const anniHits = (anniClients ?? []).filter((c) => {
    if (!c.created_at) return false;
    const d = new Date(c.created_at);
    if (d.getMonth() + 1 !== month || d.getDate() !== day) return false;
    const years = today.getFullYear() - d.getFullYear();
    return years >= 1;
  });

  if (anniHits.length && masterIds.length === 0) {
    const extraMasterIds = [...new Set(anniHits.map((c) => c.master_id))];
    const { data: masters2 } = await supabase
      .from('masters')
      .select('id, profile_id, birthday_auto_greet')
      .in('id', extraMasterIds);
    for (const m of masters2 ?? []) {
      if (!masterMap.has(m.id)) {
        masterMap.set(m.id, {
          profile_id: m.profile_id ?? null,
          birthday_auto_greet: m.birthday_auto_greet ?? null,
          birthday_discount_percent: null,
          birthday_bonus_amount: null,
        });
      }
    }
  }

  for (const c of anniHits) {
    const master = masterMap.get(c.master_id);
    if (!master?.birthday_auto_greet || !c.profile_id) continue;
    const years = today.getFullYear() - new Date(c.created_at!).getFullYear();
    const marker = `[bday:anni:${c.id}:${dayKey}]`;
    if (sentMarkers.has(marker)) continue;
    inserts.push({
      profile_id: c.profile_id,
      channel: 'telegram',
      title: '🎉 Годовщина!',
      body: `${c.full_name}, уже ${years} ${years === 1 ? 'год' : 'года'} вместе! Спасибо за доверие. ${marker}`,
      scheduled_for: new Date().toISOString(),
    });
  }

  // 2. Master birthdays — platform-side greeting from CRES-CA
  const { data: masterProfiles } = await supabase
    .from('profiles')
    .select('id, full_name, date_of_birth')
    .eq('role', 'master')
    .not('date_of_birth', 'is', null);

  const masterHits = (masterProfiles ?? []).filter((m) => {
    if (!m.date_of_birth) return false;
    const dob = new Date(m.date_of_birth);
    return dob.getMonth() + 1 === month && dob.getDate() === day;
  });

  for (const m of masterHits) {
    const marker = `[bday:platform:${m.id}:${dayKey}]`;
    if (sentMarkers.has(marker)) continue;
    inserts.push({
      profile_id: m.id,
      channel: 'telegram',
      title: 'Happy Birthday! 🎂',
      body: `Happy Birthday, ${m.full_name}! Thanks for being part of CRES-CA. ${marker}`,
      scheduled_for: new Date().toISOString(),
    });
  }

  if (inserts.length) {
    await supabase.from('notifications').insert(inserts);
  }

  return NextResponse.json({
    clientHits: clientHits.length,
    masterHits: masterHits.length,
    inserted: inserts.length,
  });
}
