/** --- YAML
 * name: Salon Clients API
 * description: GET — lists salon clients, filtered/gated by role. Admin sees all (unified full,
 *              marketplace aggregate). Receptionist sees all but without finance metrics. Master
 *              sees only their own clients.
 * created: 2026-04-19
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { getCurrentUserRole } from '@/lib/team/roles';
import { notifyUser } from '@/lib/notifications/notify';

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

function normalizePhone(p: string | null | undefined): string | null {
  if (!p) return null;
  const digits = p.replace(/\D/g, '');
  return digits.length >= 9 ? digits : null;
}

function normalizeEmail(e: string | null | undefined): string | null {
  if (!e) return null;
  const t = e.trim().toLowerCase();
  return t.includes('@') ? t : null;
}

interface ClientRow {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  date_of_birth: string | null;
  master_id: string;
  visibility: string | null;
  created_at: string;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: salonId } = await params;
  const role = await getCurrentUserRole(salonId);
  if (!role) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const { data: salon } = await supabase
    .from('salons')
    .select('id, name, team_mode')
    .eq('id', salonId)
    .maybeSingle();
  if (!salon) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const { data: masters } = await supabase
    .from('masters')
    .select('id, display_name, profile_id')
    .eq('salon_id', salonId)
    .eq('is_active', true);
  const masterList = masters ?? [];
  const masterIds = masterList.map((m) => m.id);
  const ownMaster = masterList.find((m) => m.profile_id === user.id);

  const isUnified = salon.team_mode === 'unified';
  const showFinance = role === 'admin';
  const isMaster = role === 'master';

  let query = supabase
    .from('clients')
    .select('id, full_name, phone, email, date_of_birth, master_id, visibility, created_at')
    .eq('salon_id', salonId)
    .order('created_at', { ascending: false })
    .limit(500);

  if (isMaster) {
    if (!ownMaster) return NextResponse.json({ clients: [], role, salon, masters: masterList });
    query = query.eq('master_id', ownMaster.id);
  } else if (masterIds.length === 0) {
    return NextResponse.json({ clients: [], role, salon, masters: masterList });
  } else {
    query = query.in('master_id', masterIds);
  }

  const { data: clientsData } = await query;
  const clients = (clientsData ?? []) as ClientRow[];

  // Salon-level followers (клиент добавил салон в контакты, но ещё не записан
  // ни к одному мастеру) — admin/receptionist видят их вместе с master-bound
  // клиентами. Master в своём списке не видит.
  const salonFollowerIds = new Set<string>();
  type FollowerCard = {
    id: string;
    profile_id: string;
    full_name: string;
    phone: string | null;
    email: string | null;
    date_of_birth: string | null;
    created_at: string;
  };
  const salonFollowerCards: FollowerCard[] = [];
  if (!isMaster) {
    // Skip duplicates that already have a master-bound clients row.
    const linkedProfileIds = new Set<string>();
    if (clients.length > 0) {
      const { data: linkedRows } = await supabase
        .from('clients')
        .select('profile_id')
        .in('id', clients.map((c) => c.id));
      for (const r of (linkedRows ?? []) as Array<{ profile_id: string | null }>) {
        if (r.profile_id) linkedProfileIds.add(r.profile_id);
      }
    }

    const { data: followers } = await supabase
      .from('salon_follows')
      .select('profile_id, created_at, profile:profiles!salon_follows_profile_id_fkey(id, full_name, phone, email, date_of_birth)')
      .eq('salon_id', salonId)
      .order('created_at', { ascending: false })
      .limit(500);
    type FollowerRow = {
      profile_id: string;
      created_at: string;
      profile: { id: string; full_name: string | null; phone: string | null; email: string | null; date_of_birth: string | null } | { id: string; full_name: string | null; phone: string | null; email: string | null; date_of_birth: string | null }[] | null;
    };
    for (const f of (followers ?? []) as FollowerRow[]) {
      if (linkedProfileIds.has(f.profile_id)) continue;
      const p = Array.isArray(f.profile) ? f.profile[0] : f.profile;
      if (!p) continue;
      salonFollowerIds.add(f.profile_id);
      salonFollowerCards.push({
        id: `follow:${f.profile_id}`,
        profile_id: f.profile_id,
        full_name: p.full_name || 'Клиент',
        phone: p.phone,
        email: p.email,
        date_of_birth: p.date_of_birth,
        created_at: f.created_at,
      });
    }
  }

  let finance: Map<string, { visits: number; spent: number }> | null = null;
  if (showFinance && clients.length > 0) {
    const ids = clients.map((c) => c.id);
    const { data: appts } = await supabase
      .from('appointments')
      .select('client_id, price, status')
      .in('client_id', ids);
    finance = new Map();
    for (const a of (appts ?? []) as Array<{ client_id: string | null; price: number | null; status: string }>) {
      if (!a.client_id) continue;
      const row = finance.get(a.client_id) ?? { visits: 0, spent: 0 };
      row.visits += 1;
      if (a.status === 'completed' || a.status === 'paid') {
        row.spent += Number(a.price ?? 0);
      }
      finance.set(a.client_id, row);
    }
  }

  const masterMap = new Map(masterList.map((m) => [m.id, m.display_name]));

  const payload = clients.map((c) => {
    const base: Record<string, unknown> = {
      id: c.id,
      full_name: c.full_name,
      phone: c.phone,
      email: c.email,
      date_of_birth: c.date_of_birth,
      created_at: c.created_at,
      source: 'master',
    };

    if (!isUnified && role === 'admin') {
      // Marketplace admin: hide master mapping
    } else {
      base.master_id = c.master_id;
      base.master_name = masterMap.get(c.master_id) ?? null;
    }

    if (showFinance && finance) {
      const f = finance.get(c.id);
      base.visits = f?.visits ?? 0;
      base.spent = f?.spent ?? 0;
    }

    return base;
  });

  // Append salon-level follower cards.
  for (const f of salonFollowerCards) {
    payload.push({
      id: f.id,
      full_name: f.full_name,
      phone: f.phone,
      email: f.email,
      date_of_birth: f.date_of_birth,
      created_at: f.created_at,
      source: 'salon_follow',
      master_id: null,
      master_name: null,
      visits: 0,
      spent: 0,
    });
  }

  return NextResponse.json({
    salon: { id: salon.id, name: salon.name, team_mode: salon.team_mode },
    role,
    masters: isMaster ? [] : masterList.map((m) => ({ id: m.id, display_name: m.display_name })),
    clients: payload,
  });
}

interface PostBody {
  full_name?: string;
  phone?: string | null;
  email?: string | null;
  date_of_birth?: string | null;
  notes?: string | null;
  /** Если задано — клиент привязан к этому мастеру команды; иначе — salon-level. */
  master_id?: string | null;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: salonId } = await params;
  const role = await getCurrentUserRole(salonId);
  if (!role) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (role !== 'admin' && role !== 'receptionist') {
    return NextResponse.json({ error: 'admins_only' }, { status: 403 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const { data: salon } = await supabase
    .from('salons')
    .select('id, name')
    .eq('id', salonId)
    .maybeSingle();
  if (!salon) return NextResponse.json({ error: 'salon_not_found' }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as PostBody;
  const fullName = (body.full_name ?? '').trim();
  if (!fullName) return NextResponse.json({ error: 'full_name_required' }, { status: 400 });

  const phoneNorm = normalizePhone(body.phone);
  const emailNorm = normalizeEmail(body.email);

  const adm = admin();

  // Если master_id задан — проверяем что он действительно входит в команду.
  let masterId: string | null = null;
  if (body.master_id) {
    const { data: m } = await adm
      .from('masters')
      .select('id, salon_id')
      .eq('id', body.master_id)
      .eq('salon_id', salonId)
      .maybeSingle();
    if (!m) return NextResponse.json({ error: 'master_not_in_salon' }, { status: 400 });
    masterId = m.id;
  }

  // Auto-link
  let linkedProfileId: string | null = null;
  if (phoneNorm || emailNorm) {
    let q = adm.from('profiles').select('id, phone, email');
    if (phoneNorm && emailNorm) {
      q = q.or(`phone.eq.${phoneNorm},email.eq.${emailNorm}`);
    } else if (phoneNorm) {
      q = q.eq('phone', phoneNorm);
    } else if (emailNorm) {
      q = q.eq('email', emailNorm);
    }
    const { data: matches } = await q.limit(5);
    const candidate = (matches ?? []).find((p) => {
      const phMatch = phoneNorm && p.phone && normalizePhone(p.phone) === phoneNorm;
      const emMatch = emailNorm && p.email && p.email.toLowerCase() === emailNorm;
      return phMatch || emMatch;
    });
    if (candidate) linkedProfileId = candidate.id;
  }

  // Если salon-level (master_id == null) и есть linkedProfileId — пишем
  // строку в salon_follows вместо clients (источник правды для команды).
  if (!masterId && linkedProfileId) {
    await adm
      .from('salon_follows')
      .upsert(
        { profile_id: linkedProfileId, salon_id: salonId },
        { onConflict: 'profile_id,salon_id', ignoreDuplicates: true },
      );
    if (linkedProfileId !== user.id) {
      await notifyUser(adm, {
        profileId: linkedProfileId,
        title: 'Вас добавили в контакты',
        body: `Команда «${salon.name}» добавила вас в свои контакты`,
        data: { type: 'salon_added_you', salon_id: salonId, action_url: `/s/${salonId}` },
        deepLinkPath: `/telegram/salon/${salonId}`,
        deepLinkLabel: 'Открыть салон',
      });
    }
    return NextResponse.json({ id: `follow:${linkedProfileId}`, linked: true, salon_level: true });
  }

  // Иначе — пишем в clients.
  const insertPayload = {
    master_id: masterId,
    salon_id: salonId,
    profile_id: linkedProfileId,
    full_name: fullName,
    phone: phoneNorm ?? body.phone?.trim() ?? null,
    email: emailNorm ?? body.email?.trim() ?? null,
    date_of_birth: body.date_of_birth || null,
    notes: body.notes?.trim() || null,
  };

  let clientId: string | null = null;
  if (linkedProfileId && masterId) {
    const { data: existing } = await adm
      .from('clients')
      .select('id')
      .eq('profile_id', linkedProfileId)
      .eq('master_id', masterId)
      .maybeSingle();
    if (existing) {
      clientId = existing.id;
    } else {
      const { data: inserted, error } = await adm
        .from('clients')
        .insert(insertPayload)
        .select('id')
        .single();
      if (error) return NextResponse.json({ error: 'insert_failed', detail: error.message }, { status: 500 });
      clientId = inserted.id;
    }
    if (linkedProfileId !== user.id) {
      await notifyUser(adm, {
        profileId: linkedProfileId,
        title: 'Вас добавили в контакты',
        body: `Команда «${salon.name}» добавила вас в свои контакты`,
        data: { type: 'salon_added_you', salon_id: salonId, action_url: `/s/${salonId}` },
        deepLinkPath: `/telegram/salon/${salonId}`,
        deepLinkLabel: 'Открыть салон',
      });
    }
  } else {
    const { data: inserted, error } = await adm
      .from('clients')
      .insert(insertPayload)
      .select('id')
      .single();
    if (error) return NextResponse.json({ error: 'insert_failed', detail: error.message }, { status: 500 });
    clientId = inserted.id;
  }

  return NextResponse.json({
    id: clientId,
    linked: Boolean(linkedProfileId),
    salon_level: !masterId,
  });
}
