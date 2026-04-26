/** --- YAML
 * name: NPS Survey Cron
 * description: После 3-го completed visit (и каждого 10-го после) отправляет NPS-опрос клиенту. Дедуп по маркеру [nps:clientId:N]. Шаблон kind='nps' (subject + body).
 * created: 2026-04-13
 * updated: 2026-04-25
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { pickFullTemplate, renderFullTemplate } from '@/lib/messaging/render-template';
import { loadAutomationSettings, isEnabled } from '@/lib/messaging/automation-settings';

type Lang = 'ru' | 'uk' | 'en';

const FALLBACK_NPS: Record<Lang, { subject: string; body: string }> = {
  ru: {
    subject: '📊 Короткий опрос',
    body: '{client_name}, вы были у нас уже {total} раз. Оцените от 0 до 10 — насколько вы рекомендовали бы нас друзьям? [nps:{client_id}:{total}]',
  },
  uk: {
    subject: '📊 Короткий опитувальник',
    body: '{client_name}, ви були у нас вже {total} раз. Оцініть від 0 до 10 — наскільки ви порекомендували б нас друзям? [nps:{client_id}:{total}]',
  },
  en: {
    subject: '📊 Quick survey',
    body: '{client_name}, you have visited {total} times. From 0 to 10 — how likely would you recommend us to a friend? [nps:{client_id}:{total}]',
  },
};

function resolveLang(raw: unknown): Lang {
  return raw === 'uk' || raw === 'en' ? raw : 'ru';
}

const NPS_TRIGGER_VISITS = [3, 10, 20, 50];

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = await createClient();
  const now = new Date();

  const { data: clients } = await supabase
    .from('clients')
    .select('id, master_id, full_name, profile_id, total_visits')
    .not('profile_id', 'is', null)
    .in('total_visits', NPS_TRIGGER_VISITS);

  if (!clients?.length) return NextResponse.json({ sent: 0 });

  const masterIds = Array.from(new Set(clients.map((c) => c.master_id)));
  const automationSettings = await loadAutomationSettings(supabase, masterIds);
  const { data: mastersLangRows } = await supabase
    .from('masters')
    .select('id, public_language')
    .in('id', masterIds);
  const langByMaster = new Map<string, Lang>();
  for (const m of (mastersLangRows ?? []) as Array<{ id: string; public_language: string | null }>) {
    langByMaster.set(m.id, resolveLang(m.public_language));
  }
  const { data: tplRows } = await supabase
    .from('message_templates')
    .select('master_id, subject, content, is_active')
    .eq('kind', 'nps')
    .eq('is_active', true)
    .in('master_id', masterIds);
  const tplMap = new Map<string, typeof tplRows>();
  for (const row of tplRows ?? []) {
    const arr = tplMap.get(row.master_id) ?? [];
    arr.push(row);
    tplMap.set(row.master_id, arr);
  }

  const { data: existing } = await supabase
    .from('notifications')
    .select('body')
    .like('body', '%[nps:%');
  const alreadySent = new Set<string>();
  for (const n of existing ?? []) {
    const m = n.body?.match(/\[nps:([0-9a-f-]{36}):(\d+)\]/i);
    if (m) alreadySent.add(`${m[1]}:${m[2]}`);
  }

  let sent = 0;
  for (const c of clients) {
    if (!isEnabled(automationSettings, c.master_id, 'nps')) continue;
    const marker = `${c.id}:${c.total_visits}`;
    if (alreadySent.has(marker)) continue;

    const lang = langByMaster.get(c.master_id) ?? 'ru';
    const fb = FALLBACK_NPS[lang];
    const tpl = pickFullTemplate(tplMap.get(c.master_id), fb.body, fb.subject);
    const rendered = renderFullTemplate(tpl, {
      client_name: c.full_name ?? 'клиент',
      total: c.total_visits,
      client_id: c.id,
    });
    let body = rendered.body;
    if (!body.includes(`[nps:${c.id}:${c.total_visits}]`)) {
      body = `${body} [nps:${c.id}:${c.total_visits}]`;
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
