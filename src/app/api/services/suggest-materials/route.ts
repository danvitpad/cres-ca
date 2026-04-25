/** --- YAML
 * name: AI Suggest Service Materials
 * description: Master describes a service (name, duration, vertical) → Gemini estimates how much
 *              of each existing inventory item is typically used per visit. Returns a list of
 *              {item_id, quantity, unit, reason} suggestions the master can review and accept.
 * created: 2026-04-25
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { aiComplete } from '@/lib/ai/openrouter';

interface InventoryItem {
  id: string;
  name: string;
  unit: string;
}
interface Suggestion {
  item_id: string;
  quantity: number;
  unit: string;
  reason: string;
}

const SYSTEM_PROMPT = `Ты помощник CRES-CA. Мастер описывает услугу (название, длительность, ниша),
а ты оцениваешь, сколько каждого расходника со склада мастера примерно уходит на ОДИН визит.

Тебе передадут JSON:
{
  "service": { "name": "...", "duration_minutes": 60, "vertical": "..." },
  "inventory": [
    { "id": "uuid", "name": "...", "unit": "ml" },
    ...
  ]
}

Верни строго JSON следующей формы:

{
  "suggestions": [
    { "item_id": "uuid из inventory", "quantity": 0.5, "unit": "ml", "reason": "1-2 фразы почему столько" },
    ...
  ],
  "summary": "1-2 предложения по-русски, что предложил"
}

Правила:
- Включай ТОЛЬКО те расходники из inventory, которые реально применимы к этой услуге.
  Если расходник не подходит (например «лак для волос» к маникюру) — не включай.
- quantity — реалистичное среднее на ОДИН визит. Округляй до 1-2 знаков.
- unit — копируй из inventory_items, не выдумывай.
- reason — одно короткое предложение, чтобы мастер понимал почему.
- Если ни один расходник не подходит — верни {"suggestions": [], "summary": "..."}.
- НЕ выдумывай новые материалы которых нет в inventory.
- Выводи ТОЛЬКО JSON, без markdown, без пояснений.`;

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null) as
    | { service_name?: string; duration_minutes?: number; service_id?: string | null }
    | null;
  const serviceName = body?.service_name?.trim();
  if (!serviceName) {
    return NextResponse.json({ error: 'missing_service_name' }, { status: 400 });
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: master } = await admin
    .from('masters')
    .select('id, vertical, specialization')
    .eq('profile_id', user.id)
    .maybeSingle();
  if (!master) return NextResponse.json({ error: 'not_master' }, { status: 403 });

  const { data: items } = await admin
    .from('inventory_items')
    .select('id, name, unit')
    .eq('master_id', master.id)
    .order('name');

  const inventory = (items ?? []) as InventoryItem[];
  if (inventory.length === 0) {
    return NextResponse.json({
      suggestions: [],
      summary: 'У тебя пока нет расходников на складе. Сначала добавь материалы в Склад, тогда AI сможет посчитать дозы.',
    });
  }

  const userPayload = JSON.stringify({
    service: {
      name: serviceName,
      duration_minutes: body?.duration_minutes ?? null,
      vertical: master.vertical || master.specialization || null,
    },
    inventory: inventory.map((i) => ({ id: i.id, name: i.name, unit: i.unit })),
  });

  let result: { suggestions: Suggestion[]; summary: string } = { suggestions: [], summary: '' };
  try {
    const raw = await aiComplete(SYSTEM_PROMPT, userPayload);
    const cleaned = raw.replace(/```json\n?|```\n?/g, '').trim();
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) {
      const parsed = JSON.parse(m[0]) as { suggestions?: Suggestion[]; summary?: string };
      result = {
        suggestions: (parsed.suggestions ?? []).filter((s) =>
          inventory.some((i) => i.id === s.item_id) && s.quantity > 0,
        ),
        summary: parsed.summary ?? '',
      };
    }
  } catch (e) {
    console.error('[suggest-materials] AI failed:', e);
    return NextResponse.json({ error: 'ai_failed' }, { status: 500 });
  }

  return NextResponse.json(result);
}
