/** --- YAML
 * name: Superadmin verification data
 * description: List verification_requests for review with profile join.
 * created: 2026-04-24
 * --- */

import { createClient as createAdminClient } from '@supabase/supabase-js';

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export interface VerificationRow {
  id: string;
  profileId: string;
  profileName: string;
  profileEmail: string | null;
  kind: 'identity' | 'expertise';
  status: 'pending' | 'approved' | 'rejected';
  note: string | null;
  rejectionReason: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

export async function listVerificationRequests(status: 'pending' | 'all' = 'pending'): Promise<VerificationRow[]> {
  const db = admin();
  let q = db
    .from('verification_requests')
    .select('id, profile_id, kind, status, note, rejection_reason, created_at, reviewed_at, ' +
      'profiles:profile_id(full_name, email)')
    .order('created_at', { ascending: false })
    .limit(100);
  if (status === 'pending') q = q.eq('status', 'pending');

  const { data } = await q;
  type Row = {
    id: string;
    profile_id: string;
    kind: 'identity' | 'expertise';
    status: 'pending' | 'approved' | 'rejected';
    note: string | null;
    rejection_reason: string | null;
    created_at: string;
    reviewed_at: string | null;
    profiles: { full_name: string | null; email: string | null } | null;
  };

  return ((data ?? []) as unknown as Row[]).map((r) => ({
    id: r.id,
    profileId: r.profile_id,
    profileName: r.profiles?.full_name ?? 'Без имени',
    profileEmail: r.profiles?.email ?? null,
    kind: r.kind,
    status: r.status,
    note: r.note,
    rejectionReason: r.rejection_reason,
    createdAt: r.created_at,
    reviewedAt: r.reviewed_at,
  }));
}
