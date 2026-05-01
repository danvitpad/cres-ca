/** --- YAML
 * name: Master Tasks Reminder Cron
 * description: Runs every minute via cron-job.org. Finds master_tasks where
 *              status='pending' AND remind_at <= now(), enqueues a TG/email/
 *              inapp notification to the assignee (defaults to creator), and
 *              marks the task as `fired`. The actual delivery is performed by
 *              the `/api/cron/notifications` worker (also every minute) using
 *              the same notifications table.
 * created: 2026-05-01
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  channels: string[];
  remind_at: string;
  assigned_to: string | null;
  created_by: string;
  client_id: string | null;
  appointment_id: string | null;
  master_id: string | null;
  salon_id: string | null;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Service-role client — bypass RLS so the cron can SELECT pending tasks
  // and UPDATE their status regardless of who created them.
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const now = new Date();

  // Pull up to 200 due tasks. Cron runs every minute, so unless we get a huge
  // backlog this batch should always drain.
  const { data: due } = await supabase
    .from('master_tasks')
    .select('id, title, description, channels, remind_at, assigned_to, created_by, client_id, appointment_id, master_id, salon_id')
    .eq('status', 'pending')
    .lte('remind_at', now.toISOString())
    .order('remind_at', { ascending: true })
    .limit(200);

  if (!due?.length) return NextResponse.json({ fired: 0 });

  let fired = 0;

  for (const t of (due as TaskRow[])) {
    const recipient = t.assigned_to ?? t.created_by;
    const channels = (t.channels && t.channels.length > 0) ? t.channels : ['telegram'];

    const title = `📌 ${t.title}`;
    const body = t.description?.trim() ? t.description.trim() : 'Напоминание';

    // Insert one notification per channel (most often just telegram).
    for (const channel of channels) {
      await supabase.from('notifications').insert({
        profile_id: recipient,
        channel,
        title,
        body,
        scheduled_for: now.toISOString(),
        data: {
          kind: 'master_task',
          task_id: t.id,
          master_id: t.master_id,
          salon_id: t.salon_id,
          client_id: t.client_id,
          appointment_id: t.appointment_id,
        },
      });
    }

    // Mark the task as fired so the cron doesn't re-fire it next minute.
    await supabase
      .from('master_tasks')
      .update({ status: 'fired', fired_at: now.toISOString() })
      .eq('id', t.id);

    fired++;
  }

  return NextResponse.json({ fired });
}
