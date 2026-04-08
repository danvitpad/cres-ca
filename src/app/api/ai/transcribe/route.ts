/** --- YAML
 * name: Voice Transcription API
 * description: Accepts audio blob, transcribes via AI, and parses into structured CRM data
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { aiComplete } from '@/lib/ai/openrouter';
import { hasFeature } from '@/types';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Check subscription
  const { data: sub } = await supabase.from('subscriptions').select('tier').eq('profile_id', user.id).single();
  if (!sub || !hasFeature(sub.tier as 'starter' | 'pro' | 'business' | 'trial', 'ai_features')) {
    return NextResponse.json({ error: 'Upgrade required' }, { status: 403 });
  }

  const { text } = await request.json();
  if (!text) return NextResponse.json({ error: 'No text provided' }, { status: 400 });

  const result = await aiComplete(
    `You are a CRM assistant for service professionals (beauty salons, dentists, etc.).
Parse the following voice note transcription into structured data.
Extract: client_name, service_performed, notes, inventory_items_used (array of {name, quantity}).
Return valid JSON only, no extra text.`,
    text,
  );

  try {
    const parsed = JSON.parse(result);
    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json({ raw: result });
  }
}
