/** --- YAML
 * name: Уменьшить грейс автозакрытия записей до 15 мин
 * description: Дефолт appointment_auto_close_hours был 1 час — доход и
 *              списание расходников появлялись только через час после
 *              окончания записи. Меняем на 0.25 (15 мин): достаточно чтобы
 *              мастер успел поставить «Не пришёл», но KPI обновляется быстро.
 * created: 2026-05-13
 * --- */

ALTER TABLE public.masters
  ALTER COLUMN appointment_auto_close_hours SET DEFAULT 0.25;

UPDATE public.masters
  SET appointment_auto_close_hours = 0.25
  WHERE appointment_auto_close_hours IS NULL OR appointment_auto_close_hours = 1;
