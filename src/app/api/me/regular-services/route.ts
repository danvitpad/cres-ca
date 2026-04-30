/** --- YAML
 * name: Regular Services for Client
 * description: GET → returns up to 5 master×service pairs where the current
 *              client has ≥3 completed visits. Used by client home widget
 *              "Твои постоянные" — one-tap rebook.
 * created: 2026-04-30
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ items: [] });

  const { data, error } = await supabase.rpc('get_regular_services_for_client', { p_profile_id: user.id });
  if (error) return NextResponse.json({ items: [] });

  return NextResponse.json({ items: data ?? [] });
}
