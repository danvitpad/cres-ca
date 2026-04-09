/** --- YAML
 * name: useTelegramButtons
 * description: Hooks for Telegram MainButton, SecondaryButton, and BackButton control
 * --- */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { tg, isTelegram } from '@/lib/telegram/webapp';

interface MainButtonOptions {
  color?: string;
  textColor?: string;
  isActive?: boolean;
  hasShineEffect?: boolean;
}

export function useTelegramMainButton(
  text: string,
  onClick: () => void,
  options?: MainButtonOptions,
) {
  useEffect(() => {
    if (!isTelegram()) return;
    const btn = tg()?.MainButton;
    if (!btn) return;

    btn.setText(text);
    if (options?.color) btn.color = options.color;
    if (options?.textColor) btn.textColor = options.textColor;
    if (options?.hasShineEffect !== undefined) btn.hasShineEffect = options.hasShineEffect;
    btn.onClick(onClick);
    btn.show();

    return () => {
      btn.offClick(onClick);
      btn.hide();
    };
  }, [text, onClick, options?.color, options?.textColor, options?.hasShineEffect]);
}

export function useTelegramSecondaryButton(
  text: string,
  onClick: () => void,
) {
  useEffect(() => {
    if (!isTelegram()) return;
    const btn = tg()?.SecondaryButton;
    if (!btn) return;

    btn.setText(text);
    btn.onClick(onClick);
    btn.show();

    return () => {
      btn.offClick(onClick);
      btn.hide();
    };
  }, [text, onClick]);
}

export function useTelegramBackButton(enabled = true) {
  const router = useRouter();

  useEffect(() => {
    if (!isTelegram()) return;
    const btn = tg()?.BackButton;
    if (!btn) return;

    const handler = () => router.back();

    if (enabled) {
      btn.onClick(handler);
      btn.show();
    } else {
      btn.hide();
    }

    return () => {
      btn.offClick(handler);
      btn.hide();
    };
  }, [enabled, router]);
}
