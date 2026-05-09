/** --- YAML
 * name: Appointment ICS export
 * description: >
 *   GET /api/appointments/[id]/ics — generates a .ics calendar file for a
 *   single appointment. Auth via X-TG-Init-Data or Supabase cookie session.
 *   Returns iCalendar data the OS can open directly in Calendar/Google Calendar.
 * created: 2026-05-09
 * --- */

import { NextResponse } from 'next/server';
import { resolveUserId } from '@/lib/auth/resolve-user';
import { createClient } from '@/lib/supabase/server';

function icsDate(iso: string): string {
  // FORMAT: 20260509T140000Z
  return iso.replace(/[-:]/g, '').replace(/\.\d+/, '').replace('T', 'T').replace('Z', 'Z');
}

function escapeIcs(str: string): string {
  return str.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await resolveUserId(req);
  if (!userId) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const db = await createClient();
  const { data: apt } = await db
    .from('appointments')
    .select(`
      id, starts_at, ends_at, status,
      service:services(name),
      master:masters(
        display_name,
        address,
        city,
        profile:profiles!masters_profile_id_fkey(full_name)
      )
    `)
    .eq('id', id)
    .eq('client_id', userId)
    .maybeSingle();

  if (!apt) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const row = apt as unknown as {
    id: string;
    starts_at: string;
    ends_at: string;
    status: string;
    service: { name: string } | null;
    master: {
      display_name: string | null;
      address: string | null;
      city: string | null;
      profile: { full_name: string | null } | null;
    } | null;
  };

  const masterName = row.master?.display_name ?? row.master?.profile?.full_name ?? 'Master';
  const serviceName = row.service?.name ?? 'Appointment';
  const location = [row.master?.address, row.master?.city].filter(Boolean).join(', ');
  const uid = `${row.id}@cres-ca.com`;
  const dtstamp = icsDate(new Date().toISOString());
  const dtstart = icsDate(row.starts_at);
  const dtend = icsDate(row.ends_at);
  const summary = `${serviceName} — ${masterName}`;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CRES-CA//Booking//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${dtstart}`,
    `DTEND:${dtend}`,
    `SUMMARY:${escapeIcs(summary)}`,
    ...(location ? [`LOCATION:${escapeIcs(location)}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  return new Response(lines.join('\r\n'), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="booking-${row.id}.ics"`,
      'Cache-Control': 'no-store',
    },
  });
}
