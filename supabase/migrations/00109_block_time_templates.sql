-- 00109: шаблоны заблокированного времени.
-- Мастер сохраняет «Обед 40 мин», «Приём лекарств 5 мин» и т.д.,
-- потом одним кликом блокирует это время на любом слоте без
-- перепечатывания заголовка/длительности.

CREATE TABLE IF NOT EXISTS public.block_time_templates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id       uuid NOT NULL REFERENCES masters(id) ON DELETE CASCADE,
  title           text NOT NULL,
  duration_minutes integer NOT NULL CHECK (duration_minutes > 0 AND duration_minutes <= 24 * 60),
  emoji           text,
  sort_order      integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS block_time_templates_master_idx
  ON public.block_time_templates (master_id, sort_order);

ALTER TABLE public.block_time_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS block_time_templates_owner_select ON block_time_templates;
CREATE POLICY block_time_templates_owner_select ON block_time_templates
  FOR SELECT USING (master_id IN (SELECT id FROM masters WHERE profile_id = auth.uid()));

DROP POLICY IF EXISTS block_time_templates_owner_insert ON block_time_templates;
CREATE POLICY block_time_templates_owner_insert ON block_time_templates
  FOR INSERT WITH CHECK (master_id IN (SELECT id FROM masters WHERE profile_id = auth.uid()));

DROP POLICY IF EXISTS block_time_templates_owner_update ON block_time_templates;
CREATE POLICY block_time_templates_owner_update ON block_time_templates
  FOR UPDATE USING (master_id IN (SELECT id FROM masters WHERE profile_id = auth.uid()));

DROP POLICY IF EXISTS block_time_templates_owner_delete ON block_time_templates;
CREATE POLICY block_time_templates_owner_delete ON block_time_templates
  FOR DELETE USING (master_id IN (SELECT id FROM masters WHERE profile_id = auth.uid()));

-- Авто-обновление updated_at
CREATE OR REPLACE FUNCTION touch_block_time_template_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS block_time_templates_touch_updated_at ON block_time_templates;
CREATE TRIGGER block_time_templates_touch_updated_at
BEFORE UPDATE ON block_time_templates
FOR EACH ROW EXECUTE FUNCTION touch_block_time_template_updated_at();
