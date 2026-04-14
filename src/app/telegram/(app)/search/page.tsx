/** --- YAML
 * name: MiniAppSearchRedirect
 * description: Search tab merged into map — redirects to /telegram/map
 * created: 2026-04-13
 * updated: 2026-04-14
 * --- */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function MiniAppSearchRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/telegram/map');
  }, [router]);
  return (
    <div className="flex min-h-[60dvh] items-center justify-center">
      <Loader2 className="size-6 animate-spin text-white/40" />
    </div>
  );
}
