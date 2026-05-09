/** --- YAML
 * name: Notify friends on birthday
 * description: Adds notif_friend_birthdays toggle to notification_preferences.
 *   Default true — клиент получает уведомление в TG когда у его друга
 *   (взаимная подписка через follows) день рождения. Управляется
 *   тумблером в Mini App клиента → Настройки → Уведомления.
 * created: 2026-05-09
 * --- */

alter table public.notification_preferences
  add column if not exists notif_friend_birthdays boolean not null default true;

comment on column public.notification_preferences.notif_friend_birthdays is
  'Send TG notification when a mutually-followed friend has a birthday today.';
