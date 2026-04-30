/** --- YAML
 * name: Client Mini App notifications settings
 * description: Notification timing preferences — dark theme for Mini App.
 * created: 2026-04-24
 * --- */

'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ChevronLeft, Bell } from 'lucide-react';
import { NotificationPreferencesEditor } from '@/components/notifications/notification-preferences-editor';

export default function MiniAppNotificationsPage() {
  const router = useRouter();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-5 px-5 pt-4 pb-20"
    >
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="flex size-9 items-center justify-center rounded-full border border-neutral-200 bg-white active:bg-neutral-50 transition-colors"
          aria-label="Назад"
        >
          <ChevronLeft className="size-5" />
        </button>
        <div>
          <h1 className="flex items-center gap-2 text-[22px] font-bold">
            <Bell className="size-5 text-violet-400" />
            Напоминания
          </h1>
          <p className="text-[12px] text-neutral-500">
            Когда и как часто получать уведомления о визитах
          </p>
        </div>
      </div>

      <NotificationPreferencesEditor theme="dark" />
    </motion.div>
  );
}
