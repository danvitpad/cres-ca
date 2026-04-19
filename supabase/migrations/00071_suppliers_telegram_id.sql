-- Phase 7: add telegram chat/user id to suppliers for bot-DM order dispatch.
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS telegram_id TEXT;
COMMENT ON COLUMN public.suppliers.telegram_id IS 'Telegram chat/user ID for sending supplier orders via bot DM. Numeric (e.g., 123456789) for user chats.';
