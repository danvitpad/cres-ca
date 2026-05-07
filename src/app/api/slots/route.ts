/** --- YAML
 * name: Available Slots API
 * description: Returns available time slots for a master on a given date,
 *              accounting for working hours (multi-interval) and existing
 *              appointments. С 2026-05-05 формат working_hours — multi-interval.
 * --- */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { normalizeWithDefault, dayKeyFromDate } from '@/lib/working-hours/normalize';

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
    .select('working_hours, is_busy, busy_until, long_visit_buffer_minutes, long_visit_threshold_minutes, profile_id, profile:profiles!masters_profile_id_fkey(deleted_at)')
    .eq('id', masterId)
    .single();

  if (!master) {
    return NextResponse.json({ error: 'Master not found' }, { status: 404 });
  }

  // Если аккаунт мастера помечен на удаление — слоты недоступны.
  const masterProfile = (master as { profile?: { deleted_at: string | null } | { deleted_at: string | null }[] | null }).profile;
  const profileDeletedAt = Array.isArray(masterProfile)
    ? masterProfile[0]?.deleted_at ?? null
    : masterProfile?.deleted_at ?? null;
  if (profileDeletedAt) {
    return NextResponse.json({ slots: [], reason: 'master_unavailable' });
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
  const wh = normalizeWithDefault(master.working_hours);
  const workingDay = wh[dayKeyFromDate(dateObj)];

  if (!workingDay.enabled || workingDay.intervals.length === 0) {
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
    .not('status', 'in', '("cancelled","cancelled_by_client","cancelled_by_master","no_show")');

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

  // For today, mark slots that already started as disabled. Раньше скрывали —
  // пользователь не понимал куда делось «10:00» когда смотрит расписание днём.
  // Теперь возвращаем прошедшие слоты в `pastSlots`, клиент рисует их серыми
  // и не даёт нажать. 5-минутный буфер — чтобы не успел нажать «через минуту».
  // Считаем по локальному времени Киева (UA-проект), не зависим от UTC сервера.
  const kyivNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Kiev' }));
  const kyivTodayStr = `${kyivNow.getFullYear()}-${String(kyivNow.getMonth() + 1).padStart(2, '0')}-${String(kyivNow.getDate()).padStart(2, '0')}`;
  const isToday = date === kyivTodayStr;
  const nowMin = isToday ? kyivNow.getHours() * 60 + kyivNow.getMinutes() : -1;

  // Multi-interval: шаг = длительность услуги (минимум 15 мин). Так слоты
  // не пересекаются между собой, и клиент видит чёткие непересекающиеся
  // варианты. Услуга 30 мин → шаг 30; 45 мин → 45; 90 мин → 90.
  // ВАЖНО: слот включается в `slots` только если start + duration ≤ end_of_interval.
  // То есть 2.5-часовая услуга в окне 9:30–12:30 даёт стартовые точки
  // 9:30, 9:45, 10:00 (10:00 + 150 = 12:30 = граница, попадает).
  //
  // 4 категории на ответ:
  //   slots         — свободно, клиент может выбрать
  //   pastSlots     — уже прошло (только для текущего дня)
  //   bookedSlots   — пересекается с другой записью / блокировкой
  //   tooShortSlots — слот в рабочем окне, но услуга в него не помещается
  //                   (пример: окно 10-13, услуга 90 мин → 12:00 не помещается).
  //                   UI рисует серым «как нерабочее время».
  const slots: string[] = [];
  const pastSlots: string[] = [];
  const bookedSlots: string[] = [];
  const tooShortSlots: string[] = [];

  const step = Math.max(15, duration);

  for (const iv of workingDay.intervals) {
    const startMin = timeToMinutes(iv.start);
    const endMin = timeToMinutes(iv.end);
    // Идём до КОНЦА интервала (не до endMin - duration), чтобы захватить также
    // слоты внутри окна, в которые услуга не помещается, и пометить их.
    for (let t = startMin; t < endMin; t += step) {
      const time = minutesToTime(t);

      // Past-time приоритетнее всего — клиент должен видеть «эта дата прошла»
      if (isToday && t <= nowMin + 5) {
        pastSlots.push(time);
        continue;
      }

      // Не помещается в рабочее окно
      if (t + duration > endMin) {
        tooShortSlots.push(time);
        continue;
      }

      // Booked by another client
      const hasConflict = busySlots.some(
        (busy) => t < busy.end && t + duration > busy.start,
      );
      if (hasConflict) {
        bookedSlots.push(time);
        continue;
      }

      slots.push(time);
    }
  }

  return NextResponse.json({ slots, pastSlots, bookedSlots, tooShortSlots });
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
