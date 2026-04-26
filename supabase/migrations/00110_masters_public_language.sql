-- 00110: публичный язык мастера — для всех ИСХОДЯЩИХ коммуникаций
-- (рассылки клиентам, заказы поставщикам, уведомления партнёрам).
-- Может отличаться от языка интерфейса самого мастера.
--
-- Уникальная фича: интерфейс может быть русским, а уведомления клиентам —
-- украинскими/английскими.

ALTER TABLE public.masters
  ADD COLUMN IF NOT EXISTS public_language varchar(2) NOT NULL DEFAULT 'ru'
    CHECK (public_language IN ('ru', 'uk', 'en'));

COMMENT ON COLUMN public.masters.public_language IS
  'Язык исходящих коммуникаций (рассылки, заказы поставщикам, partners). Default ru.';
