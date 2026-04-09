/** --- YAML
 * name: PushPermission
 * description: Web push notification opt-in prompt with subscription management
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export function PushPermission() {
  const t = useTranslations('notifications');
  const [show, setShow] = useState(false);
  const [subscribing, setSubscribing] = useState(false);

  useEffect(() => {
    // Only show if browser supports push and user hasn't decided yet
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    if (Notification.permission !== 'default') return;

    // Check if user dismissed before
    const dismissed = localStorage.getItem('push-dismissed');
    if (dismissed) return;

    // Show after a delay
    const timer = setTimeout(() => setShow(true), 5000);
    return () => clearTimeout(timer);
  }, []);

  async function subscribe() {
    setSubscribing(true);
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      const permission = await Notification.requestPermission();

      if (permission !== 'granted') {
        setShow(false);
        return;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      });

      // Save subscription to profile
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('profiles')
          .update({ push_subscription: subscription.toJSON() })
          .eq('id', user.id);
      }

      setShow(false);
    } catch {
      setShow(false);
    } finally {
      setSubscribing(false);
    }
  }

  function dismiss() {
    localStorage.setItem('push-dismissed', '1');
    setShow(false);
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-20 left-4 right-4 z-50 rounded-[var(--radius-card)] border bg-card p-4 shadow-[var(--shadow-elevated)]"
        >
          <button
            onClick={dismiss}
            className="absolute right-2 top-2 p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--ds-accent-soft)] text-[var(--ds-accent)]">
              <Bell className="h-5 w-5" />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold">{t('enablePush')}</p>
              <p className="text-xs text-muted-foreground">{t('enablePushDescription')}</p>
              <button
                onClick={subscribe}
                disabled={subscribing}
                className="rounded-[var(--radius-button)] bg-[var(--ds-accent)] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[var(--ds-accent-hover)] disabled:opacity-50"
              >
                {subscribing ? t('enabling') : t('enable')}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
