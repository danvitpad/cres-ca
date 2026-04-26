/** --- YAML
 * name: RefCapture
 * description: Reads ?ref=<profile_id|invite_code> from the URL and stores resolved
 *              profile_id in sessionStorage. Поддерживает оба формата:
 *              ref=<UUID> — кладём как есть; ref=<short_code> — резолвим через
 *              /api/referral/resolve-code и кладём профиль-id. Используется при booking.
 * created: 2026-04-14
 * updated: 2026-04-26
 * --- */

'use client';

import { useEffect } from 'react';

const UUID_RE = /^[0-9a-f-]{36}$/i;
const CODE_RE = /^[a-z0-9_-]{3,64}$/i;

export function RefCapture() {
  useEffect(() => {
    try {
      const ref = new URL(window.location.href).searchParams.get('ref');
      if (!ref) return;
      if (UUID_RE.test(ref)) {
        window.sessionStorage.setItem('cres_ref', ref);
        return;
      }
      if (!CODE_RE.test(ref)) return;
      // Short referral code — resolve to profile_id once and cache
      fetch(`/api/referral/resolve-code?code=${encodeURIComponent(ref.toLowerCase())}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { profile_id?: string } | null) => {
          if (d?.profile_id) {
            window.sessionStorage.setItem('cres_ref', d.profile_id);
          }
        })
        .catch(() => { /* ignore */ });
    } catch {
      /* ignore */
    }
  }, []);
  return null;
}
