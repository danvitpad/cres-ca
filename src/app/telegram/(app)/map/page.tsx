/** --- YAML
 * name: MiniAppMapRedirect
 * description: Legacy /telegram/map → /telegram/search?view=map (Phase 3 unified).
 * updated: 2026-04-19
 * --- */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function MiniAppMapRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/telegram/search?view=map');
  }, [router]);
  return (
    <div className="flex min-h-[60dvh] items-center justify-center">
      <Loader2 className="size-6 animate-spin text-neutral-400" />
    </div>
  );
}
