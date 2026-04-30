/** --- YAML
 * name: Waitlist API
 * description: Шаг 23. POST — клиент встаёт в лист ожидания на услугу мастера.
 *              GET — клиент видит свои активные ожидания. DELETE — выйти из очереди.
 * created: 2026-04-30
 * --- */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const VALID_TIME_WINDOWS = ['morning', 'afternoon', 'evening', 'any'] as const;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null) as {
    master_id?: string;
    service_id?: string;
    preferred_days?: number[];
    preferred_time_window?: string;
  } | null;

  if (!body?.master_id) return NextResponse.json({ error: 'missing_master_id' }, { status: 400 });

  // Один активный waitlist-entry на пару (client, master, service)
  const { data: existing } = await supabase
    .from('waitlist')
    .select('id')
    .eq('client_profile_id', user.id)
    .eq('master_id', body.master_id)
    .eq('status', 'waiting')
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ ok: true, id: (existing as { id: string }).id, alreadyExists: true });
  }

  const insert = {
    client_profile_id: user.id,
    master_id: body.master_id,
    service_id: body.service_id ?? null,
    preferred_days: body.preferred_days && body.preferred_days.length > 0 ? body.preferred_days : null,
    preferred_time_window: VALID_TIME_WINDOWS.includes(body.preferred_time_window as never)
      ? body.preferred_time_window
      : 'any',
  };

  const { data, error } = await supabase
    .from('waitlist')
    .insert(insert)
    .select('id')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, id: (data as { id: string }).id });
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('waitlist')
    .select('id, master_id, service_id, status, preferred_days, preferred_time_window, created_at, expires_at, notified_at, matched_appointment_id')
    .eq('client_profile_id', user.id)
    .in('status', ['waiting', 'matched'])
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entries: data ?? [] });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'missing_id' }, { status: 400 });

  const { error } = await supabase
    .from('waitlist')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .eq('client_profile_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
