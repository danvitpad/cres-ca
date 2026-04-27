/** --- YAML
 * name: Search Unaffiliated Masters RPC
 * description: Postgres RPC для надёжного поиска мастеров без салона по имени /
 *              email / телефону. Используется при «Найти в CRES-CA» в админ-
 *              панели команды. Старая JS-фильтрация ломалась из-за PostgREST
 *              embed-а — теперь чистый SQL с ILIKE по profiles.
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
  WHERE m.salon_id IS NULL
    AND m.is_active = true
    AND p.deleted_at IS NULL
    AND length(btrim(p_query)) >= 2
    AND (
         lower(coalesce(p.full_name, '')) LIKE '%' || lower(btrim(p_query)) || '%'
      OR lower(coalesce(p.email,     '')) LIKE '%' || lower(btrim(p_query)) || '%'
      OR coalesce(p.phone,           '') LIKE '%' || regexp_replace(p_query, '\D', '', 'g') || '%'
    )
  ORDER BY p.full_name
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.search_unaffiliated_masters(text, int) TO authenticated, service_role;
