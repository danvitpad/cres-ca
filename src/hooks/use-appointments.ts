/** --- YAML
 * name: useAppointments Hook
 * description: Fetches appointments for a date range with client and service data joined
 * --- */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { AppointmentStatus } from '@/types';

export interface AppointmentData {
  id: string;
  client_id: string;
  master_id: string;
  service_id: string;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  price: number;
  currency: string;
  notes: string | null;
  client: { id: string; full_name: string; phone: string | null; email: string | null; has_health_alert: boolean } | null;
  service: { id: string; name: string; color: string; duration_minutes: number } | null;
}

export function useAppointments(masterId: string | undefined, startDate: Date, endDate: Date) {
  const [appointments, setAppointments] = useState<AppointmentData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async (showLoading: boolean) => {
    if (!masterId) return;
    if (showLoading) setIsLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('appointments')
      .select('*, client:clients(id, full_name, phone, email, has_health_alert), service:services(id, name, color, duration_minutes)')
      .eq('master_id', masterId)
      .gte('starts_at', startDate.toISOString())
      .lte('starts_at', endDate.toISOString())
      .order('starts_at');
    if (data) setAppointments(data as unknown as AppointmentData[]);
    setIsLoading(false);
  }, [masterId, startDate.toISOString(), endDate.toISOString()]); // eslint-disable-line react-hooks/exhaustive-deps

  const refetch = useCallback(() => fetchData(false), [fetchData]);

  useEffect(() => { fetchData(true); }, [fetchData]);

  return { appointments, isLoading, refetch };
}
