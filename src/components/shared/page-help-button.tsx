/** --- YAML
 * name: PageHelpButton
 * description: Floating help button (fixed bottom-right) — clicks open a
 *   plain-language explanation of the current dashboard section. Replaces
 *   the static beta.md page with on-demand contextual guidance.
 * created: 2026-05-01
 * --- */

'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { HelpCircle, X } from 'lucide-react';
import { resolvePageHelp } from '@/lib/page-help/dict';

export function PageHelpButton() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const help = resolvePageHelp(pathname);
  if (!help) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Подсказка по разделу"
        className="fixed z-40 bottom-6 right-6 h-11 w-11 rounded-full bg-card border shadow-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:scale-105 transition"
      >
        <HelpCircle className="h-5 w-5" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          onClick={() => setOpen(false)}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative z-10 w-full sm:max-w-md mx-auto bg-background border rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Подсказка</div>
                <h2 className="text-lg font-semibold mt-0.5">{help.title}</h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Закрыть"
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-sm leading-relaxed text-muted-foreground mb-4">{help.intro}</p>

            <ul className="space-y-2.5">
              {help.bullets.map((b, i) => (
                <li key={i} className="flex gap-2 text-sm leading-relaxed">
                  <span className="text-violet-500 shrink-0 mt-0.5">→</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>

            <div className="mt-5 pt-4 border-t text-xs text-muted-foreground text-center">
              Нужна более глубокая помощь?{' '}
              <a
                href="https://t.me/cres_ca_bot?start=support"
                target="_blank"
                rel="noopener noreferrer"
                className="text-violet-500 hover:underline"
              >
                Написать в поддержку
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
