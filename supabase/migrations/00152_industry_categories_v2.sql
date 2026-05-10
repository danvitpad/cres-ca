/** --- YAML
 * name: Industry Categories v2
 * description: Структурированный каталог категорий и подкатегорий для мастеров.
 *              Заменяет одиночное поле masters.vertical + свободный текст
 *              specialization. Мастер выбирает несколько категорий + одну
 *              основную + любое число подкатегорий. Подкатегория автоапрувится
 *              когда её выбрали 3+ мастера. Новая категория — pending до
 *              ручного апрува суперадмином (TG-бот).
 * created: 2026-05-10
 * --- */

-- Каталог категорий мастеров
CREATE TABLE IF NOT EXISTS public.industry_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  name_ru text NOT NULL,
  name_uk text NOT NULL,
  name_en text NOT NULL,
  icon text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','pending','rejected')),
  is_system boolean NOT NULL DEFAULT false,
  master_count int NOT NULL DEFAULT 0,
  created_by_master_id uuid REFERENCES public.masters(id) ON DELETE SET NULL,
  sort_order int NOT NULL DEFAULT 100,
  legacy_vertical_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS industry_categories_status_idx ON public.industry_categories (status);
CREATE INDEX IF NOT EXISTS industry_categories_master_count_idx ON public.industry_categories (master_count DESC);

CREATE TABLE IF NOT EXISTS public.industry_subcategories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.industry_categories(id) ON DELETE CASCADE,
  key text NOT NULL,
  name_ru text NOT NULL,
  name_uk text NOT NULL,
  name_en text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','pending','rejected')),
  is_system boolean NOT NULL DEFAULT false,
  master_count int NOT NULL DEFAULT 0,
  created_by_master_id uuid REFERENCES public.masters(id) ON DELETE SET NULL,
  sort_order int NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (category_id, key)
);

CREATE INDEX IF NOT EXISTS industry_subcategories_cat_idx ON public.industry_subcategories (category_id, status);
CREATE INDEX IF NOT EXISTS industry_subcategories_status_idx ON public.industry_subcategories (status);
CREATE INDEX IF NOT EXISTS industry_subcategories_master_count_idx ON public.industry_subcategories (master_count DESC);
CREATE INDEX IF NOT EXISTS industry_subcategories_name_ru_lower_idx ON public.industry_subcategories ((lower(name_ru)));

CREATE TABLE IF NOT EXISTS public.master_industry_categories (
  master_id uuid NOT NULL REFERENCES public.masters(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.industry_categories(id) ON DELETE CASCADE,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (master_id, category_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS master_industry_primary_uniq
  ON public.master_industry_categories (master_id) WHERE is_primary = true;
CREATE INDEX IF NOT EXISTS master_industry_categories_cat_idx
  ON public.master_industry_categories (category_id);

CREATE TABLE IF NOT EXISTS public.master_industry_subcategories (
  master_id uuid NOT NULL REFERENCES public.masters(id) ON DELETE CASCADE,
  subcategory_id uuid NOT NULL REFERENCES public.industry_subcategories(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (master_id, subcategory_id)
);

CREATE INDEX IF NOT EXISTS master_industry_subcategories_sub_idx
  ON public.master_industry_subcategories (subcategory_id);

ALTER TABLE public.industry_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.industry_subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_industry_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_industry_subcategories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS industry_categories_public_read ON public.industry_categories;
CREATE POLICY industry_categories_public_read ON public.industry_categories
  FOR SELECT TO anon, authenticated
  USING (status = 'active');

DROP POLICY IF EXISTS industry_categories_self_pending_read ON public.industry_categories;
CREATE POLICY industry_categories_self_pending_read ON public.industry_categories
  FOR SELECT TO authenticated
  USING (status <> 'active' AND created_by_master_id IN (SELECT id FROM public.masters WHERE profile_id = auth.uid()));

DROP POLICY IF EXISTS industry_subcategories_public_read ON public.industry_subcategories;
CREATE POLICY industry_subcategories_public_read ON public.industry_subcategories
  FOR SELECT TO anon, authenticated
  USING (status = 'active');

DROP POLICY IF EXISTS industry_subcategories_self_pending_read ON public.industry_subcategories;
CREATE POLICY industry_subcategories_self_pending_read ON public.industry_subcategories
  FOR SELECT TO authenticated
  USING (status <> 'active' AND created_by_master_id IN (SELECT id FROM public.masters WHERE profile_id = auth.uid()));

DROP POLICY IF EXISTS master_industry_categories_public_read ON public.master_industry_categories;
CREATE POLICY master_industry_categories_public_read ON public.master_industry_categories
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS master_industry_categories_self_write ON public.master_industry_categories;
CREATE POLICY master_industry_categories_self_write ON public.master_industry_categories
  FOR INSERT TO authenticated
  WITH CHECK (master_id IN (SELECT id FROM public.masters WHERE profile_id = auth.uid()));

DROP POLICY IF EXISTS master_industry_categories_self_update ON public.master_industry_categories;
CREATE POLICY master_industry_categories_self_update ON public.master_industry_categories
  FOR UPDATE TO authenticated
  USING (master_id IN (SELECT id FROM public.masters WHERE profile_id = auth.uid()))
  WITH CHECK (master_id IN (SELECT id FROM public.masters WHERE profile_id = auth.uid()));

DROP POLICY IF EXISTS master_industry_categories_self_delete ON public.master_industry_categories;
CREATE POLICY master_industry_categories_self_delete ON public.master_industry_categories
  FOR DELETE TO authenticated
  USING (master_id IN (SELECT id FROM public.masters WHERE profile_id = auth.uid()));

DROP POLICY IF EXISTS master_industry_subcategories_public_read ON public.master_industry_subcategories;
CREATE POLICY master_industry_subcategories_public_read ON public.master_industry_subcategories
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS master_industry_subcategories_self_write ON public.master_industry_subcategories;
CREATE POLICY master_industry_subcategories_self_write ON public.master_industry_subcategories
  FOR INSERT TO authenticated
  WITH CHECK (master_id IN (SELECT id FROM public.masters WHERE profile_id = auth.uid()));

DROP POLICY IF EXISTS master_industry_subcategories_self_delete ON public.master_industry_subcategories;
CREATE POLICY master_industry_subcategories_self_delete ON public.master_industry_subcategories
  FOR DELETE TO authenticated
  USING (master_id IN (SELECT id FROM public.masters WHERE profile_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.bump_industry_category_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.industry_categories
    SET master_count = master_count + 1, updated_at = now()
    WHERE id = NEW.category_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.industry_categories
    SET master_count = GREATEST(master_count - 1, 0), updated_at = now()
    WHERE id = OLD.category_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_bump_industry_category_count ON public.master_industry_categories;
CREATE TRIGGER trg_bump_industry_category_count
AFTER INSERT OR DELETE ON public.master_industry_categories
FOR EACH ROW EXECUTE FUNCTION public.bump_industry_category_count();

CREATE OR REPLACE FUNCTION public.bump_industry_subcategory_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_new_count int;
  v_status text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.industry_subcategories
    SET master_count = master_count + 1, updated_at = now()
    WHERE id = NEW.subcategory_id
    RETURNING master_count, status INTO v_new_count, v_status;
    IF v_status = 'pending' AND v_new_count >= 3 THEN
      UPDATE public.industry_subcategories SET status = 'active', updated_at = now()
      WHERE id = NEW.subcategory_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.industry_subcategories
    SET master_count = GREATEST(master_count - 1, 0), updated_at = now()
    WHERE id = OLD.subcategory_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_bump_industry_subcategory_count ON public.master_industry_subcategories;
CREATE TRIGGER trg_bump_industry_subcategory_count
AFTER INSERT OR DELETE ON public.master_industry_subcategories
FOR EACH ROW EXECUTE FUNCTION public.bump_industry_subcategory_count();

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_industry_categories_touch_updated_at ON public.industry_categories;
CREATE TRIGGER trg_industry_categories_touch_updated_at
BEFORE UPDATE ON public.industry_categories
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_industry_subcategories_touch_updated_at ON public.industry_subcategories;
CREATE TRIGGER trg_industry_subcategories_touch_updated_at
BEFORE UPDATE ON public.industry_subcategories
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

COMMENT ON TABLE public.industry_categories IS 'Каталог категорий мастеров (10 системных + созданные пользователями pending). Выбирается в онбординге, фильтр в поиске.';
COMMENT ON TABLE public.industry_subcategories IS 'Подкатегории внутри категорий. Подкатегория автоапрувится когда 3+ мастера её выбрали.';
COMMENT ON TABLE public.master_industry_categories IS 'Мастер ↔ категория (multi). is_primary=true только у одной строки на мастера.';
COMMENT ON TABLE public.master_industry_subcategories IS 'Мастер ↔ подкатегория (multi).';
