/** --- YAML
 * name: Smart Booking Suggestion API
 * description: Calculates client visit intervals and generates personalized reminder messages
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { aiComplete } from '@/lib/ai/openrouter';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { clientId, masterId } = await request.json();
  if (!clientId || !masterId) return NextResponse.json({ error: 'Missing params' }, { status: 400 });

  // Get client's appointment history
  const { data: appointments } = await supabase
    .from('appointments')
    .select('starts_at, services(name)')
    .eq('client_id', clientId)
    .eq('master_id', masterId)
    .eq('status', 'completed')
    .order('starts_at', { ascending: true });

  if (!appointments || appointments.length < 2) {
    return NextResponse.json({ message: null, avgInterval: null });
  }

  // Calculate average interval between visits
  const dates = appointments.map((a) => new Date(a.starts_at).getTime());
  const intervals: number[] = [];
  for (let i = 1; i < dates.length; i++) {
    intervals.push(Math.round((dates[i] - dates[i - 1]) / (1000 * 60 * 60 * 24)));
  }
  const avgInterval = Math.round(intervals.reduce((s, d) => s + d, 0) / intervals.length);

  const lastVisit = new Date(dates[dates.length - 1]);
  const daysSince = Math.round((Date.now() - lastVisit.getTime()) / (1000 * 60 * 60 * 24));
  const isOverdue = daysSince > avgInterval;

  if (!isOverdue) {
    return NextResponse.json({ message: null, avgInterval, daysSince, isOverdue: false });
  }

  // Get client name
  const { data: client } = await supabase.from('clients').select('full_name').eq('id', clientId).single();
  const lastService = (appointments[appointments.length - 1].services as unknown as { name: string })?.name || 'appointment';

  const message = await aiComplete(
    `You are a friendly appointment reminder bot for a service professional.
Write a short, warm, personalized reminder message (2-3 sentences max).
Do not use emojis. Be professional but friendly.`,
    `Client name: ${client?.full_name || 'there'}
Last service: ${lastService}
Days since last visit: ${daysSince}
Usual visit interval: ${avgInterval} days
They are ${daysSince - avgInterval} days overdue.`,
  );

  return NextResponse.json({ message, avgInterval, daysSince, isOverdue: true });
}
