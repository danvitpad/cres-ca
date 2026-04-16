/** --- YAML
 * name: useAnnouncements
 * description: Hook for fetching active service announcements with localStorage dismiss and realtime updates.
 * created: 2026-04-16
 * --- */

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface Announcement {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  link_label: string | null;
  type: 'info' | 'promo' | 'warning' | 'update';
  created_at: string;
}

const LS_KEY = 'dismissed_announcements';

function getDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveDismissed(ids: Set<string>) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify([...ids]));
  } catch { /* noop */ }
}

export function useAnnouncements() {
  const [all, setAll] = useState<Announcement[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const fetchAnnouncements = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('service_announcements')
      .select('id, title, body, link, link_label, type, created_at')
      .eq('is_active', true)
      .lte('starts_at', new Date().toISOString())
      .or(`ends_at.is.null,ends_at.gt.${new Date().toISOString()}`)
      .order('created_at', { ascending: false })
      .limit(5);
    setAll((data ?? []) as Announcement[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    setDismissed(getDismissed());
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  // Realtime
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('service-announcements')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_announcements' }, () => fetchAnnouncements())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchAnnouncements]);

  const dismiss = useCallback((id: string) => {
    setDismissed(prev => {
      const next = new Set(prev);
      next.add(id);
      saveDismissed(next);
      return next;
    });
  }, []);

  const announcements = all.filter(a => !dismissed.has(a.id));

  return { announcements, loading, dismiss };
}
