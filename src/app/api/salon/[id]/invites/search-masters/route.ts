/** --- YAML
 * name: Salon Invites — Search Existing Masters
 * description: Admin-only. Searches for masters (profiles with role='master') not already in a salon,
 *              matching email/phone/handle. Returns up to 10 candidates. Used by /settings/team
 *              to invite existing CRES-CA masters directly (mega-plan Phase 5 delta).
 * created: 2026-04-19
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserRole } from '@/lib/team/roles';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: salonId } = await params;
  const role = await getCurrentUserRole(salonId);
  if (role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const supabase = await createClient();
  const url = new URL(req.url);
  const q = (url.searchParams.get('q') ?? '').trim();
  if (q.length < 2) return NextResponse.json({ masters: [] });

  // SQL-функция search_unaffiliated_masters делает ILIKE по profiles.full_name /
  // email / phone (с очисткой пробелов и нецифр в телефоне). Старая JS-фильтрация
  // ломалась из-за тонкостей PostgREST-embed.
  const { data, error } = await supabase.rpc('search_unaffiliated_masters', {
    p_query: q,
    p_limit: 10,
  });

  if (error) return NextResponse.json({ error: error.message, masters: [] }, { status: 500 });

  type Row = {
    master_id: string;
    profile_id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
    avatar_url: string | null;
    specialization: string | null;
  };
  const rows = ((data as unknown) as Row[] | null) ?? [];
  return NextResponse.json({
    masters: rows.map((r) => ({
      id: r.master_id,
      profile_id: r.profile_id,
      full_name: r.full_name,
      email: r.email,
      phone: r.phone,
      avatar_url: r.avatar_url,
      specialization: r.specialization,
    })),
  });
}
