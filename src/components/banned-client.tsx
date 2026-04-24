/** --- YAML
 * name: Banned client
 * description: Fetches ban reason via SECURITY DEFINER RPC, then signs the user out.
 * created: 2026-04-21
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { Ban } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export function BannedClient() {
  const [reason, setReason] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      try {
        const { data } = await supabase.rpc('get_my_ban_reason');
        if (typeof data === 'string') setReason(data);
      } catch {
        /* noop */
      } finally {
        setLoaded(true);
        // After reading reason, sign out to clear session
        await supabase.auth.signOut().catch(() => {});
      }
    })();
  }, []);

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#0b0d17] px-6">
      <div className="w-full max-w-md rounded-2xl border border-rose-400/20 bg-rose-500/[0.04] p-8 text-center">
        <div className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-rose-500/15 text-rose-300">
          <Ban className="size-7" />
        </div>
        <h1 className="mb-2 text-[22px] font-semibold text-white">Аккаунт заблокирован</h1>
        <p className="mb-4 text-[14px] text-white/70">
          Ваш аккаунт был заблокирован администрацией CRES-CA.
        </p>
        {loaded && reason && (
          <div className="mb-4 rounded-lg border border-white/10 bg-white/[0.04] p-3 text-left">
            <div className="mb-1 text-[11px] uppercase tracking-wider text-white/50">Причина</div>
            <div className="text-[14px] text-white/85">{reason}</div>
          </div>
        )}
        <p className="mb-6 text-[13px] text-white/55">
          Если вы считаете, что это ошибка, свяжитесь с нами:
          <br />
          <a href="mailto:support@cres-ca.com" className="text-rose-300 hover:underline">
            support@cres-ca.com
          </a>
        </p>
        <a
          href="/"
          className="inline-block h-10 rounded-md border border-white/10 bg-white/[0.04] px-4 text-[13px] font-medium leading-[40px] text-white/75 transition-colors hover:bg-white/[0.08]"
        >
          На главную
        </a>
      </div>
    </div>
  );
}
