/** --- YAML
 * name: Feedback submit API (text)
 * description: POST /api/feedback — текстовый фидбек. Делегирует в submitFeedback()
 *              из @/lib/feedback/submit, который делает AI cleanup+categorize → DB
 *              insert → TG-notify → Google Sheets sync.
 * created: 2026-04-19
 * updated: 2026-04-30
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { submitFeedback, type FeedbackSource } from '@/lib/feedback/submit';

interface PostBody {
  text: string;
  source?: FeedbackSource;
  voice_file_url?: string | null;
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await req.json()) as PostBody;
  const original = (body.text ?? '').trim();
  if (original.length < 4) return NextResponse.json({ error: 'too short' }, { status: 400 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .maybeSingle();

  const result = await submitFeedback({
    supabase,
    profileId: user.id,
    profileName: profile?.full_name ?? user.email ?? 'Anonymous',
    profileRole: profile?.role ?? null,
    source: body.source ?? 'web_settings',
    originalText: original,
    voiceFileUrl: body.voice_file_url ?? null,
  });

  if (!result) {
    return NextResponse.json({ error: 'submit_failed' }, { status: 500 });
  }

  return NextResponse.json({ id: result.id, cleaned: result.cleaned, category: result.category });
}
