/** --- YAML
 * name: Slug Resolve API
 * description: GET /api/u/slug/{slug} → returns publicId. Used by pretty-link deep-links.
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const s = slug?.toLowerCase().trim();
  if (!s) return NextResponse.json({ error: 'invalid_slug' }, { status: 400 });

  const supabase = await createClient();
  const { data } = await supabase
    .from('profiles')
    .select('id, public_id, full_name')
    .eq('slug', s)
    .maybeSingle();

  if (!data || !data.public_id) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ publicId: data.public_id, fullName: data.full_name });
}
