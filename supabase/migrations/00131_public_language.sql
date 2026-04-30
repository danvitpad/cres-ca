-- Шаг 20 release-checklist: язык интерфейса vs публичный язык.
-- profiles.ui_language — что юзер выбрал в UI (персональные уведомления, письма).
-- profiles.public_language — на каком языке мастер/команда шлют клиентам и
--   поставщикам (по умолчанию = ui_language, можно переопределить в Settings).

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS public_language text;

-- Дефолт: copy из ui_language для существующих пользователей.
UPDATE profiles
SET public_language = COALESCE(ui_language, locale, 'ru')
WHERE public_language IS NULL;

-- Constraint: только поддерживаемые языки.
ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_public_language_check;
ALTER TABLE profiles
  ADD CONSTRAINT profiles_public_language_check
  CHECK (public_language IS NULL OR public_language IN ('ru', 'uk', 'en'));

-- Индекс не нужен (поле всегда читается вместе с профилем).
