/** --- YAML
 * name: GDPR Purge Clients Cron
 * description: Daily cron — hard-deletes клиентов, у которых deleted_at старше 30 дней (GDPR right to erasure).
 * created: 2026-04-13
 * updated: 2026-04-13
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = await createClient();
  const cutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();

  const { data: toDelete } = await supabase
    .from('clients')
    .select('id')
    .not('deleted_at', 'is', null)
    .lt('deleted_at', cutoff);

  const ids = (toDelete ?? []).map((c) => c.id);
  if (!ids.length) return NextResponse.json({ purged: 0 });

  const { error } = await supabase.from('clients').delete().in('id', ids);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ purged: ids.length });
}
