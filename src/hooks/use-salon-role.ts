/** --- YAML
 * name: useSalonRole
 * description: Client-side hook returning the current user's role in a salon (admin/master/receptionist or null).
 *              Fetches /api/salon/[id]/role. Not reactive to DB changes — re-mount to refresh.
 * created: 2026-04-19
 * --- */

'use client';

import { useEffect, useState } from 'react';

export type SalonRole = 'admin' | 'master' | 'receptionist';

export function useSalonRole(salonId: string | null | undefined) {
  const [role, setRole] = useState<SalonRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!salonId) {
      setRole(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/salon/${salonId}/role`)
      .then((r) => (r.ok ? r.json() : { role: null }))
      .then((j) => {
        if (!cancelled) setRole((j?.role as SalonRole | null) ?? null);
      })
      .catch(() => {
        if (!cancelled) setRole(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [salonId]);

  return {
    role,
    loading,
    isAdmin: role === 'admin',
    isMaster: role === 'master',
    isReceptionist: role === 'receptionist',
  };
}
