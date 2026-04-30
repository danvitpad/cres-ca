/** --- YAML
 * name: Superadmin Complaints
 * description: List of all complaints (open / in_progress / closed) with status
 *              actions. Server-side fetch via service role; status updates via
 *              POST /api/superadmin/complaints/[id]/status.
 * created: 2026-04-30
 * --- */

import { createClient as createAdminClient } from '@supabase/supabase-js';
import { ComplaintsClient } from '@/components/superadmin/complaints-client';

interface ComplaintRow {
  id: string;
  reporter_id: string;
  master_id: string;
  appointment_id: string | null;
  reason_code: string;
  description: string;
  status: 'open' | 'in_progress' | 'closed';
  resolution_note: string | null;
  closed_at: string | null;
  created_at: string;
  reporter_name: string | null;
  reporter_email: string | null;
  master_name: string | null;
  master_email: string | null;
}

export default async function SuperadminComplaintsPage() {
  const db = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  // 1) Все жалобы
  const { data: rawComplaints } = await db
    .from('complaints')
    .select('id, reporter_id, master_id, appointment_id, reason_code, description, status, resolution_note, closed_at, created_at')
    .order('created_at', { ascending: false })
    .limit(200);

  const complaints = (rawComplaints ?? []) as Array<Omit<ComplaintRow, 'reporter_name' | 'reporter_email' | 'master_name' | 'master_email'>>;

  // 2) Профили reporter'ов и мастеров — одним батчем
  const reporterIds = [...new Set(complaints.map(c => c.reporter_id))];
  const masterIds = [...new Set(complaints.map(c => c.master_id))];

  const [{ data: reporters }, { data: masters }] = await Promise.all([
    reporterIds.length
      ? db.from('profiles').select('id, full_name, email').in('id', reporterIds)
      : Promise.resolve({ data: [] as Array<{ id: string; full_name: string | null; email: string | null }> }),
    masterIds.length
      ? db.from('masters').select('id, profile_id').in('id', masterIds)
      : Promise.resolve({ data: [] as Array<{ id: string; profile_id: string }> }),
  ]);

  const masterProfileIds = (masters as Array<{ id: string; profile_id: string }>).map(m => m.profile_id);
  const { data: masterProfiles } = masterProfileIds.length
    ? await db.from('profiles').select('id, full_name, email').in('id', masterProfileIds)
    : { data: [] as Array<{ id: string; full_name: string | null; email: string | null }> };

  const reporterById = new Map((reporters ?? []).map(p => [p.id, p]));
  const masterRecordById = new Map((masters ?? []).map(m => [m.id, m]));
  const profileById = new Map((masterProfiles ?? []).map(p => [p.id, p]));

  const enriched: ComplaintRow[] = complaints.map(c => {
    const reporter = reporterById.get(c.reporter_id);
    const masterRec = masterRecordById.get(c.master_id);
    const masterProfile = masterRec ? profileById.get(masterRec.profile_id) : undefined;
    return {
      ...c,
      reporter_name: reporter?.full_name ?? null,
      reporter_email: reporter?.email ?? null,
      master_name: masterProfile?.full_name ?? null,
      master_email: masterProfile?.email ?? null,
    };
  });

  return (
    <div className="p-6">
      <div className="mb-4">
        <h1 className="text-[20px] font-semibold tracking-tight text-white">Жалобы пользователей</h1>
        <p className="mt-1 text-[12px] text-white/55">
          Жалобы клиентов на мастеров и записи. Сюда летят кнопки «Пожаловаться» из карточек записей.
        </p>
      </div>
      <ComplaintsClient rows={enriched} />
    </div>
  );
}
