/** --- YAML
 * name: Public page banner
 * description: Shows the master's public URL on their dashboard with copy + open actions.
 *              Visibility states reflect reality: visible / needs_subscription / hidden / no_slug yet.
 * created: 2026-04-24
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { Globe, Copy, ExternalLink, Check, AlertTriangle, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

interface State {
  kind: 'not_master' | 'master';
  slug?: string | null;
  url?: string | null;
  visibility?: 'visible' | 'hidden_by_master' | 'needs_subscription' | 'no_slug';
}

export function PublicPageBanner() {
  const [state, setState] = useState<State | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch('/api/me/public-url')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: State | null) => setState(d))
      .catch(() => setState(null));
  }, []);

  if (!state || state.kind !== 'master') return null;

  const copy = async () => {
    if (!state.url) return;
    try {
      await navigator.clipboard.writeText(state.url);
      setCopied(true);
      toast.success('Ссылка скопирована');
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Не удалось скопировать');
    }
  };

  if (state.visibility === 'needs_subscription') {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Твой профиль скрыт из поиска</p>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">
            Чтобы клиенты находили тебя в Google и через AI-консьерж — нужна активная подписка.
          </p>
        </div>
      </div>
    );
  }

  if (state.visibility === 'hidden_by_master') {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-neutral-500/30 bg-neutral-500/5 p-4">
        <EyeOff className="mt-0.5 size-4 shrink-0 text-neutral-500" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Профиль скрыт</p>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">
            Публичная страница выключена. Клиенты тебя не найдут через поиск.
          </p>
        </div>
      </div>
    );
  }

  if (state.visibility === 'no_slug' || !state.url) {
    return null;
  }

  // Visible — show the URL prominently
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-violet-400/30 bg-violet-500/5 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-full bg-violet-500/15 text-violet-600">
          <Globe className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-violet-600/80">
            Твоя публичная страница
          </p>
          <code className="mt-0.5 block truncate text-sm font-medium text-neutral-900 dark:text-white">
            {state.url.replace(/^https?:\/\//, '')}
          </code>
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        <button
          onClick={copy}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-violet-400/30 bg-violet-500/10 px-3 text-xs font-medium text-violet-700 hover:bg-violet-500/15 dark:text-violet-200"
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? 'Скопировано' : 'Копировать'}
        </button>
        <a
          href={state.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-violet-600 px-3 text-xs font-semibold text-white hover:bg-violet-700"
        >
          <ExternalLink className="size-3.5" />
          Открыть
        </a>
      </div>
    </div>
  );
}
