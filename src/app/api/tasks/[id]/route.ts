/** --- YAML
 * name: Task detail API (update + delete)
 * description: PATCH updates status (mark complete / cancel), reschedule remind_at,
 *              edit title/description. DELETE removes a task entirely.
 * created: 2026-05-01
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface PatchBody {
  title?: string;
  description?: string | null;
  remind_at?: string;
  status?: 'pending' | 'fired' | 'completed' | 'cancelled';
  channels?: string[];
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: PatchBody;
  try { body = await request.json() as PatchBody; } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

  const update: Record<string, unknown> = {};
  if (body.title !== undefined) {
    const t = body.title.trim();
    if (!t || t.length > 200) return NextResponse.json({ error: 'invalid_title' }, { status: 400 });
    update.title = t;
  }
  if (body.description !== undefined) {
    update.description = body.description ? body.description.trim().slice(0, 2000) : null;
  }
  if (body.remind_at !== undefined) {
    const d = new Date(body.remind_at);
    if (isNaN(d.getTime())) return NextResponse.json({ error: 'invalid_remind_at' }, { status: 400 });
    update.remind_at = d.toISOString();
  }
  if (body.channels !== undefined) {
    update.channels = body.channels.filter((c) => ['telegram', 'email', 'inapp'].includes(c));
    if ((update.channels as string[]).length === 0) update.channels = ['telegram'];
  }
  if (body.status !== undefined) {
    update.status = body.status;
    if (body.status === 'completed') update.completed_at = new Date().toISOString();
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'nothing_to_update' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('master_tasks')
    .update(update)
    .eq('id', id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ task: data });
}

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { error } = await supabase.from('master_tasks').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
