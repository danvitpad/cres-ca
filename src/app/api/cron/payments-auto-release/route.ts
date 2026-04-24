/** --- YAML
 * name: Payments auto-release cron
 * description: Hourly — finds payment_intents in 'held' state tied to a completed appointment
 *              where (auto_release_hours) passed since ends_at. Releases them to master;
 *              records platform commission. Also captures deposits from no_show appointments.
 * created: 2026-04-24
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { release, capture, getAutoReleaseHours } from '@/lib/payments/escrow';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const db = admin();
  const autoReleaseHours = await getAutoReleaseHours(db);
  const cutoff = new Date(Date.now() - autoReleaseHours * 60 * 60 * 1000).toISOString();

  const { data: heldIntents } = await db
    .from('payment_intents')
    .select('id, appointment_id, status, ' +
      'appointments:appointment_id!payment_intents_appointment_id_fkey(status, ends_at)')
    .eq('status', 'held')
    .limit(200);

  if (!heldIntents?.length) {
    return NextResponse.json({ ok: true, released: 0, captured: 0 });
  }

  type Loaded = {
    id: string;
    appointment_id: string | null;
    status: string;
    appointments: { status: string; ends_at: string } | null;
  };

  let released = 0;
  let captured = 0;
  let skipped = 0;

  for (const row of heldIntents as unknown as Loaded[]) {
    const appt = row.appointments;
    if (!appt) {
      skipped++;
      continue;
    }

    // Completed + enough time passed → release to master
    if (appt.status === 'completed' && appt.ends_at < cutoff) {
      const ok = await release(db, row.id);
      if (ok) released++;
      continue;
    }

    // No-show → capture (master keeps deposit)
    if (appt.status === 'no_show') {
      const ok = await capture(db, row.id);
      if (ok) captured++;
      continue;
    }

    skipped++;
  }

  console.log('[payments-auto-release]', { released, captured, skipped, total: heldIntents.length });
  return NextResponse.json({ ok: true, released, captured, skipped, total: heldIntents.length });
}
