-- 00127: мастер выходит из команды — становится снова соло.
-- Принцип «группы в соц.сети»: один аккаунт навсегда. Профиль/мастер/услуги/
-- клиенты/история — всё остаётся за мастером, удаляется только связь с салоном.
--
-- Что делает RPC leave_salon(p_salon_id):
--   1. Проверяет что вызывающий — активный участник этого салона с role='master'
--      (не admin: владелец/админ салона должен сначала передать роль или закрыть
--      команду — это отдельный flow).
--   2. salon_members → status='removed' (мягкое удаление, история сохраняется).
--   3. Будущие appointments (start_at >= now()) этого мастера в этом салоне →
--      salon_id=NULL (уезжают с мастером). Прошлые остаются с salon_id для
--      исторической точности — те визиты реально проходили в этой команде.
--   4. Возвращает имя салона + статус для уведомления владельцу.

CREATE OR REPLACE FUNCTION public.leave_salon(p_salon_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_master_id uuid;
  v_member_id uuid;
  v_member_role text;
  v_salon_name text;
  v_salon_owner uuid;
  v_moved_appointments int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;

  SELECT id INTO v_master_id
  FROM public.masters
  WHERE profile_id = v_uid
  LIMIT 1;

  IF v_master_id IS NULL THEN
    RAISE EXCEPTION 'master_profile_not_found';
  END IF;

  SELECT id, role INTO v_member_id, v_member_role
  FROM public.salon_members
  WHERE salon_id = p_salon_id
    AND profile_id = v_uid
    AND status = 'active'
  LIMIT 1;

  IF v_member_id IS NULL THEN
    RAISE EXCEPTION 'not_a_member';
  END IF;

  IF v_member_role = 'admin' THEN
    RAISE EXCEPTION 'admin_cannot_leave_use_transfer_or_close';
  END IF;

  SELECT name, owner_id INTO v_salon_name, v_salon_owner
  FROM public.salons
  WHERE id = p_salon_id;

  -- Owner-самовыход тоже блокируем (на случай если owner_id == auth.uid() и роль 'master').
  IF v_salon_owner = v_uid THEN
    RAISE EXCEPTION 'owner_cannot_leave_use_transfer_or_close';
  END IF;

  -- Мягкое удаление членства.
  UPDATE public.salon_members
  SET status = 'removed'
  WHERE id = v_member_id;

  -- Будущие записи уходят с мастером в его соло-календарь.
  WITH moved AS (
    UPDATE public.appointments
    SET salon_id = NULL
    WHERE master_id = v_master_id
      AND salon_id = p_salon_id
      AND start_at >= now()
    RETURNING id
  )
  SELECT count(*) INTO v_moved_appointments FROM moved;

  -- masters.salon_id обнуляется только если был привязан к этому салону.
  -- (Поле опциональное в схеме — может быть NULL изначально.)
  UPDATE public.masters
  SET salon_id = NULL
  WHERE id = v_master_id
    AND salon_id = p_salon_id;

  RETURN jsonb_build_object(
    'ok', true,
    'salon_name', v_salon_name,
    'salon_owner_id', v_salon_owner,
    'moved_appointments', v_moved_appointments
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.leave_salon(uuid) TO authenticated;

-- Helper RPC: возвращает текущее активное членство мастера.
-- Используется UI чтобы показать «Вы в команде X» + кнопку «Покинуть».
CREATE OR REPLACE FUNCTION public.get_my_team_membership()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_result jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('in_team', false);
  END IF;

  SELECT jsonb_build_object(
    'in_team', true,
    'salon_id', s.id,
    'salon_name', s.name,
    'salon_logo_url', s.logo_url,
    'role', sm.role,
    'is_owner', (s.owner_id = v_uid),
    'joined_at', sm.joined_at
  )
  INTO v_result
  FROM public.salon_members sm
  JOIN public.salons s ON s.id = sm.salon_id
  WHERE sm.profile_id = v_uid
    AND sm.status = 'active'
  ORDER BY sm.joined_at DESC NULLS LAST
  LIMIT 1;

  RETURN COALESCE(v_result, jsonb_build_object('in_team', false));
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_team_membership() TO authenticated;

-- Service-role вариант для Mini App API: получает profile_id из проверенного initData,
-- не полагается на auth.uid() (admin client его не выставляет).
CREATE OR REPLACE FUNCTION public.leave_salon_for(p_profile_id uuid, p_salon_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_master_id uuid;
  v_member_id uuid;
  v_member_role text;
  v_salon_name text;
  v_salon_owner uuid;
  v_moved_appointments int;
BEGIN
  IF p_profile_id IS NULL THEN
    RAISE EXCEPTION 'profile_required';
  END IF;

  SELECT id INTO v_master_id
  FROM public.masters WHERE profile_id = p_profile_id LIMIT 1;
  IF v_master_id IS NULL THEN RAISE EXCEPTION 'master_profile_not_found'; END IF;

  SELECT id, role INTO v_member_id, v_member_role
  FROM public.salon_members
  WHERE salon_id = p_salon_id AND profile_id = p_profile_id AND status = 'active' LIMIT 1;
  IF v_member_id IS NULL THEN RAISE EXCEPTION 'not_a_member'; END IF;
  IF v_member_role = 'admin' THEN RAISE EXCEPTION 'admin_cannot_leave_use_transfer_or_close'; END IF;

  SELECT name, owner_id INTO v_salon_name, v_salon_owner
  FROM public.salons WHERE id = p_salon_id;
  IF v_salon_owner = p_profile_id THEN
    RAISE EXCEPTION 'owner_cannot_leave_use_transfer_or_close';
  END IF;

  UPDATE public.salon_members SET status = 'removed' WHERE id = v_member_id;

  WITH moved AS (
    UPDATE public.appointments SET salon_id = NULL
    WHERE master_id = v_master_id AND salon_id = p_salon_id AND start_at >= now()
    RETURNING id
  )
  SELECT count(*) INTO v_moved_appointments FROM moved;

  UPDATE public.masters SET salon_id = NULL
  WHERE id = v_master_id AND salon_id = p_salon_id;

  RETURN jsonb_build_object(
    'ok', true,
    'salon_name', v_salon_name,
    'salon_owner_id', v_salon_owner,
    'moved_appointments', v_moved_appointments
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.leave_salon_for(uuid, uuid) FROM authenticated, anon, public;
GRANT EXECUTE ON FUNCTION public.leave_salon_for(uuid, uuid) TO service_role;
