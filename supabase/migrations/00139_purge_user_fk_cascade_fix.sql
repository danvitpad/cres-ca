-- 00139 · Чиним полное удаление пользователя.
-- Три таблицы (client_audit_log, master_team_invites, salon_join_requests) ссылались
-- на auth.users без CASCADE → DELETE FROM auth.users падал на FK.
-- Меняем на ON DELETE SET NULL — записи живут, актёр обнуляется.

ALTER TABLE client_audit_log
  DROP CONSTRAINT IF EXISTS client_audit_log_performed_by_fkey,
  ALTER COLUMN performed_by DROP NOT NULL,
  ADD CONSTRAINT client_audit_log_performed_by_fkey
    FOREIGN KEY (performed_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE master_team_invites
  DROP CONSTRAINT IF EXISTS master_team_invites_invited_by_fkey,
  ALTER COLUMN invited_by DROP NOT NULL,
  ADD CONSTRAINT master_team_invites_invited_by_fkey
    FOREIGN KEY (invited_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE salon_join_requests
  DROP CONSTRAINT IF EXISTS salon_join_requests_decided_by_fkey,
  ADD CONSTRAINT salon_join_requests_decided_by_fkey
    FOREIGN KEY (decided_by) REFERENCES auth.users(id) ON DELETE SET NULL;
