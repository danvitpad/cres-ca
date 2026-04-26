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

  // Локализованный «возраст» + строки — должны быть объявлены ДО первого использования
  // (выше в сборе masters читаем public_language через resolveLang).
  type Lang = 'ru' | 'uk' | 'en';
  const resolveLang = (raw: unknown): Lang => (raw === 'uk' || raw === 'en' ? raw : 'ru');

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
    { profile_id: string | null; cfg: BirthdayCfg | null; birthday_auto_greet: boolean | null; public_language: Lang }
  >();
  if (masterIds.length) {
    const { data: masters } = await supabase
      .from('masters')
      .select('id, profile_id, birthday_auto_greet, birthday_settings, public_language')
      .in('id', masterIds);
    for (const m of masters ?? []) {
      const r = m as unknown as { id: string; profile_id: string | null; birthday_auto_greet: boolean | null; birthday_settings: BirthdayCfg | null; public_language: string | null };
      masterMap.set(r.id, {
        profile_id: r.profile_id,
        cfg: r.birthday_settings,
        birthday_auto_greet: r.birthday_auto_greet,
        public_language: resolveLang(r.public_language),
      });
    }
  }

  const ruYears = (n: number) => {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return `${n} год`;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `${n} года`;
    return `${n} лет`;
  };
  const ukYears = (n: number) => {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return `${n} рік`;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `${n} роки`;
    return `${n} років`;
  };
  const enYears = (n: number) => `${n} ${n === 1 ? 'year' : 'years'}`;
  const yearsBy: Record<Lang, (n: number) => string> = { ru: ruYears, uk: ukYears, en: enYears };
  const MONTHS: Record<Lang, string[]> = {
    ru: ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'],
    uk: ['січня','лютого','березня','квітня','травня','червня','липня','серпня','вересня','жовтня','листопада','грудня'],
    en: ['January','February','March','April','May','June','July','August','September','October','November','December'],
  };
  const fmtBirthday = (dob: string, lang: Lang) => {
    const d = new Date(dob);
    const age = today.getFullYear() - d.getFullYear();
    return { dateLabel: `${d.getDate()} ${MONTHS[lang][d.getMonth()]}`, ageLabel: yearsBy[lang](age) };
  };

  const MASTER_TITLE: Record<Lang, string> = {
    ru: '🎂 День рождения сегодня',
    uk: '🎂 День народження сьогодні',
    en: '🎂 Birthday today',
  };
  const MASTER_BODY: Record<Lang, (date: string, name: string, age: string, marker: string) => string> = {
    ru: (date, name, age, marker) => `Сегодня (${date}) у клиента ${name} день рождения — исполняется ${age}! ${marker}`,
    uk: (date, name, age, marker) => `Сьогодні (${date}) у клієнта ${name} день народження — виповнюється ${age}! ${marker}`,
    en: (date, name, age, marker) => `Today (${date}) is ${name}'s birthday — they turn ${age}! ${marker}`,
  };
  const ANNI_TITLE: Record<Lang, string> = { ru: '🎉 Годовщина!', uk: '🎉 Річниця!', en: '🎉 Anniversary!' };
  const PARTNER_TITLE: Record<Lang, string> = { ru: '🎂 ДР партнёра', uk: '🎂 ДН партнера', en: '🎂 Partner birthday' };
  const PARTNER_BODY: Record<Lang, (date: string, name: string, age: string, marker: string) => string> = {
    ru: (date, name, age, marker) => `Сегодня (${date}) у партнёра ${name} день рождения — исполняется ${age}! ${marker}`,
    uk: (date, name, age, marker) => `Сьогодні (${date}) у партнера ${name} день народження — виповнюється ${age}! ${marker}`,
    en: (date, name, age, marker) => `Today (${date}) is partner ${name}'s birthday — they turn ${age}! ${marker}`,
  };

  for (const client of clientHits) {
    const master = masterMap.get(client.master_id);
    if (!master?.profile_id) continue;
    const lang = master.public_language;

    // Always notify the master themselves — с конкретной датой и возрастом
    const masterMarker = `[bday:master:${client.id}:${dayKey}]`;
    if (!sentMarkers.has(masterMarker)) {
      const { dateLabel, ageLabel } = fmtBirthday(client.date_of_birth!, lang);
      inserts.push({
        profile_id: master.profile_id,
        channel: 'telegram',
        title: MASTER_TITLE[lang],
        body: MASTER_BODY[lang](dateLabel, client.full_name || 'Клиент', ageLabel, masterMarker),
        scheduled_for: new Date().toISOString(),
      });
    }

    // Send greeting to client per cfg
    const cfg = master.cfg;
    if (cfg?.enabled && cfg.send_tg_greeting && client.profile_id) {
      const clientMarker = `[bday:client:${client.id}:${dayKey}]`;
      if (!sentMarkers.has(clientMarker)) {
        // Дефолтный шаблон без приветствия — работает и на «ты», и на «Вы».
        const DEFAULT_GREETING_BY_LANG: Record<Lang, string> = {
          ru: 'С днём рождения!\nВ подарок: {discount_text}',
          uk: 'З днем народження!\nУ подарунок: {discount_text}',
          en: 'Happy birthday!\nGift: {discount_text}',
        };
        const discountTextByLang: Record<Lang, string> = {
          ru: cfg.offer_discount
            ? `${cfg.discount_percent}% скидка на ${cfg.discount_visits === 1 ? 'следующий визит' : `${cfg.discount_visits} визитов`}, действует ${cfg.discount_validity_days} дней`
            : '🎁',
          uk: cfg.offer_discount
            ? `${cfg.discount_percent}% знижка на ${cfg.discount_visits === 1 ? 'наступний візит' : `${cfg.discount_visits} візитів`}, діє ${cfg.discount_validity_days} днів`
            : '🎁',
          en: cfg.offer_discount
            ? `${cfg.discount_percent}% off ${cfg.discount_visits === 1 ? 'next visit' : `${cfg.discount_visits} visits`}, valid ${cfg.discount_validity_days} days`
            : '🎁',
        };
        const greetingTpl = (cfg.greeting_message && cfg.greeting_message.trim().length > 0)
          ? cfg.greeting_message
          : DEFAULT_GREETING_BY_LANG[lang];
        const body = greetingTpl
          .replace('{client_name}', client.full_name || '')
          .replace('{discount_text}', discountTextByLang[lang]) + ` ${clientMarker}`;
        const title = lang === 'uk' ? '🎂 З днем народження!' : lang === 'en' ? '🎂 Happy birthday!' : '🎂 С днём рождения!';
        inserts.push({
          profile_id: client.profile_id,
          channel: 'telegram',
          title,
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
      .select('id, profile_id, birthday_auto_greet, birthday_settings, public_language')
      .in('id', extraMasterIds);
    for (const m of masters2 ?? []) {
      if (!masterMap.has(m.id)) {
        const r = m as unknown as { id: string; profile_id: string | null; birthday_auto_greet: boolean | null; birthday_settings: BirthdayCfg | null; public_language: string | null };
        masterMap.set(r.id, {
          profile_id: r.profile_id,
          cfg: r.birthday_settings,
          birthday_auto_greet: r.birthday_auto_greet,
          public_language: resolveLang(r.public_language),
        });
      }
    }
  }

  const ANNI_BODY: Record<Lang, (name: string, years: string, marker: string) => string> = {
    ru: (name, years, marker) => `${name}, уже ${years} вместе! Спасибо за доверие. ${marker}`,
    uk: (name, years, marker) => `${name}, вже ${years} разом! Дякую за довіру. ${marker}`,
    en: (name, years, marker) => `${name}, ${years} together already! Thank you for your trust. ${marker}`,
  };

  for (const c of anniHits) {
    const master = masterMap.get(c.master_id);
    // Anniversaries fire only when birthday automation enabled
    if (!master?.cfg?.enabled || !master.cfg.send_tg_greeting || !c.profile_id) continue;
    const lang = master.public_language;
    const years = today.getFullYear() - new Date(c.created_at!).getFullYear();
    const marker = `[bday:anni:${c.id}:${dayKey}]`;
    if (sentMarkers.has(marker)) continue;
    inserts.push({
      profile_id: c.profile_id,
      channel: 'telegram',
      title: ANNI_TITLE[lang],
      body: ANNI_BODY[lang](c.full_name || 'Клиент', yearsBy[lang](years), marker),
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

  // Map: master_id -> { profile_id, language }, чтобы знать кому слать и на каком языке
  const masterOwnerInfo = new Map<string, { profile_id: string | null; lang: Lang }>();
  for (const [mid, info] of masterMap.entries()) {
    masterOwnerInfo.set(mid, { profile_id: info.profile_id, lang: info.public_language });
  }
  const partnerHits: Array<{ ownerMasterId: string; partnerName: string; dob: string; partnerMasterId: string }> = [];

  for (const row of (partnerships ?? []) as unknown as PartnerRow[]) {
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

  // Дозабираем profile_id + public_language для мастеров-владельцев,
  // которых ещё не было в map'е (только у клиентских попаданий).
  const missingOwnerIds = partnerHits
    .map((h) => h.ownerMasterId)
    .filter((id) => !masterOwnerInfo.has(id));
  if (missingOwnerIds.length) {
    const { data: extraOwners } = await supabase
      .from('masters')
      .select('id, profile_id, public_language')
      .in('id', missingOwnerIds);
    for (const m of extraOwners ?? []) {
      const r = m as { id: string; profile_id: string | null; public_language: string | null };
      masterOwnerInfo.set(r.id, { profile_id: r.profile_id, lang: resolveLang(r.public_language) });
    }
  }

  for (const hit of partnerHits) {
    const owner = masterOwnerInfo.get(hit.ownerMasterId);
    if (!owner?.profile_id) continue;
    const lang = owner.lang;
    const marker = `[bday:partner:${hit.partnerMasterId}:${hit.ownerMasterId}:${dayKey}]`;
    if (sentMarkers.has(marker)) continue;
    const { dateLabel, ageLabel } = fmtBirthday(hit.dob, lang);
    inserts.push({
      profile_id: owner.profile_id,
      channel: 'telegram',
      title: PARTNER_TITLE[lang],
      body: PARTNER_BODY[lang](dateLabel, hit.partnerName, ageLabel, marker),
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
