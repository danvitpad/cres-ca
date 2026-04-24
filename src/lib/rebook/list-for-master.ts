/** --- YAML
 * name: List rebook suggestions for master
 * description: Server-side helper: fetch pending_master rebook suggestions for a given master,
 *              enriched with client + service names for dashboard display.
 * created: 2026-04-24
 * --- */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { RebookCardData } from '@/components/rebook/rebook-panel';

export async function listRebookForMaster(db: SupabaseClient, masterId: string): Promise<RebookCardData[]> {
  const { data, error } = await db
    .from('rebook_suggestions')
    .select(
      'id, suggested_starts_at, alt_slots, median_interval_days, last_visit_at, ' +
      'clients:client_id!rebook_suggestions_client_id_fkey(full_name, profile_id, profiles:profile_id(telegram_id)), ' +
      'services:service_id!rebook_suggestions_service_id_fkey(name)',
    )
    .eq('master_id', masterId)
    .eq('status', 'pending_master')
    .order('suggested_starts_at', { ascending: true })
    .limit(20);

  if (error || !data) return [];

  type Row = {
    id: string;
    suggested_starts_at: string;
    alt_slots: Array<{ starts_at: string }>;
    median_interval_days: number;
    last_visit_at: string;
    clients: { full_name: string; profile_id: string | null; profiles: { telegram_id: number | null } | null } | null;
    services: { name: string } | null;
  };

  return (data as unknown as Row[]).map((r) => ({
    id: r.id,
    clientName: r.clients?.full_name ?? 'Клиент',
    serviceName: r.services?.name ?? 'услуга',
    suggestedStartsAt: r.suggested_starts_at,
    altSlots: r.alt_slots ?? [],
    medianIntervalDays: r.median_interval_days,
    lastVisitAt: r.last_visit_at,
    clientHasTelegram: !!r.clients?.profiles?.telegram_id,
  }));
}
