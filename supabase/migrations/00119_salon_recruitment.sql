-- 00119: команда/салон — флаг открытого набора + входящие заявки от мастеров.
-- Админ создаёт salon row (owner_id = self), может закрыть набор → клиенты-мастера
-- больше не могут запросить вступление. Мастер открывает /s/<id> при открытом
-- наборе → жмёт «Запросить вступление» → создаётся salon_join_requests row.
-- Админ в дашборде видит список pending → Approve переводит в salon_members.

-- 1. Флаг открытого набора + сообщение мастерам «как присоединиться» -----------

ALTER TABLE public.salons
  ADD COLUMN IF NOT EXISTS recruitment_open boolean NOT NULL DEFAULT true;

ALTER TABLE public.salons
  ADD COLUMN IF NOT EXISTS recruitment_message text;

COMMENT ON COLUMN public.salons.recruitment_open IS
  'Если true — мастера могут запросить вступление через публичку /s/{id}.
   Админ может выключить чтобы остановить приём заявок.';

COMMENT ON COLUMN public.salons.recruitment_message IS
  'Опциональное описание для мастеров: что админ ищет, требования, бенефиты
   (показывается в карточке «Запросить вступление» на публичной странице).';

-- 2. Таблица заявок от мастера на вступление ----------------------------------

CREATE TABLE IF NOT EXISTS public.salon_join_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id        uuid NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  master_id       uuid NOT NULL REFERENCES public.masters(id) ON DELETE CASCADE,
  message         text,
  status          text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  decided_by      uuid REFERENCES auth.users(id),
  decided_at      timestamptz,
  -- Один pending запрос на пару salon+master, остальные допустимы (history).
  -- Обеспечиваем через partial unique index ниже.
  CONSTRAINT salon_join_requests_no_self_admin
    CHECK (master_id IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS salon_join_requests_pending_unique
  ON public.salon_join_requests (salon_id, master_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS salon_join_requests_salon_idx
  ON public.salon_join_requests (salon_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS salon_join_requests_master_idx
  ON public.salon_join_requests (master_id, status, created_at DESC);

ALTER TABLE public.salon_join_requests ENABLE ROW LEVEL SECURITY;

-- RLS: master видит свои запросы; salon owner / salon admin видят все запросы салона.

DROP POLICY IF EXISTS salon_join_requests_select ON public.salon_join_requests;
CREATE POLICY salon_join_requests_select ON public.salon_join_requests
  FOR SELECT USING (
    -- мастер видит свой запрос
    master_id IN (SELECT id FROM public.masters WHERE profile_id = auth.uid())
    -- или владелец салона
    OR salon_id IN (SELECT id FROM public.salons WHERE owner_id = auth.uid())
    -- или admin/receptionist текущего салона (через salon_members)
    OR salon_id IN (
      SELECT sm.salon_id FROM public.salon_members sm
      JOIN public.masters m ON m.id = sm.master_id
      WHERE m.profile_id = auth.uid()
        AND sm.role IN ('admin', 'receptionist')
        AND sm.status = 'active'
    )
  );

-- INSERT: только мастер сам создаёт свой запрос; salon должен быть с recruitment_open.
DROP POLICY IF EXISTS salon_join_requests_insert ON public.salon_join_requests;
CREATE POLICY salon_join_requests_insert ON public.salon_join_requests
  FOR INSERT WITH CHECK (
    master_id IN (SELECT id FROM public.masters WHERE profile_id = auth.uid())
    AND status = 'pending'
    AND salon_id IN (SELECT id FROM public.salons WHERE recruitment_open = true)
  );

-- UPDATE: мастер может withdraw свой pending; админ салона может approve/reject.
DROP POLICY IF EXISTS salon_join_requests_update ON public.salon_join_requests;
CREATE POLICY salon_join_requests_update ON public.salon_join_requests
  FOR UPDATE USING (
    master_id IN (SELECT id FROM public.masters WHERE profile_id = auth.uid())
    OR salon_id IN (SELECT id FROM public.salons WHERE owner_id = auth.uid())
    OR salon_id IN (
      SELECT sm.salon_id FROM public.salon_members sm
      JOIN public.masters m ON m.id = sm.master_id
      WHERE m.profile_id = auth.uid()
        AND sm.role = 'admin'
        AND sm.status = 'active'
    )
  );

-- 3. RPC: Approve a pending join request — атомарно: создаёт salon_members,
-- помечает заявку approved, отменяет другие pending заявки этого мастера в этот салон.

CREATE OR REPLACE FUNCTION public.approve_salon_join_request(p_request_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request public.salon_join_requests%ROWTYPE;
  v_member_id uuid;
  v_caller_is_admin boolean;
BEGIN
  SELECT * INTO v_request FROM public.salon_join_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'request_not_found';
  END IF;

  -- Проверка прав: caller должен быть owner салона или admin/receptionist
  SELECT EXISTS (
    SELECT 1 FROM public.salons WHERE id = v_request.salon_id AND owner_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.salon_members sm
    JOIN public.masters m ON m.id = sm.master_id
    WHERE sm.salon_id = v_request.salon_id
      AND m.profile_id = auth.uid()
      AND sm.role IN ('admin')
      AND sm.status = 'active'
  ) INTO v_caller_is_admin;
  IF NOT v_caller_is_admin THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'already_decided';
  END IF;

  -- Создать или активировать членство
  INSERT INTO public.salon_members (salon_id, master_id, role, status)
  VALUES (v_request.salon_id, v_request.master_id, 'master', 'active')
  ON CONFLICT (salon_id, master_id) DO UPDATE
    SET status = 'active',
        role = COALESCE(public.salon_members.role, 'master')
  RETURNING id INTO v_member_id;

  -- Помечаем заявку approved
  UPDATE public.salon_join_requests
  SET status = 'approved',
      decided_by = auth.uid(),
      decided_at = now()
  WHERE id = p_request_id;

  -- Отменяем другие pending заявки этого мастера в этот салон (на всякий случай)
  UPDATE public.salon_join_requests
  SET status = 'withdrawn',
      decided_by = auth.uid(),
      decided_at = now()
  WHERE salon_id = v_request.salon_id
    AND master_id = v_request.master_id
    AND status = 'pending'
    AND id <> p_request_id;

  RETURN v_member_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_salon_join_request(uuid) TO authenticated;

-- 4. RPC: Reject — простая смена статуса с проверкой прав.

CREATE OR REPLACE FUNCTION public.reject_salon_join_request(p_request_id uuid, p_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request public.salon_join_requests%ROWTYPE;
  v_caller_is_admin boolean;
BEGIN
  SELECT * INTO v_request FROM public.salon_join_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'request_not_found';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.salons WHERE id = v_request.salon_id AND owner_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.salon_members sm
    JOIN public.masters m ON m.id = sm.master_id
    WHERE sm.salon_id = v_request.salon_id
      AND m.profile_id = auth.uid()
      AND sm.role = 'admin'
      AND sm.status = 'active'
  ) INTO v_caller_is_admin;
  IF NOT v_caller_is_admin THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'already_decided';
  END IF;

  UPDATE public.salon_join_requests
  SET status = 'rejected',
      decided_by = auth.uid(),
      decided_at = now(),
      message = COALESCE(p_reason, message)
  WHERE id = p_request_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reject_salon_join_request(uuid, text) TO authenticated;
