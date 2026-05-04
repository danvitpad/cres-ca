/** --- YAML
 * name: Mini App — Partnership Field Update
 * description: Generic field updater for master_partnerships. Allowed: note, contract_terms,
 *              commission_percent, promo_code, cross_promotion. UI is responsible for the
 *              full string for note/contract_terms (UI computes the joined value).
 * created: 2026-04-25
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { resolveUserId } from '@/lib/auth/resolve-user';

const ALLOWED = new Set(['note', 'contract_terms', 'commission_percent', 'promo_code', 'cross_promotion']);

export async function POST(req: Request) {
  const body = await req.json().catch(() => null) as
    | { partnership_id?: string; field?: string; value?: unknown }
    | null;
  if (!body?.partnership_id || !body?.field) {
    return NextResponse.json({ error: 'missing_params' }, { status: 400 });
  }
  if (!ALLOWED.has(body.field)) {
    return NextResponse.json({ error: 'field_not_allowed' }, { status: 400 });
  }

  const userId = await resolveUserId(req);
  if (!userId) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: master } = await admin.from('masters').select('id').eq('profile_id', userId).maybeSingle();
  if (!master) return NextResponse.json({ error: 'not_master' }, { status: 403 });

  const { data: row } = await admin
    .from('master_partnerships')
    .select('master_id, partner_id')
    .eq('id', body.partnership_id)
    .maybeSingle();
  if (!row || (row.master_id !== master.id && row.partner_id !== master.id)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let value = body.value;
  if (body.field === 'note' || body.field === 'contract_terms') {
    if (typeof value !== 'string') value = '';
    value = (value as string).trim();
    if (!(value as string).length) value = null;
  }
  if (body.field === 'commission_percent') {
    if (value === null || value === '') value = null;
    else value = Math.max(0, Math.min(100, Number(value)));
  }
  if (body.field === 'cross_promotion') {
    value = !!value;
  }
  if (body.field === 'promo_code') {
    value = typeof value === 'string' ? value.trim().slice(0, 64) || null : null;
  }

  const { error } = await admin
    .from('master_partnerships')
    .update({ [body.field]: value })
    .eq('id', body.partnership_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
