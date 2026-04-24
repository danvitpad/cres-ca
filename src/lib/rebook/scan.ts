/** --- YAML
 * name: Rebook scanner
 * description: Daily scan — for every rebook-enabled master, find clients whose typical interval is due and create suggestions.
 *              Run via cron. Safe to run multiple times per day (idempotent via unique constraint on master+client+last_visit).
 * created: 2026-04-24
 * --- */

import type { SupabaseClient } from '@supabase/supabase-js';
import { findRebookSlots } from './find-slot';

interface ScanStats {
  mastersScanned: number;
  clientsScanned: number;
  suggestionsCreated: number;
  skippedNoCadence: number;
  skippedTooEarly: number;
  skippedNoFreeSlot: number;
  skippedDuplicate: number;
  errors: number;
}

/**
 * One full daily scan. Returns stats. Any errors on individual clients are logged and do not abort the batch.
 */
export async function scanRebookSuggestions(db: SupabaseClient): Promise<ScanStats> {
  const stats: ScanStats = {
    mastersScanned: 0,
    clientsScanned: 0,
    suggestionsCreated: 0,
    skippedNoCadence: 0,
    skippedTooEarly: 0,
    skippedNoFreeSlot: 0,
    skippedDuplicate: 0,
    errors: 0,
  };

  const { data: masters, error: mErr } = await db
    .from('masters')
    .select('id, rebook_enabled, rebook_min_interval_days, rebook_max_interval_days')
    .eq('rebook_enabled', true)
    .eq('is_active', true);

  if (mErr || !masters) {
    console.error('[rebook-scan] master query failed:', mErr?.message);
    return stats;
  }

  for (const master of masters) {
    stats.mastersScanned++;
    await scanMaster(db, master, stats);
  }

  return stats;
}

async function scanMaster(
  db: SupabaseClient,
  master: { id: string; rebook_min_interval_days: number; rebook_max_interval_days: number },
  stats: ScanStats,
): Promise<void> {
  // Active clients with at least 3 completed visits in last 12 months
  const { data: clients } = await db
    .from('clients')
    .select('id, master_id, profile_id')
    .eq('master_id', master.id)
    .is('is_blacklisted', false)
    .limit(500);

  if (!clients?.length) return;

  for (const client of clients) {
    stats.clientsScanned++;
    try {
      await scanClient(db, master, client.id, stats);
    } catch (e) {
      stats.errors++;
      console.error('[rebook-scan] client scan failed:', client.id, (e as Error).message);
    }
  }
}

async function scanClient(
  db: SupabaseClient,
  master: { id: string; rebook_min_interval_days: number; rebook_max_interval_days: number },
  clientId: string,
  stats: ScanStats,
): Promise<void> {
  // 1. Compute cadence via RPC
  const { data: cadenceRows } = await db.rpc('compute_client_visit_cadence', {
    p_master_id: master.id,
    p_client_id: clientId,
  });

  const cadence = Array.isArray(cadenceRows) ? cadenceRows[0] : cadenceRows;
  if (!cadence || !cadence.median_interval_days) {
    stats.skippedNoCadence++;
    return;
  }

  const median = cadence.median_interval_days as number;
  const lastVisit = new Date(cadence.last_visit_at as string);

  if (median < master.rebook_min_interval_days || median > master.rebook_max_interval_days) {
    stats.skippedTooEarly++;
    return;
  }

  // 2. Are we in the rebook window?
  // Send suggestion when 75% of the interval has passed (so there's time for client to respond).
  const daysSinceVisit = (Date.now() - lastVisit.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceVisit < median * 0.75) {
    stats.skippedTooEarly++;
    return;
  }
  if (daysSinceVisit > median * 1.5) {
    // Client is already very overdue — send a gentle reminder (still eligible).
  }

  // 3. Check duplicate (unique constraint on master+client+last_visit)
  const { data: existing } = await db
    .from('rebook_suggestions')
    .select('id, status')
    .eq('master_id', master.id)
    .eq('client_id', clientId)
    .eq('last_visit_at', lastVisit.toISOString())
    .maybeSingle();

  if (existing) {
    stats.skippedDuplicate++;
    return;
  }

  // 4. Find last service for default
  const { data: lastAppt } = await db
    .from('appointments')
    .select('service_id, services:services!appointments_service_id_fkey(duration_minutes)')
    .eq('master_id', master.id)
    .eq('client_id', clientId)
    .eq('status', 'completed')
    .order('starts_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!lastAppt?.service_id) return;
  const serviceId = lastAppt.service_id as string;
  const rawServices = lastAppt.services as unknown;
  const svc = Array.isArray(rawServices) ? rawServices[0] : rawServices;
  const duration = (svc?.duration_minutes as number) ?? 60;

  // 5. Desired date = lastVisit + medianDays
  const desired = new Date(lastVisit);
  desired.setDate(desired.getDate() + median);
  if (desired.getTime() < Date.now()) {
    desired.setTime(Date.now() + 24 * 60 * 60 * 1000); // at least tomorrow
  }

  // 6. Find free slots
  const slots = await findRebookSlots({
    db,
    masterId: master.id,
    desiredDate: desired,
    typicalDow: (cadence.typical_dow as number) ?? desired.getDay(),
    typicalHour: (cadence.typical_hour as number) ?? 14,
    durationMin: duration,
  });

  if (slots.length === 0) {
    stats.skippedNoFreeSlot++;
    return;
  }

  // 7. Insert suggestion
  const { error: insErr } = await db.from('rebook_suggestions').insert({
    master_id: master.id,
    client_id: clientId,
    service_id: serviceId,
    median_interval_days: median,
    last_visit_at: lastVisit.toISOString(),
    suggested_starts_at: slots[0].startsAt,
    suggested_duration_min: duration,
    alt_slots: slots.slice(1).map((s) => ({ starts_at: s.startsAt })),
    status: 'pending_master',
  });

  if (insErr) {
    if (insErr.code === '23505') {
      // Unique violation — already exists, safe to ignore
      stats.skippedDuplicate++;
    } else {
      stats.errors++;
      console.error('[rebook-scan] insert failed:', insErr.message);
    }
    return;
  }

  stats.suggestionsCreated++;
}
