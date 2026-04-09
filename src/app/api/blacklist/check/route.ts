/** --- YAML
 * name: Blacklist Check API
 * description: Server-side check for problematic client behavior across all masters
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { profile_id } = await request.json();
  if (!profile_id) {
    return NextResponse.json({ error: 'profile_id required' }, { status: 400 });
  }

  // Aggregate cancellation_count + no_show_count across ALL client records for this profile
  const { data: clientRecords } = await supabase
    .from('clients')
    .select('cancellation_count, no_show_count')
    .eq('profile_id', profile_id);

  if (!clientRecords || clientRecords.length === 0) {
    return NextResponse.json({ warning: false, total: 0 });
  }

  const total = clientRecords.reduce(
    (sum, c) => sum + (c.cancellation_count ?? 0) + (c.no_show_count ?? 0),
    0,
  );

  const warning = total >= 3;

  return NextResponse.json({ warning, total });
}
