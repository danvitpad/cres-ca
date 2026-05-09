/** --- YAML
 * name: Master client fuzzy search
 * description: Two SQL functions to fix AI agent client lookup, plus a GIN trigram
 *   index for fast search on big client lists.
 *   1) normalize_for_search(text) — lowercase + unaccent + ukrainian→russian
 *      letter mapping + latin→cyrillic transliteration. So "Taisia" / "Тая" /
 *      "Таисию" / "Ірина" / "Ирина" all map to comparable cyrillic strings.
 *   2) find_master_clients(master_id, query, limit) — fuzzy search scoped strictly
 *      to one master's clients. Combines pg_trgm similarity + substring match
 *      to handle declension ("Таисию" finds "Таисия") and transliteration.
 *      Master scope is hard-baked: cannot accidentally surface other masters'
 *      clients or rows from `masters` table.
 *   3) GIN index on normalize_for_search(full_name) — makes search fast even
 *      with thousands of clients. Functional index — works because the function
 *      is IMMUTABLE.
 * created: 2026-05-09
 * --- */

create extension if not exists unaccent;
create extension if not exists pg_trgm;

create or replace function public.normalize_for_search(input text)
returns text
language plpgsql
immutable
parallel safe
as $func$
declare
  result text;
begin
  if input is null or length(trim(input)) = 0 then
    return '';
  end if;

  result := lower(unaccent(input));

  -- Ukrainian → Russian (so "Ірина" and "Ирина" normalize to the same form).
  result := replace(result, 'ї', 'и');
  result := replace(result, 'і', 'и');
  result := replace(result, 'є', 'е');
  result := replace(result, 'ґ', 'г');

  -- Latin digraphs → cyrillic (longer combinations win — must run before single chars).
  result := replace(result, 'shch', 'щ');
  result := replace(result, 'sch',  'щ');
  result := replace(result, 'sh',   'ш');
  result := replace(result, 'ch',   'ч');
  result := replace(result, 'zh',   'ж');
  result := replace(result, 'kh',   'х');
  result := replace(result, 'ts',   'ц');
  result := replace(result, 'iia',  'ия');
  result := replace(result, 'ija',  'ия');
  result := replace(result, 'ya',   'я');
  result := replace(result, 'yo',   'ё');
  result := replace(result, 'yu',   'ю');
  result := replace(result, 'ja',   'я');
  result := replace(result, 'jo',   'ё');
  result := replace(result, 'ju',   'ю');
  result := replace(result, 'iy',   'ий');
  result := replace(result, 'yi',   'ый');
  result := replace(result, 'iu',   'ю');

  -- Multi-char latin → cyrillic (translate() can't handle 1→N mappings).
  result := replace(result, 'x', 'кс');
  result := replace(result, 'q', 'к');
  result := replace(result, 'w', 'в');

  -- Remaining single-char latin → cyrillic.
  result := translate(
    result,
    'abcdefghijklmnoprstuvyz',
    'абцдефгхийклмнопрстувиз'
  );

  -- Strip everything except cyrillic letters and spaces.
  result := regexp_replace(result, '[^а-яё\s]', '', 'g');
  result := regexp_replace(result, '\s+', ' ', 'g');
  result := trim(result);

  return result;
end;
$func$;

comment on function public.normalize_for_search(text) is
  'Canonicalizes a name/phrase: lowercase + unaccent + ukrainian->russian + latin->cyrillic transliteration. Used by find_master_clients.';

create or replace function public.find_master_clients(
  p_master_id uuid,
  p_query text,
  p_limit int default 5
)
returns table(
  id uuid,
  full_name text,
  phone text,
  score real
)
language plpgsql
stable
security definer
set search_path = public
as $func$
declare
  q text;
  q_short text;
begin
  q := public.normalize_for_search(p_query);

  if length(q) < 2 then
    return;
  end if;

  -- Stem: drop the last 1-2 chars to match Russian/Ukrainian declension.
  -- "таисию" → "таиси", will match "таисия" via stem prefix.
  q_short := case
    when length(q) > 4 then left(q, length(q) - 2)
    when length(q) > 3 then left(q, length(q) - 1)
    else q
  end;

  return query
  select
    c.id,
    c.full_name,
    c.phone,
    greatest(
      public.similarity(public.normalize_for_search(c.full_name), q),
      case
        when public.normalize_for_search(c.full_name) like q || '%' then 1.0::real
        when public.normalize_for_search(c.full_name) like '%' || q || '%' then 0.85::real
        when public.normalize_for_search(c.full_name) like '%' || q_short || '%' then 0.6::real
        else 0::real
      end
    ) as match_score
  from public.clients c
  where c.master_id = p_master_id
    and (
      public.normalize_for_search(c.full_name) like '%' || q_short || '%'
      or public.similarity(public.normalize_for_search(c.full_name), q) > 0.3
    )
  order by match_score desc, c.full_name asc
  limit greatest(1, least(p_limit, 20));
end;
$func$;

comment on function public.find_master_clients(uuid, text, int) is
  'Fuzzy search scoped to one master clients. Handles latin/cyrillic transliteration and declension.';

-- GIN trigram index on normalized full_name. Functional index requires IMMUTABLE
-- function (which normalize_for_search is). Speeds up similarity() and LIKE '%x%'.
create index if not exists idx_clients_normalized_name
  on public.clients using gin (public.normalize_for_search(full_name) gin_trgm_ops);

grant execute on function public.normalize_for_search(text) to authenticated, service_role;
grant execute on function public.find_master_clients(uuid, text, int) to authenticated, service_role;
