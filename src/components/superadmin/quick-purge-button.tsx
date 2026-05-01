/** --- YAML
 * name: Quick purge button
 * description: Two-click inline delete for superadmin users list — no email confirmation, no card open required.
 * created: 2026-05-01
 * --- */

'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, Loader2 } from 'lucide-react';

interface Props {
  profileId: string;
  profileName: string;
}

export function QuickPurgeButton({ profileId, profileName }: Props) {
  const [state, setState] = useState<'idle' | 'confirming' | 'loading'>('idle');
  const router = useRouter();

  const handleFirstClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setState('confirming');
  }, []);

  const handleCancel = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setState('idle');
  }, []);

  const handleConfirm = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setState('loading');
    try {
      const res = await fetch(`/api/superadmin/users/${profileId}/purge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skip_confirm: true }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        alert(`Ошибка: ${json.error ?? res.status}`);
        setState('idle');
        return;
      }
      router.refresh();
    } catch {
      alert('Не удалось удалить пользователя');
      setState('idle');
    }
  }, [profileId, router]);

  if (state === 'loading') {
    return (
      <span className="flex items-center justify-center">
        <Loader2 className="size-3.5 animate-spin text-white/40" />
      </span>
    );
  }

  if (state === 'confirming') {
    return (
      <span className="flex items-center gap-1.5" title={`Удалить ${profileName}?`}>
        <button
          onClick={handleConfirm}
          className="rounded px-1.5 py-0.5 text-[11px] font-medium text-rose-300 hover:bg-rose-500/15 transition-colors"
        >
          Удалить
        </button>
        <button
          onClick={handleCancel}
          className="rounded px-1 py-0.5 text-[11px] text-white/40 hover:text-white/70 transition-colors"
        >
          Отмена
        </button>
      </span>
    );
  }

  return (
    <button
      onClick={handleFirstClick}
      title={`Удалить ${profileName}`}
      className="grid size-6 place-items-center rounded text-white/20 transition-colors hover:bg-rose-500/10 hover:text-rose-400"
    >
      <Trash2 className="size-3.5" />
    </button>
  );
}
