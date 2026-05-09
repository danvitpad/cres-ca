/** --- YAML
 * name: Master AI chat history
 * description: Persistent memory for the master AI agent. Reads/writes
 *   master_chat_messages so the conversation survives page reloads and is
 *   shared across web /today, Mini App, and TG voice surfaces. 30-day
 *   retention via pg_cron job 'master-chat-cleanup'.
 * created: 2026-05-09
 * --- */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const HISTORY_LIMIT = 6;

/**
 * Load the most recent N messages for this master (oldest first).
 * Returns empty array on any error — chat continues without memory.
 */
export async function loadMasterChatHistory(
  admin: SupabaseClient,
  masterId: string,
  limit = HISTORY_LIMIT,
): Promise<ChatMessage[]> {
  const { data: convId, error: convErr } = await admin.rpc('get_master_conversation', {
    p_master_id: masterId,
  });
  if (convErr || !convId) return [];

  const { data: msgs } = await admin
    .from('master_chat_messages')
    .select('role, content')
    .eq('conversation_id', convId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (!msgs || msgs.length === 0) return [];

  return (msgs as Array<{ role: 'user' | 'assistant'; content: string }>)
    .reverse()
    .map((m) => ({ role: m.role, content: m.content }));
}

/**
 * Append a user→assistant exchange to history and bump last_message_at.
 * Best-effort: logs but does not throw on failure.
 */
export async function appendMasterChatExchange(
  admin: SupabaseClient,
  masterId: string,
  userText: string,
  assistantText: string,
  meta?: Record<string, unknown>,
): Promise<void> {
  const { data: convId, error: convErr } = await admin.rpc('get_master_conversation', {
    p_master_id: masterId,
  });
  if (convErr || !convId) return;

  await admin.from('master_chat_messages').insert([
    { conversation_id: convId, role: 'user', content: userText.slice(0, 4000), meta: meta ?? null },
    { conversation_id: convId, role: 'assistant', content: assistantText.slice(0, 4000), meta: null },
  ]);

  await admin
    .from('master_chat_conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', convId);
}
