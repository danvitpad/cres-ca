/** --- YAML
 * name: Salon Invites — Search Existing Masters
 * description: Admin-only. Searches for masters (profiles with role='master') not already in a salon,
 *              matching email/phone/handle. Returns up to 10 candidates. Used by /settings/team
 *              to invite existing CRES-CA masters directly (mega-plan Phase 5 delta).
 * created: 2026-04-19
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { getCurrentUserRole } from '@/lib/team/roles';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: salonId } = await params;
  const role = await getCurrentUserRole(salonId);
  if (role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const q = (url.searchParams.get('q') ?? '').trim();
  if (q.length < 2) return NextResponse.json({ masters: [] });

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data, error } = await admin
    .from('masters')
    .select('id, profile_id, specialization, is_active, salon_id, profile:profiles!masters_profile_id_fkey(full_name, email, phone, avatar_url)')
    .is('salon_id', null)
    .eq('is_active', true)
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  type ProfileRow = { full_name: string | null; email: string | null; phone: string | null; avatar_url: string | null };
  type MasterRow = { id: string; profile_id: string; specialization: string | null; profile: ProfileRow | ProfileRow[] | null };

  const needle = q.toLowerCase();
  const rows = ((data as unknown) as MasterRow[] | null) ?? [];
  const normalized = rows.map((m) => {
    const p = Array.isArray(m.profile) ? (m.profile[0] ?? null) : m.profile;
    return { ...m, profile: p };
  }).filter((m) => {
    const p = m.profile;
    if (!p) return false;
    const haystack = [p.full_name, p.email, p.phone].filter(Boolean).join(' ').toLowerCase();
    return haystack.includes(needle);
  }).slice(0, 10);

  return NextResponse.json({
    masters: normalized.map((m) => ({
      id: m.id,
      profile_id: m.profile_id,
      full_name: m.profile?.full_name ?? null,
      email: m.profile?.email ?? null,
      phone: m.profile?.phone ?? null,
      avatar_url: m.profile?.avatar_url ?? null,
      specialization: m.specialization,
    })),
  });
}
