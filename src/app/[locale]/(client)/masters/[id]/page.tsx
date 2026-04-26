/** --- YAML
 * name: Master Profile Redirect
 * description: Старая внутренняя страница `/masters/[id]` устарела — Fresha-style
 *              публичная страница живёт на `/m/{slug}`. Просто резолвим slug по id
 *              на сервере и редиректим. Сохраняет ?ref=, ?service= и прочие query.
 * created: 2026-04-13
 * updated: 2026-04-26
 * --- */

import { redirect, notFound } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

interface PageProps {
  params: Promise<{ id: string; locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function MasterByIdRedirect({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = await searchParams;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) notFound();

  const admin = createClient(url, key, { auth: { persistSession: false } });
  const { data } = await admin
    .from('masters')
    .select('slug, invite_code, is_public')
    .eq('id', id)
    .maybeSingle();

  if (!data?.is_public) notFound();
  const handle = data.slug ?? data.invite_code;
  if (!handle) notFound();

  // Сохраняем query string (?ref=…, ?service=…) при редиректе
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === 'string') qs.set(k, v);
    else if (Array.isArray(v) && v[0]) qs.set(k, v[0]);
  }
  const qsStr = qs.toString();
  redirect(`/m/${handle}${qsStr ? `?${qsStr}` : ''}`);
}
