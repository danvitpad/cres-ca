-- 00111: ручной tier override для мастера.
-- Сейчас tier высчитывается автоматически (по визитам/тратам). Мастер
-- хочет иметь возможность ВРУЧНУЮ присвоить VIP / постоянный, обходя
-- автологику (например — давний клиент-друг семьи всегда VIP, даже если
-- ходит редко).
--
-- manual_tier_set_at = когда выставлен — для будущей логики «проверить и
-- автоматически снять VIP, если клиент год не приходит» (не сейчас).

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS manual_tier client_tier_t,
  ADD COLUMN IF NOT EXISTS manual_tier_set_at timestamptz;

COMMENT ON COLUMN public.clients.manual_tier IS
  'Ручной tier-override от мастера. Если задан — приоритетнее автоматического tier.';
