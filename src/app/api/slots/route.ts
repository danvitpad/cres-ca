/** --- YAML
 * name: Available Slots API
 * description: Returns available time slots for a master on a given date, accounting for working hours and existing appointments
 * --- */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface WorkingDay {
  start: string;
  end: string;
  break_start?: string;
  break_end?: string;
}

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

const DEFAULT_WORKING_HOURS: Record<string, WorkingDay | null> = {
  sunday: null,
  monday: { start: '10:00', end: '19:00' },
  tuesday: { start: '10:00', end: '19:00' },
  wednesday: { start: '10:00', end: '19:00' },
  thursday: { start: '10:00', end: '19:00' },
  friday: { start: '10:00', end: '19:00' },
  saturday: { start: '11:00', end: '18:00' },
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const masterId = searchParams.get('master_id');
  const date = searchParams.get('date');
  const serviceId = searchParams.get('service_id');

  if (!masterId || !date || !serviceId) {
    return NextResponse.json({ error: 'master_id, date, service_id required' }, { status: 400 });
  }

  const supabase = await createClient();

  // Fetch master working hours
  const { data: master } = await supabase
    .from('masters')
    .select('working_hours, is_busy, busy_until, long_visit_buffer_minutes, long_visit_threshold_minutes')
    .eq('id', masterId)
    .single();

  if (!master) {
    return NextResponse.json({ error: 'Master not found' }, { status: 404 });
  }

  // Busy mode — master toggled off availability (instant block)
  const busyUntil = master.busy_until ? new Date(master.busy_until as string) : null;
  const busyActive = master.is_busy && (!busyUntil || busyUntil > new Date());
  if (busyActive) {
    const today = new Date().toISOString().slice(0, 10);
    const asked = date;
    if (asked <= today && (!busyUntil || busyUntil.toISOString().slice(0, 10) >= asked)) {
      return NextResponse.json({ slots: [] });
    }
  }

  // Fetch service duration
  const { data: service } = await supabase
    .from('services')
    .select('duration_minutes')
    .eq('id', serviceId)
    .single();

  if (!service) {
    return NextResponse.json({ error: 'Service not found' }, { status: 404 });
  }

  const duration = service.duration_minutes;
  const dateObj = new Date(date + 'T00:00:00');
  const dayName = WEEKDAYS[dateObj.getDay()];
  const wh = (master.working_hours as Record<string, WorkingDay | null> | null) ?? DEFAULT_WORKING_HOURS;
  const workingHours = wh[dayName] ?? DEFAULT_WORKING_HOURS[dayName];

  if (!workingHours) {
    return NextResponse.json({ slots: [] });
  }

  // Fetch existing appointments for that date
  const dayStart = `${date}T00:00:00`;
  const dayEnd = `${date}T23:59:59`;

  const { data: appointments } = await supabase
    .from('appointments')
    .select('starts_at, ends_at, service:services(is_mobile, travel_buffer_minutes)')
    .eq('master_id', masterId)
    .gte('starts_at', dayStart)
    .lte('starts_at', dayEnd)
    .not('status', 'in', '("cancelled","no_show")');

  const bufferMin = Number((master as { long_visit_buffer_minutes: number | null }).long_visit_buffer_minutes ?? 0);
  const thresholdMin = Number((master as { long_visit_threshold_minutes: number | null }).long_visit_threshold_minutes ?? 120);

  const busySlots = ((appointments ?? []) as unknown as {
    starts_at: string;
    ends_at: string;
    service: { is_mobile: boolean | null; travel_buffer_minutes: number | null } | { is_mobile: boolean | null; travel_buffer_minutes: number | null }[] | null;
  }[]).map((a) => {
    const s = timeToMinutes(new Date(a.starts_at).toTimeString().slice(0, 5));
    const e = timeToMinutes(new Date(a.ends_at).toTimeString().slice(0, 5));
    const dur = e - s;
    const longBuf = bufferMin > 0 && dur >= thresholdMin ? bufferMin : 0;
    const svc = Array.isArray(a.service) ? a.service[0] : a.service;
    const travelBuf = svc?.is_mobile ? Number(svc.travel_buffer_minutes ?? 0) : 0;
    return { start: s, end: e + Math.max(longBuf, travelBuf) };
  });

  const { data: blocks } = await supabase
    .from('blocked_times')
    .select('starts_at, ends_at')
    .eq('master_id', masterId)
    .lte('starts_at', dayEnd)
    .gte('ends_at', dayStart);

  for (const b of blocks ?? []) {
    const bs = new Date(b.starts_at);
    const be = new Date(b.ends_at);
    const dayStartDate = new Date(dayStart);
    const dayEndDate = new Date(dayEnd);
    const clippedStart = bs < dayStartDate ? dayStartDate : bs;
    const clippedEnd = be > dayEndDate ? dayEndDate : be;
    busySlots.push({
      start: timeToMinutes(clippedStart.toTimeString().slice(0, 5)),
      end: timeToMinutes(clippedEnd.toTimeString().slice(0, 5)),
    });
  }

  // Generate slots
  const startMin = timeToMinutes(workingHours.start);
  const endMin = timeToMinutes(workingHours.end);
  const breakStart = workingHours.break_start ? timeToMinutes(workingHours.break_start) : null;
  const breakEnd = workingHours.break_end ? timeToMinutes(workingHours.break_end) : null;

  const slots: string[] = [];
  for (let t = startMin; t + duration <= endMin; t += 30) {
    // Check break overlap
    if (breakStart !== null && breakEnd !== null) {
      if (t < breakEnd && t + duration > breakStart) continue;
    }

    // Check appointment overlap
    const hasConflict = busySlots.some(
      (busy) => t < busy.end && t + duration > busy.start,
    );
    if (hasConflict) continue;

    slots.push(minutesToTime(t));
  }

  return NextResponse.json({ slots });
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60).toString().padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}
