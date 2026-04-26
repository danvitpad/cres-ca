/** --- YAML
 * name: Win-back Cron
 * description: Находит клиентов, которые не были 60+ дней, и отправляет TG-пуш с win-back шаблоном (subject + body). Дедуп по маркеру [winback:clientId:YYYYMM]. Шаблон message_templates kind='win_back'.
 * created: 2026-04-13
 * updated: 2026-04-25
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { pickFullTemplate, renderFullTemplate } from '@/lib/messaging/render-template';
import { loadAutomationSettings, isEnabled } from '@/lib/messaging/automation-settings';

type Lang = 'ru' | 'uk' | 'en';

const FALLBACK_WINBACK: Record<Lang, { subject: string; body: string }> = {
  ru: {
    subject: '💜 Давно не виделись',
    body: 'Давно не виделись 🙂\nЕсть свободные слоты на этой неделе — записаться можно прямо в боте.\n[winback:{client_id}:{tag}]',
  },
  uk: {
    subject: '💜 Давно не бачились',
    body: 'Давно не бачились 🙂\nЄ вільні слоти цього тижня — записатися можна прямо в боті.\n[winback:{client_id}:{tag}]',
  },
  en: {
    subject: '💜 It has been a while',
    body: 'It has been a while 🙂\nOpen slots this week — book straight in the bot.\n[winback:{client_id}:{tag}]',
  },
};

function resolveLang(raw: unknown): Lang {
  return raw === 'uk' || raw === 'en' ? raw : 'ru';
}

const WINBACK_DAYS = 60;
const MAX_DAYS = 365;

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = await createClient();
  const now = new Date();
  const cutoffOld = new Date(now.getTime() - WINBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const cutoffMax = new Date(now.getTime() - MAX_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const tag = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;

  const { data: clients } = await supabase
    .from('clients')
    .select('id, master_id, full_name, profile_id, last_visit_at, total_visits')
    .not('profile_id', 'is', null)
    .gte('total_visits', 1)
    .lte('last_visit_at', cutoffOld)
    .gte('last_visit_at', cutoffMax);

  if (!clients?.length) return NextResponse.json({ sent: 0 });

  const masterIds = Array.from(new Set(clients.map((c) => c.master_id)));
  const automationSettings = await loadAutomationSettings(supabase, masterIds);
  const { data: tplRows } = await supabase
    .from('message_templates')
    .select('master_id, subject, content, is_active')
    .eq('kind', 'win_back')
    .eq('is_active', true)
    .in('master_id', masterIds);
  const tplMap = new Map<string, typeof tplRows>();
  for (const row of tplRows ?? []) {
    const arr = tplMap.get(row.master_id) ?? [];
    arr.push(row);
    tplMap.set(row.master_id, arr);
  }

  const { data: recentNotifs } = await supabase
    .from('notifications')
    .select('body')
    .gte('created_at', new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000).toISOString())
    .like('body', '%[winback:%');
  const alreadySent = new Set<string>();
  for (const n of recentNotifs ?? []) {
    const m = n.body?.match(/\[winback:([0-9a-f-]{36}):(\d+)\]/i);
    if (m) alreadySent.add(`${m[1]}:${m[2]}`);
  }

  const { data: masterRows } = await supabase
    .from('masters')
    .select('id, display_name, public_language')
    .in('id', masterIds);
  const masterInfo = new Map<string, { name: string; lang: Lang }>();
  for (const m of (masterRows ?? []) as Array<{ id: string; display_name: string | null; public_language: string | null }>) {
    masterInfo.set(m.id, { name: m.display_name ?? '', lang: resolveLang(m.public_language) });
  }
  const masterNameById = new Map<string, string>();
  for (const [id, info] of masterInfo) masterNameById.set(id, info.name);

  let sent = 0;
  for (const c of clients) {
    if (!isEnabled(automationSettings, c.master_id, 'win_back')) continue;
    const marker = `${c.id}:${tag}`;
    if (alreadySent.has(marker)) continue;

    const daysSince = Math.round(
      (now.getTime() - new Date(c.last_visit_at!).getTime()) / (24 * 60 * 60 * 1000),
    );
    const lang = masterInfo.get(c.master_id)?.lang ?? 'ru';
    const fb = FALLBACK_WINBACK[lang];
    const tpl = pickFullTemplate(tplMap.get(c.master_id), fb.body, fb.subject);
    const rendered = renderFullTemplate(tpl, {
      client_name: c.full_name ?? 'клиент',
      master_name: masterNameById.get(c.master_id) ?? '',
      days: daysSince,
      client_id: c.id,
      tag,
    });
    let body = rendered.body;
    if (!body.includes(`[winback:${c.id}:${tag}]`)) {
      body = `${body} [winback:${c.id}:${tag}]`;
    }

    await supabase.from('notifications').insert({
      profile_id: c.profile_id,
      channel: 'telegram',
      title: rendered.subject ?? fb.subject,
      body,
      scheduled_for: now.toISOString(),
    });
    sent++;
  }

  return NextResponse.json({ sent });
}
