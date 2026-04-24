/** --- YAML
 * name: 00089_cron_notifications_realtime
 * description: Переводит уведомления + напоминания + voice-reminders в near-realtime (каждые 5 мин)
 *              вместо раз в сутки. Без этого личные reminder'ы и 2h-reminder'ы о визитах могут задерживаться до 24ч.
 * created: 2026-04-24
 * --- */

-- Unschedule old daily jobs (если крутились)
do $$
declare j text;
begin
  for j in select jobname from cron.job where jobname in (
    'notifications-daily',
    'reminders-daily',
    'voice-reminders-minute',
    'notifications-every-5-min',
    'reminders-every-15-min',
    'voice-reminders-every-2-min'
  ) loop
    perform cron.unschedule(j);
  end loop;
exception when others then null;
end $$;

-- Уведомления (appointments 24h/2h, клиентам, бэджи, события) — раз в 5 мин
select cron.schedule(
  'notifications-every-5-min',
  '*/5 * * * *',
  $$select public.call_vercel_cron('/api/cron/notifications')$$
);

-- Создание reminder-уведомлений по встречам (24h / 2h / 30min) — каждые 15 мин
-- Чтобы только-что созданные/перенесённые записи тоже получили свои reminder'ы
select cron.schedule(
  'reminders-every-15-min',
  '*/15 * * * *',
  $$select public.call_vercel_cron('/api/cron/reminders')$$
);

-- Личные reminder'ы (напомни папе купить кроссовки) — каждые 2 мин (они time-sensitive)
select cron.schedule(
  'voice-reminders-every-2-min',
  '*/2 * * * *',
  $$select public.call_vercel_cron('/api/cron/voice-reminders')$$
);

comment on extension pg_cron is
  'Realtime schedules for notifications. Daily batches оставлены в vercel.json (они всё равно не критичные по времени).';
