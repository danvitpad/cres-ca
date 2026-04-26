-- 00112: анонимные отзывы. Клиент может оставить отзыв не показывая своё имя.
-- Используем при рендере: если is_anonymous=true — публично показываем «Анонимный клиент»
-- вместо имени. Для мастера в его кабинете имя видно всегда (чтобы знать кто оставил
-- негатив и обработать).

ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS is_anonymous boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.reviews.is_anonymous IS
  'Если true — публично имя автора скрыто. Мастер всё ещё видит автора в своей админке.';
