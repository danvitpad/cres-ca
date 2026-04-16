/** --- YAML
 * name: useMaster Hook
 * description: Fetches current user's master record (id, profile data, working hours, invite code) from Supabase
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';

export interface MasterData {
  id: string;
  profile_id: string;
  salon_id: string | null;
  specialization: string | null;
  bio: string | null;
  address: string | null;
  city: string | null;
  working_hours: Record<string, { start: string; end: string; break_start?: string; break_end?: string } | null>;
  invite_code: string | null;
  is_active: boolean;
  tax_rate_percent: number | null;
  bonus_points: number | null;
  profile: {
    full_name: string;
    phone: string | null;
    avatar_url: string | null;
  };
}

export function useMaster() {
  const { userId, isLoading: authLoading } = useAuthStore();
  const [master, setMaster] = useState<MasterData | null>(null);
  const [loading, setLoading] = useState(true);

  async function refetch() {
    if (!userId) {
      setMaster(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('masters')
      .select('*, profile:profiles(full_name, phone, avatar_url)')
      .eq('profile_id', userId)
      .single();
    if (data) setMaster(data as unknown as MasterData);
    else setMaster(null);
    setLoading(false);
  }

  useEffect(() => {
    if (authLoading) return;
    refetch();
  }, [userId, authLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  return { master, loading: loading || authLoading, refetch };
}
