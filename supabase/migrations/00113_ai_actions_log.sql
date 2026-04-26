-- 00113: лог действий AI-помощника + snapshot для undo.
-- Каждый раз когда AI выполнил действие в /finance (или в /clients и т.д.) —
-- мы сохраняем сюда: scope, action, before_json (snapshot строки до изменения),
-- after_json (snapshot после), reverted_at (если откачено).
--
-- Кнопка «Откатить» в UI читает свежие записи и восстанавливает before_json.

CREATE TABLE IF NOT EXISTS public.ai_actions_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id       uuid NOT NULL REFERENCES masters(id) ON DELETE CASCADE,
  scope           text NOT NULL,
  action          text NOT NULL,
  table_name      text NOT NULL,
  row_id          uuid,
  before_json     jsonb,
  after_json      jsonb,
  user_question   text,
  ai_response     text,
  reverted_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_actions_log_master_recent_idx
  ON public.ai_actions_log (master_id, created_at DESC);

ALTER TABLE public.ai_actions_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_actions_log_owner_select ON ai_actions_log;
CREATE POLICY ai_actions_log_owner_select ON ai_actions_log
  FOR SELECT USING (master_id IN (SELECT id FROM masters WHERE profile_id = auth.uid()));

DROP POLICY IF EXISTS ai_actions_log_owner_insert ON ai_actions_log;
CREATE POLICY ai_actions_log_owner_insert ON ai_actions_log
  FOR INSERT WITH CHECK (master_id IN (SELECT id FROM masters WHERE profile_id = auth.uid()));

DROP POLICY IF EXISTS ai_actions_log_owner_update ON ai_actions_log;
CREATE POLICY ai_actions_log_owner_update ON ai_actions_log
  FOR UPDATE USING (master_id IN (SELECT id FROM masters WHERE profile_id = auth.uid()));
