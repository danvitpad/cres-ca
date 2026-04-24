/** --- YAML
 * name: Notifications settings
 * description: Flexible notification timing preferences. Works for everyone — client, master, team.
 * created: 2026-04-24
 * --- */

'use client';

import Link from 'next/link';
import { ArrowLeft, Bell } from 'lucide-react';
import { NotificationPreferencesEditor } from '@/components/notifications/notification-preferences-editor';

export default function NotificationsSettingsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6 pb-12">
      <Link href="/settings" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" />
        Настройки
      </Link>

      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Bell className="size-6 text-primary" />
          Напоминания
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Настрой когда и как часто получать напоминания о своих визитах. Можно добавить несколько — например «за 2 дня» + «за 2 часа» + «за 15 минут».
        </p>
      </div>

      <NotificationPreferencesEditor theme="light" />
    </div>
  );
}
