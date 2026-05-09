/** --- YAML
 * name: Client TG chat history
 * description: Persistent memory for the client AI agent in Telegram bot.
 *   Reuses the existing ai_messages table with surface='client_tg' so messages
 *   are isolated from Mini App ('client_concierge'). Last 6 messages are
 *   passed into parseClientTextIntent so AI understands short follow-ups
 *   like "Проба" answering "На какую услугу?".
 * created: 2026-05-09
 * --- */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const SURFACE = 'client_tg';
const HISTORY_LIMIT = 6;

export async function loadClientTgHistory(
  admin: SupabaseClient,
  profileId: string,
  limit = HISTORY_LIMIT,
): Promise<ChatMessage[]> {
  const { data } = await admin
    .from('ai_messages')
    .select('role, content')
    .eq('profile_id', profileId)
    .eq('surface', SURFACE)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (!data) return [];
  return (data as Array<{ role: 'user' | 'assistant'; content: string }>)
    .reverse()
    .map((m) => ({ role: m.role, content: m.content }));
}

export async function appendClientTgExchange(
  admin: SupabaseClient,
  profileId: string,
  userText: string,
  assistantText: string,
  intent?: string | null,
): Promise<void> {
  await admin.from('ai_messages').insert([
    { profile_id: profileId, surface: SURFACE, role: 'user', content: userText.slice(0, 4000), intent: intent ?? null },
    { profile_id: profileId, surface: SURFACE, role: 'assistant', content: assistantText.slice(0, 4000), intent: null },
  ]);
}
