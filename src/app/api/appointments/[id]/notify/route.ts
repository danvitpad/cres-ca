/** --- YAML
 * name: Appointment Notify
 * description: POST {triggeredBy:'master'|'client'} → sends in-app + TG notifications
 *              after appointment creation. Master creates → notifies client.
 *              Client creates → notifies master + confirms to client.
 * created: 2026-04-30
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { notifyUser } from '@/lib/notifications/notify';

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: appointmentId } = await params;
  const body = (await req.json().catch(() => ({}))) as { triggeredBy?: 'master' | 'client' };
  const { triggeredBy = 'client' } = body;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const adm = admin();

  const { data: apt } = await adm
    .from('appointments')
    .select('id, starts_at, master_id, client_id, service_id')
    .eq('id', appointmentId)
    .maybeSingle();

  if (!apt) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  // Verify caller is master or client of this appointment
  const [{ data: masterRow }, { data: clientRow }] = await Promise.all([
    adm.from('masters').select('profile_id, display_name').eq('id', apt.master_id).maybeSingle(),
    adm.from('clients').select('profile_id, full_name').eq('id', apt.client_id).maybeSingle(),
  ]);

  const masterProfileId = (masterRow as { profile_id: string } | null)?.profile_id ?? null;
  const clientProfileId = (clientRow as { profile_id: string | null } | null)?.profile_id ?? null;

  const isCallerMaster = masterProfileId === user.id;
  const isCallerClient = clientProfileId === user.id;
  if (!isCallerMaster && !isCallerClient) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { data: service } = await adm
    .from('services')
    .select('name')
    .eq('id', apt.service_id)
    .maybeSingle();

  const serviceName = (service as { name?: string } | null)?.name || 'Услуга';
  const clientName = (clientRow as { full_name?: string } | null)?.full_name || 'Клиент';
  const masterName = (masterRow as { display_name?: string } | null)?.display_name || 'Мастер';

  const startsAt = new Date(apt.starts_at as string);
  const dateStr = startsAt.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  const timeStr = startsAt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', hour12: false });

  const jobs: Promise<void>[] = [];

  if (triggeredBy === 'master') {
    if (clientProfileId) {
      jobs.push(notifyUser(adm, {
        profileId: clientProfileId,
        title: 'Запись подтверждена',
        body: `${serviceName} у ${masterName}, ${dateStr} в ${timeStr}`,
        data: { type: 'appointment_created', appointment_id: appointmentId },
        deepLinkPath: '/telegram/app/activity',
        deepLinkLabel: 'Мои записи',
      }));
    }
  } else {
    if (masterProfileId) {
      jobs.push(notifyUser(adm, {
        profileId: masterProfileId,
        title: 'Новая запись',
        body: `${clientName} на ${serviceName}, ${dateStr} в ${timeStr}`,
        data: { type: 'new_appointment', appointment_id: appointmentId },
        deepLinkPath: '/telegram/m/home',
        deepLinkLabel: 'Открыть кабинет',
      }));
    }
    if (clientProfileId) {
      jobs.push(notifyUser(adm, {
        profileId: clientProfileId,
        title: 'Запись подтверждена',
        body: `${serviceName} у ${masterName}, ${dateStr} в ${timeStr}`,
        data: { type: 'appointment_created', appointment_id: appointmentId },
        deepLinkPath: '/telegram/app/activity',
        deepLinkLabel: 'Мои записи',
      }));
    }
  }

  await Promise.allSettled(jobs);

  return NextResponse.json({ ok: true });
}
