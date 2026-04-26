/** --- YAML
 * name: useIsOwner
 * description: Returns true when the logged-in user matches given master.profile_id.
 *              Used by inline-edit components to render pencil only for owner.
 * created: 2026-04-26
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export function useIsOwner(masterProfileId: string | null): boolean {
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    if (!masterProfileId) return;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setIsOwner(data.user?.id === masterProfileId);
    });
  }, [masterProfileId]);

  return isOwner;
}
