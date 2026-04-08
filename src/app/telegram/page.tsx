/** --- YAML
 * name: Telegram Mini App Entry
 * description: Entry point for Telegram Mini App — validates initData, authenticates, and redirects
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';

export default function TelegramEntryPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      // Wait for Telegram WebApp SDK
      const webapp = window.Telegram?.WebApp;
      if (!webapp) {
        setError('Not running inside Telegram');
        return;
      }

      webapp.ready();
      webapp.expand();

      const initData = webapp.initData;
      if (!initData) {
        setError('No init data from Telegram');
        return;
      }

      // Validate and authenticate
      const res = await fetch('/api/telegram/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData }),
      });

      if (!res.ok) {
        setError('Authentication failed');
        return;
      }

      const data = await res.json();
      setAuth(data.userId, data.role, data.tier);

      // Handle deep link params
      const startParam = webapp.initDataUnsafe?.start_param;
      if (startParam?.startsWith('master_')) {
        // Redirect to master's booking page
        const masterId = startParam.replace('master_', '');
        router.push(`/book?master_id=${masterId}`);
      } else if (data.role === 'client') {
        router.push('/book');
      } else {
        router.push('/calendar');
      }
    }

    init();
  }, [router, setAuth]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      {error ? (
        <div className="text-center space-y-2">
          <p className="text-red-500">{error}</p>
          <p className="text-sm text-muted-foreground">Please open this app from Telegram</p>
        </div>
      ) : (
        <>
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading CRES-CA...</p>
        </>
      )}
    </div>
  );
}
