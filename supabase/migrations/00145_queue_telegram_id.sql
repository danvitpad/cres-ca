-- P4.4: Add client_telegram_id to queue_entries for push notifications
ALTER TABLE queue_entries
  ADD COLUMN IF NOT EXISTS client_telegram_id bigint;

CREATE INDEX IF NOT EXISTS queue_entries_tg_idx ON queue_entries(master_id, client_telegram_id, status);
