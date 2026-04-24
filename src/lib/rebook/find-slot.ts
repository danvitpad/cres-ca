/** --- YAML
 * name: Rebook slot finder
 * description: Given a master, typical dow/hour, and desired duration — find the earliest free slot
 *              in the 1-2 weeks around the expected next-visit date. Respects master's existing appointments.
 * created: 2026-04-24
 * --- */

import type { SupabaseClient } from '@supabase/supabase-js';

interface FindSlotParams {
  db: SupabaseClient;
  masterId: string;
  desiredDate: Date;         // the "ideal" date based on cadence
  typicalDow: number;        // 0=Sun..6=Sat
  typicalHour: number;       // 0..23
  durationMin: number;
  windowDays?: number;       // how far to scan around desiredDate (default 14 → ±7 days)
}

interface SlotCandidate {
  startsAt: string;          // ISO
  /** distance in days from desiredDate (0 = exact match) */
  distance: number;
  /** 0 = same DOW and same hour, 1 = same DOW only, 2 = different DOW */
  typicality: number;
}

/**
 * Returns up to 3 candidate slots ordered by:
 *   1. typicality (same dow+hour > same dow > different)
 *   2. abs distance from desiredDate
 *
 * Uses the DB function `is_slot_free` for conflict detection.
 */
export async function findRebookSlots({
  db,
  masterId,
  desiredDate,
  typicalDow,
  typicalHour,
  durationMin,
  windowDays = 14,
}: FindSlotParams): Promise<SlotCandidate[]> {
  const candidates: SlotCandidate[] = [];
  const halfWindow = Math.floor(windowDays / 2);

  // Try day by day: desiredDate, ±1, ±2, ..., ±halfWindow
  for (let delta = 0; delta <= halfWindow; delta++) {
    for (const sign of delta === 0 ? [0] : [1, -1]) {
      const probe = new Date(desiredDate);
      probe.setDate(probe.getDate() + sign * delta);

      // Skip past dates
      if (probe.getTime() < Date.now()) continue;

      const probeDow = probe.getDay();
      // For non-typical days, still try — but mark low typicality.
      const dowMatch = probeDow === typicalDow;

      // Try typical hour first, then ±1 hour
      for (const hourOffset of [0, 1, -1, 2, -2]) {
        const hour = typicalHour + hourOffset;
        if (hour < 8 || hour > 21) continue;  // plausible working hours

        const starts = new Date(probe);
        starts.setHours(hour, 0, 0, 0);

        // Skip past times within today
        if (starts.getTime() < Date.now() + 60 * 60 * 1000) continue;

        const { data: isFree } = await db.rpc('is_slot_free', {
          p_master_id: masterId,
          p_starts_at: starts.toISOString(),
          p_duration_min: durationMin,
        });

        if (!isFree) continue;

        const typicality = dowMatch && hourOffset === 0 ? 0 : dowMatch ? 1 : 2;
        candidates.push({
          startsAt: starts.toISOString(),
          distance: delta,
          typicality,
        });

        if (candidates.length >= 6) break;
      }
      if (candidates.length >= 6) break;
    }
    if (candidates.length >= 6) break;
  }

  // Sort: typicality asc, distance asc, then chronological
  candidates.sort((a, b) => {
    if (a.typicality !== b.typicality) return a.typicality - b.typicality;
    if (a.distance !== b.distance) return a.distance - b.distance;
    return new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
  });

  return candidates.slice(0, 3);
}
