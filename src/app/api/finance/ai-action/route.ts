/** --- YAML
 * name: Finance AI Action — Plan
 * description: POST { question } — AI разбирает запрос мастера и возвращает либо
 *              `qa` (текстовый ответ — как было раньше), либо `plan` со списком
 *              кандидатов на удаление (payments / expenses / manual_incomes).
 *              Сами удаления НЕ выполняются здесь — только план. Выполняет
 *              /api/finance/ai-action/execute после явного подтверждения мастера.
 * created: 2026-04-26
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { aiChat } from '@/lib/ai/openrouter';

type Intent = 'qa' | 'delete';
type DeleteScope = 'payments' | 'expenses' | 'manual_incomes';

interface PlanCandidate {
  id: string;
  summary: string;       // human-readable «25 апр., 1000 ₴, Стрижка»
  table: DeleteScope;
}

interface AiResponse {
  intent: Intent;
  text: string;
  plan?: { action: 'delete'; candidates: PlanCandidate[] };
}

const SYSTEM = `Ты — AI-помощник в финансовом разделе CRES-CA для частного мастера.
Мастер пишет вопросы или просьбы. Твоя задача — определить намерение и вернуть JSON.

Возможные intent:
- "qa" — обычный вопрос/просьба об анализе. Например «сколько я заработал в апреле»,
  «какая категория самая большая», «дай совет», «оптимизируй». Просто отвечаешь
  текстом, ничего не меняешь.
- "delete" — мастер прямо просит УДАЛИТЬ какую-то запись (платёж, расход, доход).
  Например «удали платёж от 25 апреля на 1000», «убери расход на бензин 15 апреля».

ВАЖНО: ты не выполняешь удаление, ты только определяешь намерение и описываешь, ЧТО
именно должно быть удалено словами. Финальное удаление подтверждает мастер кнопкой.

Выдавай СТРОГО JSON одного из двух видов:

Для qa:
{"intent":"qa","text":"<ответ по-русски, кратко>"}

Для delete:
{"intent":"delete","text":"<какие записи я предлагаю удалить — кратко>","filter":{"table":"payments|expenses|manual_incomes","date":"YYYY-MM-DD|null","amount":<число|null>,"hint":"<кусок описания|null>"}}

Правила:
- Никогда не предлагай delete без явной просьбы мастера («удали», «убери», «снеси»).
- Если ты не уверен — ставь "qa" и попроси уточнения.
- Если намерение delete ясно, но мастер не указал дату/сумму — fields null,
  система сама подберёт кандидатов из недавних записей.
- ВЫВОДИ ТОЛЬКО JSON. Без markdown, без комментариев.`;

interface PaymentRow { id: string; amount: number; type: string | null; payment_method: string | null; created_at: string }
interface ExpenseRow { id: string; amount: number; category: string | null; description: string | null; date: string }
interface IncomeRow  { id: string; amount: number; description: string | null; date: string }

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null) as { question?: string } | null;
  const q = body?.question?.trim();
  if (!q || q.length < 2) return NextResponse.json({ error: 'empty' }, { status: 400 });
  if (q.length > 600) return NextResponse.json({ error: 'too_long' }, { status: 400 });

  const { data: master } = await supabase
    .from('masters')
    .select('id')
    .eq('profile_id', user.id)
    .maybeSingle();
  if (!master) return NextResponse.json({ error: 'not_master' }, { status: 403 });

  // Build small context — last 30 days summaries (lightweight, just for QA).
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const sinceIso = since.toISOString();
  const sinceDate = sinceIso.slice(0, 10);

  const [{ data: pays }, { data: exps }, { data: incs }] = await Promise.all([
    supabase.from('payments')
      .select('id, amount, type, payment_method, created_at')
      .eq('master_id', master.id)
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase.from('expenses')
      .select('id, amount, category, description, date')
      .eq('master_id', master.id)
      .gte('date', sinceDate)
      .order('date', { ascending: false })
      .limit(50),
    supabase.from('manual_incomes')
      .select('id, amount, description, date')
      .eq('master_id', master.id)
      .gte('date', sinceDate)
      .order('date', { ascending: false })
      .limit(50),
  ]);
  const payments = (pays as PaymentRow[] | null) ?? [];
  const expenses = (exps as ExpenseRow[] | null) ?? [];
  const incomes  = (incs as IncomeRow[]  | null) ?? [];

  // Quick aggregate context for QA prompt
  const revenue = payments.filter((p) => p.type !== 'refund')
    .reduce((s, p) => s + Number(p.amount || 0), 0);
  const totalExp = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const cats: Record<string, number> = {};
  for (const e of expenses) {
    const c = e.category || 'Прочее';
    cats[c] = (cats[c] ?? 0) + Number(e.amount || 0);
  }

  const ctx = `КОНТЕКСТ (30 дней)
Доходы: ${revenue} ₴ (${payments.length} платежей)
Расходы: ${totalExp} ₴ (${expenses.length} записей, по категориям: ${JSON.stringify(cats)})
Ручные доходы: ${incomes.length} записей

ВОПРОС МАСТЕРА:
${q}`;

  let raw = '';
  try {
    raw = await aiChat([
      { role: 'system', content: SYSTEM },
      { role: 'user', content: ctx },
    ], { temperature: 0.2, maxTokens: 350 });
  } catch (e) {
    console.error('[ai-action] aiChat fail:', e);
  }

  const cleaned = raw.replace(/```json\n?|```\n?/g, '').trim();
  const m = cleaned.match(/\{[\s\S]*\}/);
  let parsed: { intent?: string; text?: string; filter?: { table?: string; date?: string | null; amount?: number | null; hint?: string | null } } = {};
  try {
    if (m) parsed = JSON.parse(m[0]);
  } catch {
    // fall through to default qa
  }

  // Default to QA if AI gave nothing useful
  if (parsed.intent !== 'delete' || !parsed.filter) {
    return NextResponse.json<AiResponse>({
      intent: 'qa',
      text: parsed.text?.trim() || raw.trim() || 'Не получилось обработать запрос — попробуй ещё раз.',
    });
  }

  // Resolve delete candidates from filter
  const filter = parsed.filter;
  const targetTable = (filter.table === 'expenses' || filter.table === 'manual_incomes') ? filter.table : 'payments';
  const filterAmount = typeof filter.amount === 'number' ? filter.amount : null;
  const filterDate = filter.date && /^\d{4}-\d{2}-\d{2}$/.test(filter.date) ? filter.date : null;
  const hint = (filter.hint || '').toLowerCase().trim();

  let pool: PlanCandidate[] = [];
  if (targetTable === 'payments') {
    pool = payments
      .filter((p) => filterAmount == null || Math.abs(Number(p.amount) - filterAmount) < 0.01)
      .filter((p) => !filterDate || p.created_at.startsWith(filterDate))
      .map((p) => ({
        id: p.id,
        table: 'payments' as const,
        summary: `${p.created_at.slice(0, 10)} · ${Number(p.amount).toLocaleString('ru-RU')} ₴ · ${p.payment_method || 'оплата'}`,
      }));
  } else if (targetTable === 'expenses') {
    pool = expenses
      .filter((e) => filterAmount == null || Math.abs(Number(e.amount) - filterAmount) < 0.01)
      .filter((e) => !filterDate || e.date === filterDate)
      .filter((e) => !hint || (e.description ?? '').toLowerCase().includes(hint) || (e.category ?? '').toLowerCase().includes(hint))
      .map((e) => ({
        id: e.id,
        table: 'expenses' as const,
        summary: `${e.date} · ${Number(e.amount).toLocaleString('ru-RU')} ₴ · ${e.category || 'расход'}${e.description ? ` (${e.description})` : ''}`,
      }));
  } else {
    pool = incomes
      .filter((i) => filterAmount == null || Math.abs(Number(i.amount) - filterAmount) < 0.01)
      .filter((i) => !filterDate || i.date === filterDate)
      .filter((i) => !hint || (i.description ?? '').toLowerCase().includes(hint))
      .map((i) => ({
        id: i.id,
        table: 'manual_incomes' as const,
        summary: `${i.date} · ${Number(i.amount).toLocaleString('ru-RU')} ₴${i.description ? ` · ${i.description}` : ''}`,
      }));
  }

  pool = pool.slice(0, 5);

  if (pool.length === 0) {
    return NextResponse.json<AiResponse>({
      intent: 'qa',
      text: 'Я не нашёл записей под твоё описание за последние 30 дней. Уточни дату или сумму.',
    });
  }

  return NextResponse.json<AiResponse>({
    intent: 'delete',
    text: parsed.text?.trim() || `Нашёл ${pool.length} ${pool.length === 1 ? 'запись' : 'записей'} — подтверди удаление.`,
    plan: { action: 'delete', candidates: pool },
  });
}
