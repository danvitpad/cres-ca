-- 00115: синхронизированные UI-настройки между web и Mini App.
-- Раньше тема жила в localStorage (next-themes), язык интерфейса — в cookie.
-- Это значит мастер настроил тёмную тему + украинский язык в телефоне,
-- а на десктопе всё по умолчанию.
--
-- Решение: единый источник правды в profiles. Любая сторона при сохранении
-- — пишет в БД, при загрузке — читает оттуда и применяет.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ui_theme varchar(8) NOT NULL DEFAULT 'auto'
    CHECK (ui_theme IN ('auto', 'light', 'dark')),
  ADD COLUMN IF NOT EXISTS ui_language varchar(2) NOT NULL DEFAULT 'ru'
    CHECK (ui_language IN ('ru', 'uk', 'en'));

COMMENT ON COLUMN public.profiles.ui_theme IS
  'Тема интерфейса: auto (как в системе) / light / dark. Синхронизируется между web и Mini App.';

COMMENT ON COLUMN public.profiles.ui_language IS
  'Язык интерфейса самого пользователя (ru/uk/en). Не путать с masters.public_language — это для отправляемых клиентам уведомлений.';
