/** --- YAML
 * name: Расширение CHECK на message_templates.kind — booking-lifecycle шаблоны
 * description: До этого CHECK содержал только старые kind'ы (reminder_24h,
 *              reminder_2h, thanks, win_back, review_request, cadence, nps,
 *              custom). Когда мастер в Mini App сохранял шаблон «Подтверждение
 *              записи» / «Перенос» / «Отмена» — INSERT падал на check'е
 *              тихо (try/catch проглатывал), кастомный текст не писался, а
 *              dispatch_booking_notification всегда отдавал украинский дефолт.
 *              Добавляем три новых kind'а в whitelist.
 * created: 2026-05-13
 * --- */

ALTER TABLE public.message_templates DROP CONSTRAINT IF EXISTS message_templates_kind_check;
ALTER TABLE public.message_templates ADD CONSTRAINT message_templates_kind_check
  CHECK (kind = ANY (ARRAY[
    'reminder_24h','reminder_2h','thanks','win_back','review_request',
    'cadence','nps','custom',
    'booking_confirmation','appointment_rescheduled','appointment_cancelled'
  ]::text[]));
