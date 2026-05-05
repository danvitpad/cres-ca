/** --- YAML
 * name: My Working Hours API
 * description: GET текущее расписание мастера. PUT новое (multi-interval).
 *              При PUT — проверяет, что все будущие записи (booked/confirmed)
 *              попадают внутрь новых интервалов. Если нет — 409 со списком
 *              конфликтующих записей. Мастер должен сначала перенести/отменить.
 * created: 2026-05-05
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { resolveUserId } from '@/lib/auth/resolve-user';
import {
  normalizeWorkingHours,
  isRangeInside,
  dayKeyFromDate,
} from '@/lib/working-hours/normalize';
import type { WorkingHours } from '@/types/working-hours';

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function GET(req: Request) {
  const userId = await resolveUserId(req);
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const db = admin();
  const { data: master } = await db
    .from('masters')
    .select('id, working_hours')
    .eq('profile_id', userId)
    .maybeSingle<{ id: string; working_hours: unknown }>();

  if (!master) return NextResponse.json({ error: 'master_not_found' }, { status: 404 });

  return NextResponse.json({
    masterId: master.id,
    working_hours: normalizeWorkingHours(master.working_hours),
  });
}

interface ConflictAppointment {
  id: string;
  starts_at: string;
  ends_at: string;
  client_name: string | null;
  service_name: string | null;
}

export async function PUT(req: Request) {
  const userId = await resolveUserId(req);
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as
    | { working_hours?: unknown; force?: boolean }
    | null;
  if (!body) return NextResponse.json({ error: 'invalid_body' }, { status: 400 });

  const wh: WorkingHours = normalizeWorkingHours(body.working_hours);

  const db = admin();
  const { data: master } = await db
    .from('masters')
    .select('id')
    .eq('profile_id', userId)
    .maybeSingle<{ id: string }>();
  if (!master) return NextResponse.json({ error: 'master_not_found' }, { status: 404 });

  // Conflict check: все будущие записи должны полностью лежать внутри новых
  // интервалов соответствующего дня. Иначе 409 со списком — мастер должен
  // сначала перенести / отменить, потом сохранять.
  const horizon = new Date();
  horizon.setMonth(horizon.getMonth() + 6);

  const { data: appts } = await db
    .from('appointments')
    .select(
      'id, starts_at, ends_at, ' +
        'client:clients(full_name), ' +
        'service:services(name)',
    )
    .eq('master_id', master.id)
    .in('status', ['booked', 'confirmed'])
    .gte('starts_at', new Date().toISOString())
    .lte('starts_at', horizon.toISOString());

  type ApptRow = {
    id: string;
    starts_at: string;
    ends_at: string;
    client: { full_name: string | null } | { full_name: string | null }[] | null;
    service: { name: string | null } | { name: string | null }[] | null;
  };

  const conflicts: ConflictAppointment[] = [];
  for (const a of ((appts ?? []) as unknown) as ApptRow[]) {
    const start = new Date(a.starts_at);
    const end = new Date(a.ends_at);
    const dayKey = dayKeyFromDate(start);
    const day = wh[dayKey];

    // Локальное HH:MM в Europe/Kiev (вся UA-аудитория).
    const fmt = (d: Date) =>
      d.toLocaleTimeString('en-GB', {
        hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Kiev',
      });
    const fromHM = fmt(start);
    const toHM = fmt(end);

    if (!isRangeInside(day, fromHM, toHM)) {
      const client = Array.isArray(a.client) ? a.client[0] : a.client;
      const service = Array.isArray(a.service) ? a.service[0] : a.service;
      conflicts.push({
        id: a.id,
        starts_at: a.starts_at,
        ends_at: a.ends_at,
        client_name: client?.full_name ?? null,
        service_name: service?.name ?? null,
      });
    }
  }

  if (conflicts.length > 0) {
    return NextResponse.json(
      {
        error: 'conflicts',
        message:
          'Есть будущие записи, которые попадут в нерабочее время. Перенесите или отмените их, потом сохраняйте расписание.',
        conflicts,
      },
      { status: 409 },
    );
  }

  const { error: updErr } = await db
    .from('masters')
    .update({ working_hours: wh })
    .eq('id', master.id);
  if (updErr) {
    return NextResponse.json(
      { error: 'update_failed', detail: updErr.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, working_hours: wh });
}
