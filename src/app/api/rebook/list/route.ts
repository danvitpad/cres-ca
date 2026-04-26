/** --- YAML
 * name: List rebook suggestions (master, authenticated)
 * description: GET — returns pending_master suggestions for the authenticated master's dashboard widget.
 * created: 2026-04-24
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { listRebookForMaster } from '@/lib/rebook/list-for-master';


export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: master } = await supabase
    .from('masters')
    .select('id')
    .eq('profile_id', user.id)
    .maybeSingle();

  if (!master) return NextResponse.json({ items: [] });

  const items = await listRebookForMaster(supabase, master.id);
  return NextResponse.json({ items });
}
