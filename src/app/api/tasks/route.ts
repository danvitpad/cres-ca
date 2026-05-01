/** --- YAML
 * name: Tasks API (list + create)
 * description: Personal & team todo list. GET returns the caller's tasks
 *              (their own + assigned to them + tasks of salons they admin).
 *              POST creates a new task with optional remind_at; if remind_at
 *              has not yet passed, the cron `/api/cron/master-tasks` will fire
 *              it within ~1 minute of the target.
 * created: 2026-05-01
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const url = new URL(request.url);
  const status = url.searchParams.get('status'); // pending | fired | completed | all
  const salonId = url.searchParams.get('salon_id');

  let query = supabase
    .from('master_tasks')
    .select('id, master_id, salon_id, created_by, assigned_to, title, description, remind_at, channels, status, fired_at, completed_at, client_id, appointment_id, created_at')
    .order('remind_at', { ascending: true })
    .limit(200);

  if (salonId) query = query.eq('salon_id', salonId);
  if (status && status !== 'all') query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ tasks: data ?? [] });
}

interface CreateBody {
  title: string;
  description?: string;
  remind_at: string;          // ISO timestamp
  channels?: string[];        // default ['telegram']
  master_id?: string | null;  // owner of the task (master)
  salon_id?: string | null;   // owner of the task (salon — admin tasks)
  assigned_to?: string | null; // recipient (defaults to caller's profile_id)
  client_id?: string | null;
  appointment_id?: string | null;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: CreateBody;
  try {
    body = await request.json() as CreateBody;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const title = (body.title ?? '').trim();
  if (!title) return NextResponse.json({ error: 'title_required' }, { status: 400 });
  if (title.length > 200) return NextResponse.json({ error: 'title_too_long' }, { status: 400 });

  const remindAt = body.remind_at ? new Date(body.remind_at) : null;
  if (!remindAt || isNaN(remindAt.getTime())) {
    return NextResponse.json({ error: 'invalid_remind_at' }, { status: 400 });
  }

  const description = body.description?.trim().slice(0, 2000) || null;
  const channels = (body.channels && body.channels.length > 0)
    ? body.channels.filter((c) => ['telegram', 'email', 'inapp'].includes(c))
    : ['telegram'];

  // Resolve master_id/salon_id when not provided: try to auto-link to caller's master row.
  let masterId = body.master_id ?? null;
  let salonId = body.salon_id ?? null;

  if (!masterId && !salonId) {
    // Try to find caller's master row (solo or salon master)
    const { data: m } = await supabase
      .from('masters')
      .select('id, salon_id')
      .eq('profile_id', user.id)
      .maybeSingle();
    if (m?.id) {
      masterId = m.id as string;
      if (m.salon_id) salonId = m.salon_id as string;
    }
  }

  if (!masterId && !salonId) {
    return NextResponse.json({ error: 'no_master_or_salon' }, { status: 400 });
  }

  const assignedTo = body.assigned_to ?? user.id;

  const { data, error } = await supabase
    .from('master_tasks')
    .insert({
      title,
      description,
      remind_at: remindAt.toISOString(),
      channels,
      master_id: masterId,
      salon_id: salonId,
      created_by: user.id,
      assigned_to: assignedTo,
      client_id: body.client_id ?? null,
      appointment_id: body.appointment_id ?? null,
      status: 'pending',
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ task: data });
}
