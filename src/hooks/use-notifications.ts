/** --- YAML
 * name: useNotifications
 * description: Hook for fetching, marking read, and realtime-subscribing to user notifications. Tracks follow states for social notifications.
 * created: 2026-04-16
 * --- */

import { useCallback, useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

interface NotifData {
  type?: string;
  follower_profile_id?: string;
  profile_id?: string;
  [key: string]: unknown;
}

export interface Notification {
  id: string;
  title: string;
  body: string;
  channel: string;
  status: string;
  sent_at: string | null;
  created_at: string;
  read_at: string | null;
  data: NotifData | null;
}

export function useNotifications(userId: string | null) {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [followStates, setFollowStates] = useState<Record<string, boolean | 'loading'>>({});
  const mountedRef = useRef(true);

  const fetchItems = useCallback(async () => {
    if (!userId) return;
    const supabase = createClient();
    const { data } = await supabase
      .from('notifications')
      .select('id, title, body, channel, status, sent_at, created_at, read_at, data')
      .eq('profile_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (!mountedRef.current) return;
    const list = (data ?? []) as Notification[];
    setItems(list);
    setLoading(false);

    // Load follow states for new_follower notifications
    const followerIds = list
      .filter(n => n.data?.type === 'new_follower' && n.data?.follower_profile_id)
      .map(n => n.data!.follower_profile_id as string);

    if (followerIds.length > 0) {
      const { data: myFollows } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', userId)
        .in('following_id', followerIds);
      if (!mountedRef.current) return;
      const followingSet = new Set((myFollows ?? []).map(f => f.following_id));
      const states: Record<string, boolean> = {};
      for (const fId of followerIds) states[fId] = followingSet.has(fId);
      setFollowStates(states);
    }
  }, [userId]);

  useEffect(() => {
    mountedRef.current = true;
    fetchItems();
    return () => { mountedRef.current = false; };
  }, [fetchItems]);

  // Realtime subscription
  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`header-notif:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `profile_id=eq.${userId}` },
        () => fetchItems(),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, fetchItems]);

  const markRead = useCallback(async (id: string) => {
    const now = new Date().toISOString();
    setItems(prev => prev.map(n => n.id === id ? { ...n, read_at: now } : n));
    const supabase = createClient();
    await supabase.from('notifications').update({ read_at: now }).eq('id', id);
  }, []);

  const markAllRead = useCallback(async () => {
    if (!userId) return;
    const now = new Date().toISOString();
    setItems(prev => prev.map(n => n.read_at ? n : { ...n, read_at: now }));
    const supabase = createClient();
    await supabase
      .from('notifications')
      .update({ read_at: now })
      .eq('profile_id', userId)
      .is('read_at', null);
  }, [userId]);

  const toggleFollow = useCallback(async (targetId: string) => {
    setFollowStates(prev => ({ ...prev, [targetId]: 'loading' }));
    try {
      const res = await fetch('/api/follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetId }),
      });
      const data = await res.json();
      if (res.ok) {
        setFollowStates(prev => ({ ...prev, [targetId]: data.following }));
      }
    } catch {
      setFollowStates(prev => ({ ...prev, [targetId]: false }));
    }
  }, []);

  const unreadCount = items.filter(n => !n.read_at).length;

  return { items, unreadCount, loading, followStates, markRead, markAllRead, toggleFollow, refetch: fetchItems };
}
