/** --- YAML
 * name: Calendar Feed
 * description: ICS subscription feed for syncing appointments to external calendars
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateIcsFeed } from '@/lib/calendar/ics';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params;
  const supabase = await createClient();

  // Get future appointments for this user (as client or master)
  const now = new Date().toISOString();

  // Check if user is a master
  const { data: master } = await supabase
    .from('masters')
    .select('id, address')
    .eq('profile_id', userId)
    .single();

  let appointments;

  if (master) {
    // Master: show all their appointments
    const { data } = await supabase
      .from('appointments')
      .select('id, starts_at, ends_at, notes, service:services(name), client:clients(full_name)')
      .eq('master_id', master.id)
      .gte('starts_at', now)
      .in('status', ['confirmed', 'pending'])
      .order('starts_at')
      .limit(200);
    appointments = data;
  } else {
    // Client: show their appointments across all masters
    const { data: clientRecords } = await supabase
      .from('clients')
      .select('id')
      .eq('profile_id', userId);

    const clientIds = (clientRecords ?? []).map((c) => c.id);

    if (clientIds.length === 0) {
      return new NextResponse(generateIcsFeed([]), {
        headers: { 'Content-Type': 'text/calendar; charset=utf-8' },
      });
    }

    const { data } = await supabase
      .from('appointments')
      .select('id, starts_at, ends_at, notes, service:services(name), master:masters(address, profile:profiles!masters_profile_id_fkey(full_name))')
      .in('client_id', clientIds)
      .gte('starts_at', now)
      .in('status', ['confirmed', 'pending'])
      .order('starts_at')
      .limit(200);
    appointments = data;
  }

  const events = (appointments ?? []).map((apt) => {
    const service = apt.service as unknown as { name: string } | null;
    const client = (apt as Record<string, unknown>).client as { full_name: string } | null;
    const masterInfo = (apt as Record<string, unknown>).master as { address: string | null; profile: { full_name: string } } | null;

    const summary = master
      ? `${service?.name ?? 'Appointment'} - ${client?.full_name ?? 'Client'}`
      : `${service?.name ?? 'Appointment'} - ${masterInfo?.profile?.full_name ?? 'Master'}`;

    return {
      uid: apt.id,
      summary,
      description: apt.notes ?? undefined,
      location: master?.address ?? masterInfo?.address ?? undefined,
      dtstart: new Date(apt.starts_at),
      dtend: new Date(apt.ends_at),
    };
  });

  const ics = generateIcsFeed(events);

  return new NextResponse(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
