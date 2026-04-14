/** --- YAML
 * name: RefCapture
 * description: Reads ?ref=<profile_id> from the URL and stores it in sessionStorage для дальнейшего credit при booking.
 * created: 2026-04-14
 * updated: 2026-04-14
 * --- */

'use client';

import { useEffect } from 'react';

export function RefCapture() {
  useEffect(() => {
    try {
      const ref = new URL(window.location.href).searchParams.get('ref');
      if (ref && /^[0-9a-f-]{36}$/i.test(ref)) {
        window.sessionStorage.setItem('cres_ref', ref);
      }
    } catch {
      /* ignore */
    }
  }, []);
  return null;
}
