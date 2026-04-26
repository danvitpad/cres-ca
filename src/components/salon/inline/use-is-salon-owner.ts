/** --- YAML
 * name: useIsSalonOwner
 * description: Returns true when the logged-in user matches given salons.owner_id.
 *              Used by salon inline-edit components to render pencil only for owner.
 * created: 2026-04-26
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export function useIsSalonOwner(salonOwnerId: string | null): boolean {
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    if (!salonOwnerId) return;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setIsOwner(data.user?.id === salonOwnerId);
    });
  }, [salonOwnerId]);

  return isOwner;
}
