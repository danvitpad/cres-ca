/** --- YAML
 * name: Vertical Self-Learning Specializations
 * description: Сервис учится у мастеров. Когда мастер пишет свою специализацию
 *              в онбординге — мы её копим. Следующий мастер той же ниши видит
 *              её уже как готовый чип на этом шаге. Накопится «стретчинг»,
 *              «AI-инструктор», «реставратор антиквариата» — без хардкода.
 * created: 2026-04-27
 * --- */

CREATE TABLE IF NOT EXISTS public.vertical_specializations (
  vertical text NOT NULL,
  text_normalized text NOT NULL,
  text_display text NOT NULL,
  count int NOT NULL DEFAULT 1,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (vertical, text_normalized)
);

CREATE INDEX IF NOT EXISTS idx_vertical_specs_count
  ON public.vertical_specializations (vertical, count DESC);

ALTER TABLE public.vertical_specializations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vspec_public_read ON public.vertical_specializations;
CREATE POLICY vspec_public_read ON public.vertical_specializations
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE OR REPLACE FUNCTION public.bump_specialization_suggestion(p_vertical text, p_text text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_norm text;
  v_disp text;
BEGIN
  v_disp := btrim(p_text);
  IF v_disp = '' OR length(v_disp) > 80 OR p_vertical IS NULL THEN
    RETURN;
  END IF;
  v_norm := lower(v_disp);

  INSERT INTO public.vertical_specializations (vertical, text_normalized, text_display, count, first_seen_at, last_seen_at)
  VALUES (p_vertical, v_norm, v_disp, 1, now(), now())
  ON CONFLICT (vertical, text_normalized)
  DO UPDATE SET
    count = public.vertical_specializations.count + 1,
    last_seen_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.bump_specialization_suggestion(text, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.popular_specializations(p_vertical text, p_min_count int DEFAULT 2, p_limit int DEFAULT 30)
RETURNS TABLE (text_display text, count int)
LANGUAGE sql
STABLE
AS $$
  SELECT text_display, count
  FROM public.vertical_specializations
  WHERE vertical = p_vertical
    AND count >= p_min_count
  ORDER BY count DESC, text_display ASC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.popular_specializations(text, int, int) TO anon, authenticated, service_role;

COMMENT ON TABLE public.vertical_specializations IS 'Self-learning vault: специализации, которые мастера ввели вручную. Когда счётчик >= порога, показываются как чипы новым мастерам той же ниши.';
