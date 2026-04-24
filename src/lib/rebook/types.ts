/** --- YAML
 * name: Rebook types
 * description: Shared types for rebook suggestion pipeline.
 * created: 2026-04-24
 * --- */

export type RebookStatus =
  | 'pending_master'
  | 'dismissed_master'
  | 'sent_client'
  | 'accepted'
  | 'declined'
  | 'stale'
  | 'expired';

export interface RebookSuggestion {
  id: string;
  masterId: string;
  clientId: string;
  serviceId: string | null;
  medianIntervalDays: number;
  lastVisitAt: string;
  suggestedStartsAt: string;
  suggestedDurationMin: number;
  altSlots: Array<{ starts_at: string }>;
  status: RebookStatus;
  appointmentId: string | null;
  createdAt: string;
  approvedByMasterAt: string | null;
  sentToClientAt: string | null;
  clientRespondedAt: string | null;
}

export interface CadenceResult {
  medianIntervalDays: number;
  visitsCount: number;
  lastVisitAt: string;
  typicalDow: number;   // 0=Sun .. 6=Sat
  typicalHour: number;  // 0..23
}
