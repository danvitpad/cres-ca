/** --- YAML
 * name: Notification preferences API
 * description: GET / PUT — own notification_preferences row. Offsets in minutes before event.
 *              UI form sends { days, hours, minutes } per entry; backend converts to total minutes.
 *              Auth: Supabase cookie OR Telegram initData (x-tg-init-data header) for Mini App.
 * created: 2026-04-24
 * updated: 2026-04-25
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { validateInitData } from '@/lib/telegram/validate-init-data';

export const dynamic = 'force-dynamic';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminDb = any;

async function resolveViewer(req: Request): Promise<{ id: string; admin: AdminDb } | null> {
  const initData = req.headers.get('x-tg-init-data');
  if (initData) {
    const res = validateInitData(initData);
    if (!('error' in res)) {
      const admin = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } },
      );
      const { data: p } = await admin.from('profiles').select('id').eq('telegram_id', res.user.id).maybeSingle();
      if (p?.id) return { id: p.id, admin };
    }
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    return { id: user.id, admin };
  }
  return null;
}

export async function GET(req: Request) {
  const viewer = await resolveViewer(req);
  if (!viewer) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data } = await viewer.admin
    .from('notification_preferences')
    .select('offsets_minutes, enabled, quiet_hours_start, quiet_hours_end')
    .eq('profile_id', viewer.id)
    .maybeSingle();

  if (!data) {
    return NextResponse.json({
      offsets_minutes: [1440, 120],
      enabled: true,
      quiet_hours_start: null,
      quiet_hours_end: null,
    });
  }

  return NextResponse.json(data);
}

interface PutBody {
  offsets_minutes?: number[];
  enabled?: boolean;
  quiet_hours_start?: number | null;
  quiet_hours_end?: number | null;
}

export async function PUT(req: Request) {
  const viewer = await resolveViewer(req);
  if (!viewer) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as PutBody | null;
  if (!body) return NextResponse.json({ error: 'bad_request' }, { status: 400 });

  const cleanOffsets = Array.isArray(body.offsets_minutes)
    ? body.offsets_minutes
        .map((n) => Math.round(Number(n)))
        .filter((n) => Number.isFinite(n) && n > 0 && n <= 60 * 24 * 30)
        .slice(0, 10)
    : undefined;

  if (cleanOffsets && cleanOffsets.length === 0) {
    return NextResponse.json({ error: 'at_least_one_offset_required' }, { status: 400 });
  }

  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (cleanOffsets !== undefined) payload.offsets_minutes = Array.from(new Set(cleanOffsets)).sort((a, b) => b - a);
  if (typeof body.enabled === 'boolean') payload.enabled = body.enabled;
  if (body.quiet_hours_start === null || (typeof body.quiet_hours_start === 'number' && body.quiet_hours_start >= 0 && body.quiet_hours_start <= 23)) {
    payload.quiet_hours_start = body.quiet_hours_start;
  }
  if (body.quiet_hours_end === null || (typeof body.quiet_hours_end === 'number' && body.quiet_hours_end >= 0 && body.quiet_hours_end <= 23)) {
    payload.quiet_hours_end = body.quiet_hours_end;
  }

  const { error } = await viewer.admin
    .from('notification_preferences')
    .upsert({ profile_id: viewer.id, ...payload }, { onConflict: 'profile_id' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
