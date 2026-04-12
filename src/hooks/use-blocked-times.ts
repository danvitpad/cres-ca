/** --- YAML
 * name: useBlockedTimes
 * description: Hook to fetch and manage blocked time slots for a master's calendar
 * --- */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface BlockedTime {
  id: string;
  master_id: string;
  starts_at: string;
  ends_at: string;
  reason: string | null;
  created_at: string;
}

export function useBlockedTimes(masterId: string | undefined, startDate: Date, endDate: Date) {
  const [blockedTimes, setBlockedTimes] = useState<BlockedTime[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async (showLoading: boolean) => {
    if (!masterId) return;
    if (showLoading) setIsLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('blocked_times')
      .select('*')
      .eq('master_id', masterId)
      .gte('starts_at', startDate.toISOString())
      .lte('starts_at', endDate.toISOString())
      .order('starts_at');
    if (data) setBlockedTimes(data);
    setIsLoading(false);
  }, [masterId, startDate.getTime(), endDate.getTime()]);

  useEffect(() => { fetchData(true); }, [fetchData]);

  const refetch = useCallback(() => { fetchData(false); }, [fetchData]);

  return { blockedTimes, isLoading, refetch };
}
