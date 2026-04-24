-- --- YAML
-- name: Master booking important info
-- description: Free-form text the master fills in settings; shown to clients on the booking
--              confirmation step (mirrors Fresha's "Важная информация" block).
-- created: 2026-04-24
-- ---

ALTER TABLE masters
  ADD COLUMN IF NOT EXISTS booking_important_info text;

COMMENT ON COLUMN masters.booking_important_info IS
  'Plain text shown to clients on the booking confirmation page. Line breaks preserved.';
