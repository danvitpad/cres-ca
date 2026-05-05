'use client';

import { useEffect, useState } from 'react';

export function OnlineBadge({ initialOnline }: { initialOnline: boolean }) {
  const [online, setOnline] = useState(initialOnline);

  useEffect(() => {
    function handle(e: Event) {
      const detail = (e as CustomEvent<{ value: boolean }>).detail;
      setOnline(detail.value);
    }
    window.addEventListener('master:online_changed', handle);
    return () => window.removeEventListener('master:online_changed', handle);
  }, []);

  if (!online) return null;
  return (
    <span
      className="absolute left-4 top-4 z-10 inline-flex size-3 items-center justify-center rounded-full bg-emerald-500 shadow"
      style={{ boxShadow: '0 0 0 2px var(--m-surface)' }}
      title="Принимает онлайн"
    />
  );
}
