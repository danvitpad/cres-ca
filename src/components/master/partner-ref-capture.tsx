/** --- YAML
 * name: PartnerRefCapture
 * description: Reads ?from=<master_id> from the URL on a master public page and
 *              stores it in sessionStorage `cres_partner_ref`. Used by booking
 *              flows to set clients.referrer_master_id when the client originated
 *              from a partner master's "Recommended" block. (2026-05-06.)
 * --- */

'use client';

import { useEffect } from 'react';

const UUID_RE = /^[0-9a-f-]{36}$/i;

export function PartnerRefCapture() {
  useEffect(() => {
    try {
      const from = new URL(window.location.href).searchParams.get('from');
      if (!from || !UUID_RE.test(from)) return;
      // Сохраняем на 60 дней — клиент может вернуться позже и записаться.
      // sessionStorage живёт пока вкладка открыта; для долгой атрибуции
      // лучше cookie, но для MVP sessionStorage достаточно (цепочка
      // «открыл партнёра → сразу записался» в одной сессии).
      window.sessionStorage.setItem('cres_partner_ref', from);
    } catch {
      /* ignore */
    }
  }, []);
  return null;
}
