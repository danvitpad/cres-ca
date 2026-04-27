/** --- YAML
 * name: Appointment Auto-Close Defaults
 * description: Дефолт — авто-завершение через 1 час после ends_at, чтобы мастер не тыкал
 *              «Оформить» вручную. Cron /api/cron/appointment-close раз в 30 минут берёт
 *              все активные просроченные записи и закрывает их (либо шлёт TG-подтверждение
 *              если у мастера выбран mode='confirm').
 * created: 2026-04-27
 * --- */

-- Колонки настроек на masters (idempotent — могут уже существовать)
ALTER TABLE public.masters
  ADD COLUMN IF NOT EXISTS appointment_close_mode text DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS appointment_auto_close_hours int DEFAULT 1;

-- Перевыставляем дефолт на 'auto' / 1 для новых мастеров
ALTER TABLE public.masters
  ALTER COLUMN appointment_close_mode SET DEFAULT 'auto';
ALTER TABLE public.masters
  ALTER COLUMN appointment_auto_close_hours SET DEFAULT 1;

-- Поля у appointments (служебные, для cron)
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS auto_closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS close_pending_sent_at timestamptz;

-- Бэкфилл: NULL → 'auto'
UPDATE public.masters SET appointment_close_mode = 'auto' WHERE appointment_close_mode IS NULL;
UPDATE public.masters SET appointment_auto_close_hours = 1 WHERE appointment_auto_close_hours IS NULL;

COMMENT ON COLUMN public.masters.appointment_close_mode IS 'auto = automatic completion after grace window; confirm = TG prompt then grace window';
COMMENT ON COLUMN public.masters.appointment_auto_close_hours IS 'Hours after ends_at before cron auto-completes (default 1)';
