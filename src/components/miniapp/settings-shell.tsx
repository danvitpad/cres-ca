/** --- YAML
 * name: MiniAppSettingsShell
 * description: Shared header for /telegram/m/settings/* sub-pages — back arrow, title, scrollable body.
 * created: 2026-04-20
 * --- */

'use client';

import Link from 'next/link';
import { ArrowLeft } from '@phosphor-icons/react';
import { useTelegram } from '@/components/miniapp/telegram-provider';
import { useMiniAppLocale } from '@/lib/miniapp/use-locale';

const BACK_LABEL: Record<'uk' | 'ru' | 'en', string> = {
  uk: 'Назад', ru: 'Назад', en: 'Back',
};

export function SettingsShell({
  title,
  subtitle,
  children,
  back = '/telegram/m/settings',
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  back?: string;
}) {
  const { haptic } = useTelegram();
  const lang = useMiniAppLocale();
  return (
    <div
      className="px-5 pt-4 pb-[calc(8rem+env(safe-area-inset-bottom,0px))]"
      style={{ overflowX: 'hidden' }}
    >
      <Link
        href={back}
        onClick={() => haptic('light')}
        className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-[12px] text-neutral-700 active:bg-neutral-50 transition-colors"
      >
        <ArrowLeft size={13} weight="bold" />
        {BACK_LABEL[lang]}
      </Link>
      <h1 className="text-[22px] font-bold leading-tight">{title}</h1>
      {subtitle && <p className="mt-1 text-[13px] text-neutral-500">{subtitle}</p>}
      <div className="mt-5 space-y-4">{children}</div>
    </div>
  );
}
