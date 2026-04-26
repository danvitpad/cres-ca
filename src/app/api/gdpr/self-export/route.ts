/** --- YAML
 * name: GDPR Client Self Export
 * description: Клиент скачивает свои данные (GDPR art. 20): profile + все visits у всех мастеров + bonus_balance per-master + consent forms + notifications. Возвращает JSON.
 * created: 2026-04-14
 * updated: 2026-04-14
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';


export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [profile, clientRows, consentForms, notifications, reviews] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
    supabase.from('clients').select('*').eq('profile_id', user.id),
    supabase.from('consent_forms').select('*').eq('client_profile_id', user.id),
    supabase.from('notifications').select('id, title, body, created_at, status').eq('profile_id', user.id),
    supabase.from('reviews').select('*').eq('client_profile_id', user.id),
  ]);

  const clientIds = (clientRows.data ?? []).map((c) => c.id as string);
  const appts = clientIds.length
    ? await supabase
        .from('appointments')
        .select('id, starts_at, ends_at, status, price, currency, tip_amount, master_id, service_id, cancellation_reason, created_at, services(name)')
        .in('client_id', clientIds)
        .order('starts_at', { ascending: false })
    : { data: [] };

  const payload = {
    exported_at: new Date().toISOString(),
    profile: profile.data,
    client_records: clientRows.data ?? [],
    appointments: appts.data ?? [],
    consent_forms: consentForms.data ?? [],
    notifications: notifications.data ?? [],
    reviews: reviews.data ?? [],
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="cres-ca-export-${user.id.slice(0, 8)}.json"`,
    },
  });
}
