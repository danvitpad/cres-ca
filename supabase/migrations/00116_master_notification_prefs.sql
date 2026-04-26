-- 00116: персональные настройки уведомлений мастера в TG.
-- Эти переключатели управляют ТЕМ что приходит САМОМУ мастеру (про его клиентов,
-- ДР, напоминания о визитах). Это другое чем masters.public_language /
-- master_automation_settings — те управляют сообщениями ДЛЯ клиентов.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notif_birthdays boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_appointments boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_new_clients boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_payments boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_marketing_tips boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.notif_birthdays IS 'Получать TG-пуши о ДР клиентов и партнёров';
COMMENT ON COLUMN public.profiles.notif_appointments IS 'Получать напоминания о визитах за 30 минут (бриф мастеру)';
COMMENT ON COLUMN public.profiles.notif_new_clients IS 'Получать пуш когда новый клиент подписался на мастера';
COMMENT ON COLUMN public.profiles.notif_payments IS 'Получать пуш о новых платежах / отменах с возмещением';
COMMENT ON COLUMN public.profiles.notif_marketing_tips IS 'Получать советы от AI-помощника (выкл по умолчанию)';
