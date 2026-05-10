/** --- YAML
 * name: Industry Categories RPCs
 * description: SQL-функции для работы с каталогом категорий:
 *              - apply_master_categories: атомарная перезапись выбора мастера
 *              - request_industry_subcategory: добавить подкатегорию (своим текстом)
 *              - request_industry_category: заявка на новую категорию верхнего уровня (pending)
 *              - popular_industry_subcategories / categories: чипы «популярное»
 *              - get_master_categories: получить выбор мастера для редактирования
 * created: 2026-05-10
 * --- */

CREATE OR REPLACE FUNCTION public.apply_master_categories(
  p_master_id uuid,
  p_category_ids uuid[],
  p_primary_category_id uuid,
  p_subcategory_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_master uuid;
BEGIN
  SELECT id INTO v_caller_master FROM public.masters WHERE profile_id = auth.uid();
  IF v_caller_master IS NULL OR v_caller_master <> p_master_id THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  DELETE FROM public.master_industry_categories WHERE master_id = p_master_id;
  DELETE FROM public.master_industry_subcategories WHERE master_id = p_master_id;

  IF p_category_ids IS NOT NULL AND array_length(p_category_ids, 1) > 0 THEN
    INSERT INTO public.master_industry_categories (master_id, category_id, is_primary)
    SELECT p_master_id, cid, (cid = p_primary_category_id)
    FROM unnest(p_category_ids) AS cid
    ON CONFLICT DO NOTHING;
  END IF;

  IF p_subcategory_ids IS NOT NULL AND array_length(p_subcategory_ids, 1) > 0 THEN
    INSERT INTO public.master_industry_subcategories (master_id, subcategory_id)
    SELECT p_master_id, sid
    FROM unnest(p_subcategory_ids) AS sid
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_master_categories(uuid, uuid[], uuid, uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.request_industry_subcategory(
  p_category_id uuid,
  p_text text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_master_id uuid;
  v_text text;
  v_existing_id uuid;
  v_new_id uuid;
  v_safe_key text;
BEGIN
  v_text := btrim(p_text);
  IF v_text = '' OR length(v_text) > 80 OR length(v_text) < 2 THEN
    RAISE EXCEPTION 'invalid_text';
  END IF;

  SELECT id INTO v_master_id FROM public.masters WHERE profile_id = auth.uid();
  IF v_master_id IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT id INTO v_existing_id
  FROM public.industry_subcategories
  WHERE category_id = p_category_id
    AND lower(name_ru) = lower(v_text)
    AND status IN ('active','pending')
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    INSERT INTO public.master_industry_subcategories (master_id, subcategory_id)
    VALUES (v_master_id, v_existing_id)
    ON CONFLICT DO NOTHING;
    RETURN v_existing_id;
  END IF;

  v_safe_key := 'custom_' || substr(md5(v_text || now()::text), 1, 10);
  INSERT INTO public.industry_subcategories
    (category_id, key, name_ru, name_uk, name_en, status, is_system, created_by_master_id)
  VALUES
    (p_category_id, v_safe_key, v_text, v_text, v_text, 'pending', false, v_master_id)
  RETURNING id INTO v_new_id;

  INSERT INTO public.master_industry_subcategories (master_id, subcategory_id)
  VALUES (v_master_id, v_new_id);

  RETURN v_new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_industry_subcategory(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.request_industry_category(
  p_text text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_master_id uuid;
  v_text text;
  v_safe_key text;
  v_new_id uuid;
BEGIN
  v_text := btrim(p_text);
  IF v_text = '' OR length(v_text) > 60 OR length(v_text) < 2 THEN
    RAISE EXCEPTION 'invalid_text';
  END IF;

  SELECT id INTO v_master_id FROM public.masters WHERE profile_id = auth.uid();
  IF v_master_id IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;

  v_safe_key := 'custom_' || substr(md5(v_text || now()::text || v_master_id::text), 1, 10);

  INSERT INTO public.industry_categories
    (key, name_ru, name_uk, name_en, status, is_system, created_by_master_id)
  VALUES
    (v_safe_key, v_text, v_text, v_text, 'pending', false, v_master_id)
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_industry_category(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.popular_industry_subcategories(
  p_category_id uuid,
  p_min_count int DEFAULT 1,
  p_limit int DEFAULT 12
)
RETURNS TABLE (id uuid, name_ru text, name_uk text, name_en text, master_count int)
LANGUAGE sql
STABLE
AS $$
  SELECT id, name_ru, name_uk, name_en, master_count
  FROM public.industry_subcategories
  WHERE category_id = p_category_id
    AND status = 'active'
    AND master_count >= p_min_count
  ORDER BY master_count DESC, sort_order ASC, name_ru ASC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.popular_industry_subcategories(uuid, int, int) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.popular_industry_categories(
  p_limit int DEFAULT 10
)
RETURNS TABLE (id uuid, key text, name_ru text, name_uk text, name_en text, icon text, master_count int)
LANGUAGE sql
STABLE
AS $$
  SELECT id, key, name_ru, name_uk, name_en, icon, master_count
  FROM public.industry_categories
  WHERE status = 'active'
  ORDER BY master_count DESC, sort_order ASC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.popular_industry_categories(int) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_master_categories(p_master_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'categories', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', c.id,
        'key', c.key,
        'name_ru', c.name_ru,
        'name_uk', c.name_uk,
        'name_en', c.name_en,
        'icon', c.icon,
        'is_primary', mc.is_primary
      ) ORDER BY (NOT mc.is_primary), c.sort_order), '[]'::jsonb)
      FROM public.master_industry_categories mc
      JOIN public.industry_categories c ON c.id = mc.category_id
      WHERE mc.master_id = p_master_id
    ),
    'subcategories', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', s.id,
        'category_id', s.category_id,
        'key', s.key,
        'name_ru', s.name_ru,
        'name_uk', s.name_uk,
        'name_en', s.name_en,
        'status', s.status
      ) ORDER BY s.sort_order), '[]'::jsonb)
      FROM public.master_industry_subcategories ms
      JOIN public.industry_subcategories s ON s.id = ms.subcategory_id
      WHERE ms.master_id = p_master_id
    )
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_master_categories(uuid) TO anon, authenticated;
