/** --- YAML
 * name: Superadmin feedback data
 * description: listFeedback(status?) — joins feedback rows with submitter profile (name/email/avatar/role). Sorted newest-first.
 * created: 2026-04-19
 * --- */

import { createClient as createAdminClient } from '@supabase/supabase-js';

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export type FeedbackStatus = 'new' | 'reviewed' | 'actioned' | 'closed';
export type FeedbackSource = 'web_settings' | 'telegram_bot' | 'telegram_voice' | 'mobile';

export interface FeedbackRow {
  id: string;
  profileId: string;
  profileName: string;
  profileEmail: string | null;
  profileAvatar: string | null;
  profileRole: string;
  source: FeedbackSource;
  originalText: string;
  cleanedText: string | null;
  voiceFileUrl: string | null;
  status: FeedbackStatus;
  tgMessageId: number | null;
  createdAt: string;
}

export interface FeedbackCounts {
  new: number;
  reviewed: number;
  actioned: number;
  closed: number;
  total: number;
}

export async function getFeedbackCounts(): Promise<FeedbackCounts> {
  const db = admin();
  const statuses: FeedbackStatus[] = ['new', 'reviewed', 'actioned', 'closed'];
  const entries = await Promise.all(
    statuses.map(async (s) => {
      const { count } = await db.from('feedback').select('id', { count: 'exact', head: true }).eq('status', s);
      return [s, count ?? 0] as const;
    }),
  );
  const { count: total } = await db.from('feedback').select('id', { count: 'exact', head: true });
  const out: FeedbackCounts = { new: 0, reviewed: 0, actioned: 0, closed: 0, total: total ?? 0 };
  for (const [s, c] of entries) out[s] = c;
  return out;
}

export async function listFeedback(status?: FeedbackStatus): Promise<FeedbackRow[]> {
  const db = admin();
  let q = db
    .from('feedback')
    .select('id, profile_id, source, original_text, cleaned_text, voice_file_url, status, tg_message_id, created_at, profiles:profile_id(full_name, first_name, email, avatar_url, role)')
    .order('created_at', { ascending: false })
    .limit(200);
  if (status) q = q.eq('status', status);

  const { data } = await q;

  type ProfileRef = { full_name: string | null; first_name: string | null; email: string | null; avatar_url: string | null; role: string | null };
  type Row = {
    id: string;
    profile_id: string;
    source: FeedbackSource;
    original_text: string;
    cleaned_text: string | null;
    voice_file_url: string | null;
    status: FeedbackStatus;
    tg_message_id: number | null;
    created_at: string;
    profiles: ProfileRef | ProfileRef[] | null;
  };

  return ((data ?? []) as unknown as Row[]).map((r) => {
    const prof = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
    return {
      id: r.id,
      profileId: r.profile_id,
      profileName: prof?.full_name || prof?.first_name || 'Без имени',
      profileEmail: prof?.email ?? null,
      profileAvatar: prof?.avatar_url ?? null,
      profileRole: prof?.role ?? '—',
      source: r.source,
      originalText: r.original_text,
      cleanedText: r.cleaned_text,
      voiceFileUrl: r.voice_file_url,
      status: r.status,
      tgMessageId: r.tg_message_id,
      createdAt: r.created_at,
    };
  });
}
