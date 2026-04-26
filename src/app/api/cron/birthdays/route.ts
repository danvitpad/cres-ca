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

  interface BirthdayCfg {
    enabled: boolean;
    send_tg_greeting: boolean;
    greeting_message: string;
    offer_discount: boolean;
    discount_percent: number;
    discount_visits: number;
    discount_validity_days: number;
    discount_services: string[];
  }
  const masterIds = [...new Set(clientHits.map((c) => c.master_id))];
  const masterMap = new Map<
    string,
    { profile_id: string | null; cfg: BirthdayCfg | null; birthday_auto_greet: boolean | null }
  >();
  if (masterIds.length) {
    const { data: masters } = await supabase
      .from('masters')
      .select('id, profile_id, birthday_auto_greet, birthday_settings')
      .in('id', masterIds);
    for (const m of masters ?? []) {
      const r = m as unknown as { id: string; profile_id: string | null; birthday_auto_greet: boolean | null; birthday_settings: BirthdayCfg | null };
      masterMap.set(r.id, { profile_id: r.profile_id, cfg: r.birthday_settings, birthday_auto_greet: r.birthday_auto_greet });
    }
  }

  // Helper: «39 лет» / «41 год» / «42 года» по правилам русского склонения.
  const ruYears = (n: number) => {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return `${n} год`;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `${n} года`;
    return `${n} лет`;
  };
  const RU_MONTHS = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
  const fmtBirthday = (dob: string) => {
    const d = new Date(dob);
    const age = today.getFullYear() - d.getFullYear();
    return { dateLabel: `${d.getDate()} ${RU_MONTHS[d.getMonth()]}`, ageLabel: ruYears(age) };
  };

  for (const client of clientHits) {
    const master = masterMap.get(client.master_id);
    if (!master?.profile_id) continue;

    // Always notify the master themselves — с конкретной датой и возрастом
    const masterMarker = `[bday:master:${client.id}:${dayKey}]`;
    if (!sentMarkers.has(masterMarker)) {
      const { dateLabel, ageLabel } = fmtBirthday(client.date_of_birth!);
      inserts.push({
        profile_id: master.profile_id,
        channel: 'telegram',
        title: '🎂 День рождения сегодня',
        body: `Сегодня (${dateLabel}) у клиента ${client.full_name} день рождения — исполняется ${ageLabel}! ${masterMarker}`,
        scheduled_for: new Date().toISOString(),
      });
    }

    // Send greeting to client per cfg
    const cfg = master.cfg;
    if (cfg?.enabled && cfg.send_tg_greeting && client.profile_id) {
      const clientMarker = `[bday:client:${client.id}:${dayKey}]`;
      if (!sentMarkers.has(clientMarker)) {
        const discountText = cfg.offer_discount
          ? `${cfg.discount_percent}% скидка на ${cfg.discount_visits === 1 ? 'следующий визит' : `${cfg.discount_visits} визитов`}, действует ${cfg.discount_validity_days} дней`
          : '🎁';
        const body = (cfg.greeting_message || 'С днём рождения, {client_name}!')
          .replace('{client_name}', client.full_name || 'друг')
          .replace('{discount_text}', discountText) + ` ${clientMarker}`;
        inserts.push({
          profile_id: client.profile_id,
          channel: 'telegram',
          title: '🎂 С днём рождения!',
          body,
          scheduled_for: new Date().toISOString(),
        });
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
      .select('id, profile_id, birthday_auto_greet, birthday_settings')
      .in('id', extraMasterIds);
    for (const m of masters2 ?? []) {
      if (!masterMap.has(m.id)) {
        const r = m as unknown as { id: string; profile_id: string | null; birthday_auto_greet: boolean | null; birthday_settings: BirthdayCfg | null };
        masterMap.set(r.id, {
          profile_id: r.profile_id,
          cfg: r.birthday_settings,
          birthday_auto_greet: r.birthday_auto_greet,
        });
      }
    }
  }

  for (const c of anniHits) {
    const master = masterMap.get(c.master_id);
    // Anniversaries fire only when birthday automation enabled
    if (!master?.cfg?.enabled || !master.cfg.send_tg_greeting || !c.profile_id) continue;
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

  // 1c. Partner birthdays — мастер↔мастер. Для каждой accepted-партнёрки
  //     уведомляем владельца записи о ДР партнёра (с датой + возрастом).
  const { data: partnerships } = await supabase
    .from('master_partnerships')
    .select(`
      master_id,
      partner:masters!master_partnerships_partner_id_fkey(
        id,
        display_name,
        profile:profiles!masters_profile_id_fkey(full_name, date_of_birth)
      )
    `)
    .eq('status', 'accepted');

  type PartnerRow = {
    master_id: string;
    partner: {
      id: string;
      display_name: string | null;
      profile: { full_name: string | null; date_of_birth: string | null } | { full_name: string | null; date_of_birth: string | null }[] | null;
    } | null;
  };

  // Map: master_id -> profile_id, чтобы знать кому слать (используем уже собранный + добираем недостающих)
  const masterOwnerProfileIds = new Map<string, string | null>();
  for (const [mid, info] of masterMap.entries()) masterOwnerProfileIds.set(mid, info.profile_id);
  const partnerHits: Array<{ ownerMasterId: string; partnerName: string; dob: string; partnerMasterId: string }> = [];

  for (const row of (partnerships ?? []) as PartnerRow[]) {
    const p = row.partner;
    if (!p) continue;
    const profile = Array.isArray(p.profile) ? p.profile[0] : p.profile;
    const dob = profile?.date_of_birth;
    if (!dob) continue;
    const dobDate = new Date(dob);
    if (dobDate.getMonth() + 1 !== month || dobDate.getDate() !== day) continue;
    partnerHits.push({
      ownerMasterId: row.master_id,
      partnerName: p.display_name || profile?.full_name || 'Партнёр',
      dob,
      partnerMasterId: p.id,
    });
  }

  // Дозабираем profile_id для мастеров-владельцев, которых ещё не было в map'е (только у клиентских попаданий)
  const missingOwnerIds = partnerHits
    .map((h) => h.ownerMasterId)
    .filter((id) => !masterOwnerProfileIds.has(id));
  if (missingOwnerIds.length) {
    const { data: extraOwners } = await supabase
      .from('masters')
      .select('id, profile_id')
      .in('id', missingOwnerIds);
    for (const m of extraOwners ?? []) {
      masterOwnerProfileIds.set(m.id, (m as { profile_id: string | null }).profile_id);
    }
  }

  for (const hit of partnerHits) {
    const ownerProfileId = masterOwnerProfileIds.get(hit.ownerMasterId);
    if (!ownerProfileId) continue;
    const marker = `[bday:partner:${hit.partnerMasterId}:${hit.ownerMasterId}:${dayKey}]`;
    if (sentMarkers.has(marker)) continue;
    const { dateLabel, ageLabel } = fmtBirthday(hit.dob);
    inserts.push({
      profile_id: ownerProfileId,
      channel: 'telegram',
      title: '🎂 ДР партнёра',
      body: `Сегодня (${dateLabel}) у партнёра ${hit.partnerName} день рождения — исполняется ${ageLabel}! ${marker}`,
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
