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
  vertical: string | null;
  feature_overrides: Record<string, boolean> | null;
  invite_code: string | null;
  slug: string | null;
  is_public: boolean | null;
  is_active: boolean;
  // Public-page customization (migration 00104).
  cover_url: string | null;
  theme_primary_color: string | null;
  theme_background_color: string | null;
  banner_position_y: number | null;
  phone_public: boolean | null;
  email_public: boolean | null;
  dob_public: boolean | null;
  interests: string[] | null;
  social_links: Record<string, string> | null;
  page_type: 'master' | 'salon' | 'clinic' | 'workshop' | 'auto_service' | 'fitness' | 'other' | null;
  // Unified loyalty programme config (migration 00102).
  loyalty_enabled: boolean | null;
  loyalty_visit_percent: number | null;
  loyalty_max_per_visit: number | null;
  loyalty_expiry_months: number | null;
  loyalty_referral_reward: number | null;
  loyalty_birthday_enabled: boolean | null;
  loyalty_birthday_percent: number | null;
  loyalty_birthday_validity_days: number | null;
  tax_rate_percent: number | null;
  bonus_points: number | null;
  profile: {
    full_name: string;
    first_name: string | null;
    last_name: string | null;
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
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from('masters')
        .select('*, profile:profiles!masters_profile_id_fkey(full_name, first_name, last_name, phone, avatar_url)')
        .eq('profile_id', userId)
        .single();
      if (data) setMaster(data as unknown as MasterData);
      else setMaster(null);
    } catch {
      setMaster(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (authLoading) return;
    refetch();
  }, [userId, authLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  return { master, loading: loading || authLoading, refetch };
}
