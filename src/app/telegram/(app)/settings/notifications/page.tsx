/** --- YAML
 * name: Client Mini App notifications settings
 * description: Notification timing preferences — dark theme for Mini App.
 * created: 2026-04-24
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ChevronLeft, Bell, Cake } from 'lucide-react';
import { NotificationPreferencesEditor } from '@/components/notifications/notification-preferences-editor';
import { haptic } from '@/lib/telegram/webapp';

export default function MiniAppNotificationsPage() {
  const router = useRouter();
  const [friendBday, setFriendBday] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/me/notification-preferences')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { notif_friend_birthdays?: boolean } | null) => {
        if (!data) return;
        setFriendBday(data.notif_friend_birthdays !== false);
      })
      .catch(() => { /* tolerant */ });
  }, []);

  async function toggleFriendBday() {
    if (busy || friendBday === null) return;
    haptic.selection();
    const next = !friendBday;
    setBusy(true);
    setFriendBday(next);
    try {
      await fetch('/api/me/notification-preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notif_friend_birthdays: next }),
      });
    } catch { /* tolerant */ }
    setBusy(false);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-5 px-5 pt-4 pb-20"
    >
      <div className="flex items-center gap-3">
        <button
          onClick={() => { haptic.impact('light'); router.back(); }}
          className="flex size-9 items-center justify-center rounded-full border border-neutral-200 bg-white active:bg-neutral-50 transition-colors"
          aria-label="Назад"
        >
          <ChevronLeft className="size-5" />
        </button>
        <div>
          <h1 className="flex items-center gap-2 text-[22px] font-bold">
            <Bell className="size-5 text-teal-500" />
            Уведомления
          </h1>
          <p className="text-[12px] text-neutral-500">
            Когда и о чём получать уведомления в Telegram
          </p>
        </div>
      </div>

      <NotificationPreferencesEditor theme="miniapp" />

      {/* Друзья: тумблер уведомлений о ДР друзей */}
      {friendBday !== null && (
        <div className="rounded-2xl border border-neutral-200 bg-white p-4">
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-pink-50 text-pink-600">
              <Cake className="size-4" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-semibold text-neutral-900">Дни рождения друзей</p>
              <p className="text-[11px] text-neutral-500 mt-0.5">
                Утренний пуш когда у твоего друга (взаимная подписка) день рождения
              </p>
            </div>
            <button
              type="button"
              onClick={toggleFriendBday}
              disabled={busy}
              role="switch"
              aria-checked={friendBday}
              className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                friendBday ? 'bg-teal-500' : 'bg-neutral-300'
              }`}
            >
              <span
                className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${
                  friendBday ? 'left-6' : 'left-1'
                }`}
              />
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
