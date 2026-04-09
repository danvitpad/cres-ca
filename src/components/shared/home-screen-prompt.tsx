/** --- YAML
 * name: HomeScreenPrompt
 * description: Telegram Add to Home Screen prompt shown after 3rd use
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { Smartphone, X } from 'lucide-react';
import { tg, isTelegram } from '@/lib/telegram/webapp';
import { getCloudItem, setCloudItem, CLOUD_KEYS } from '@/lib/telegram/cloud-storage';

export function HomeScreenPrompt() {
  const t = useTranslations('telegram');
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!isTelegram()) return;

    async function check() {
      // Already prompted?
      const prompted = await getCloudItem(CLOUD_KEYS.HOME_SCREEN_PROMPTED);
      if (prompted === 'true') return;

      // Track usage count
      const countStr = await getCloudItem('usage_count');
      const count = parseInt(countStr ?? '0', 10) + 1;
      await setCloudItem('usage_count', String(count));

      if (count < 3) return;

      // Check if already added
      try {
        tg()!.checkHomeScreenStatus((status) => {
          if (status !== 'added') {
            setShow(true);
          }
        });
      } catch {
        // Older clients don't support this
        setShow(true);
      }
    }

    const timer = setTimeout(check, 3000);
    return () => clearTimeout(timer);
  }, []);

  async function addToHome() {
    try {
      tg()!.addToHomeScreen();
    } catch {
      // Older clients
    }
    await setCloudItem(CLOUD_KEYS.HOME_SCREEN_PROMPTED, 'true');
    setShow(false);
  }

  async function dismiss() {
    await setCloudItem(CLOUD_KEYS.HOME_SCREEN_PROMPTED, 'true');
    setShow(false);
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          className="fixed bottom-20 left-4 right-4 z-50 rounded-[var(--radius-card)] border bg-card p-3 shadow-[var(--shadow-elevated)]"
        >
          <button
            onClick={dismiss}
            className="absolute right-2 top-2 p-1 text-muted-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--ds-accent-soft)] text-[var(--ds-accent)]">
              <Smartphone className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold">{t('addToHome')}</p>
              <p className="text-[10px] text-muted-foreground">{t('addToHomeDescription')}</p>
            </div>
            <button
              onClick={addToHome}
              className="shrink-0 rounded-[var(--radius-button)] bg-[var(--ds-accent)] px-3 py-1.5 text-xs font-medium text-white"
            >
              {t('add')}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
