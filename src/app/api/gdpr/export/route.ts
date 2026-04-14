/** --- YAML
 * name: GDPR Client Export
 * description: Мастер запрашивает полный export данных клиента (JSON) — GDPR-compliant. Возвращает клиент + все визиты + photos + reviews + notes + consent history.
 * created: 2026-04-13
 * updated: 2026-04-13
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const clientId = url.searchParams.get('client_id');
  if (!clientId) {
    return NextResponse.json({ error: 'client_id required' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: master } = await supabase
    .from('masters')
    .select('id')
    .eq('profile_id', user.id)
    .single();
  if (!master) return NextResponse.json({ error: 'Not a master' }, { status: 403 });

  const { data: client, error: cErr } = await supabase
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .eq('master_id', master.id)
    .single();
  if (cErr || !client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  }

  const [appointments, healthProfile, files, beforeAfter, auditLog] = await Promise.all([
    supabase
      .from('appointments')
      .select('*, services(name)')
      .eq('client_id', clientId),
    supabase
      .from('client_health_profiles')
      .select('*')
      .eq('client_id', clientId),
    supabase
      .from('client_files')
      .select('*')
      .eq('client_id', clientId),
    supabase
      .from('before_after_photos')
      .select('*')
      .eq('client_id', clientId),
    supabase
      .from('client_audit_log')
      .select('*')
      .eq('client_id', clientId),
  ]);
  const aptIds = (appointments.data ?? []).map((a) => a.id);
  const reviews = aptIds.length
    ? await supabase.from('reviews').select('*').in('appointment_id', aptIds)
    : { data: [] };

  const payload = {
    exported_at: new Date().toISOString(),
    exported_by_master_id: master.id,
    client,
    appointments: appointments.data ?? [],
    health_profile: healthProfile.data ?? [],
    files: files.data ?? [],
    before_after_photos: beforeAfter.data ?? [],
    reviews: reviews.data ?? [],
    audit_log: auditLog.data ?? [],
    gdpr_notice:
      'This file contains all personal data held for the client. Under GDPR, the subject has the right to receive this data in a portable format and to request erasure.',
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'content-disposition': `attachment; filename="gdpr-export-${clientId}.json"`,
    },
  });
}
