/** --- YAML
 * name: Search Unaffiliated Masters V2 — universal lookup
 * description: Расширяет search_unaffiliated_masters() — поиск по любому из
 *              признаков: имя / фамилия / отчество (profiles.first/last/middle_name)
 *              + полное имя, email, телефон (только цифры, мин 4), slug мастера,
 *              UUID мастера или профиля (полностью или префиксом). Минимум 2
 *              символа в запросе.
 * created: 2026-04-27
 * --- */

CREATE OR REPLACE FUNCTION public.search_unaffiliated_masters(p_query text, p_limit int DEFAULT 10)
RETURNS TABLE (
  master_id uuid,
  profile_id uuid,
  full_name text,
  email text,
  phone text,
  avatar_url text,
  specialization text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH q AS (
    SELECT
      btrim(p_query)                                AS raw,
      lower(btrim(p_query))                         AS lc,
      regexp_replace(p_query, '\D', '', 'g')        AS digits
  )
  SELECT
    m.id            AS master_id,
    m.profile_id,
    p.full_name,
    p.email,
    p.phone,
    p.avatar_url,
    m.specialization
  FROM public.masters m
  JOIN public.profiles p ON p.id = m.profile_id
  CROSS JOIN q
  WHERE m.salon_id IS NULL
    AND m.is_active = true
    AND p.deleted_at IS NULL
    AND length(q.raw) >= 2
    AND (
         lower(coalesce(p.full_name, ''))     LIKE '%' || q.lc || '%'
      OR lower(coalesce(p.first_name, ''))    LIKE '%' || q.lc || '%'
      OR lower(coalesce(p.last_name, ''))     LIKE '%' || q.lc || '%'
      OR lower(coalesce(p.middle_name, ''))   LIKE '%' || q.lc || '%'
      OR lower(coalesce(p.email, ''))         LIKE '%' || q.lc || '%'
      OR (length(q.digits) >= 4 AND coalesce(p.phone, '') LIKE '%' || q.digits || '%')
      OR lower(coalesce(m.slug, ''))          LIKE '%' || q.lc || '%'
      OR lower(m.id::text)                    LIKE q.lc || '%'
      OR lower(p.id::text)                    LIKE q.lc || '%'
    )
  ORDER BY p.full_name
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.search_unaffiliated_masters(text, int) TO authenticated, service_role;
