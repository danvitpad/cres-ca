-- 00120: приглашения мастеров в команду от админа.
-- Зеркало salon_join_requests, но в обратном направлении:
-- админ выбирает существующего мастера (по invite_code/имени/тел) и шлёт invite,
-- мастер видит уведомление в Mini App → Принять/Отклонить.
-- При accept — создаётся salon_members.

CREATE TABLE IF NOT EXISTS public.master_team_invites (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id        uuid NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  master_id       uuid NOT NULL REFERENCES public.masters(id) ON DELETE CASCADE,
  invited_by      uuid NOT NULL REFERENCES auth.users(id),
  message         text,
  status          text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled', 'expired')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  decided_at      timestamptz,
  expires_at      timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS master_team_invites_pending_unique
  ON public.master_team_invites (salon_id, master_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS master_team_invites_salon_idx
  ON public.master_team_invites (salon_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS master_team_invites_master_idx
  ON public.master_team_invites (master_id, status, created_at DESC);

ALTER TABLE public.master_team_invites ENABLE ROW LEVEL SECURITY;

-- RLS: master видит свои invites; admin/owner салона — все invites своего салона.

DROP POLICY IF EXISTS master_team_invites_select ON public.master_team_invites;
CREATE POLICY master_team_invites_select ON public.master_team_invites
  FOR SELECT USING (
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

-- INSERT: только admin/owner салона.
DROP POLICY IF EXISTS master_team_invites_insert ON public.master_team_invites;
CREATE POLICY master_team_invites_insert ON public.master_team_invites
  FOR INSERT WITH CHECK (
    (salon_id IN (SELECT id FROM public.salons WHERE owner_id = auth.uid())
     OR salon_id IN (
        SELECT sm.salon_id FROM public.salon_members sm
        JOIN public.masters m ON m.id = sm.master_id
        WHERE m.profile_id = auth.uid()
          AND sm.role = 'admin'
          AND sm.status = 'active'
     ))
    AND status = 'pending'
    AND invited_by = auth.uid()
  );

-- UPDATE: master может accept/decline свой; admin/owner может cancel свой.
DROP POLICY IF EXISTS master_team_invites_update ON public.master_team_invites;
CREATE POLICY master_team_invites_update ON public.master_team_invites
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

-- RPC: master accepts invite — атомарно создаёт salon_members и помечает invite accepted.
CREATE OR REPLACE FUNCTION public.accept_master_team_invite(p_invite_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite public.master_team_invites%ROWTYPE;
  v_caller_master_id uuid;
  v_member_id uuid;
BEGIN
  SELECT * INTO v_invite FROM public.master_team_invites WHERE id = p_invite_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invite_not_found';
  END IF;

  IF v_invite.status <> 'pending' THEN
    RAISE EXCEPTION 'already_decided';
  END IF;

  SELECT id INTO v_caller_master_id
  FROM public.masters WHERE profile_id = auth.uid()
  LIMIT 1;
  IF v_caller_master_id IS NULL OR v_caller_master_id <> v_invite.master_id THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  INSERT INTO public.salon_members (salon_id, master_id, role, status)
  VALUES (v_invite.salon_id, v_invite.master_id, 'master', 'active')
  ON CONFLICT (salon_id, master_id) DO UPDATE
    SET status = 'active',
        role = COALESCE(public.salon_members.role, 'master')
  RETURNING id INTO v_member_id;

  UPDATE public.master_team_invites
  SET status = 'accepted', decided_at = now()
  WHERE id = p_invite_id;

  -- Отменяем pending salon_join_requests этого мастера в этот салон (на всякий случай)
  UPDATE public.salon_join_requests
  SET status = 'withdrawn', decided_by = auth.uid(), decided_at = now()
  WHERE salon_id = v_invite.salon_id
    AND master_id = v_invite.master_id
    AND status = 'pending';

  RETURN v_member_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_master_team_invite(uuid) TO authenticated;

-- RPC: master declines invite.
CREATE OR REPLACE FUNCTION public.decline_master_team_invite(p_invite_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite public.master_team_invites%ROWTYPE;
  v_caller_master_id uuid;
BEGIN
  SELECT * INTO v_invite FROM public.master_team_invites WHERE id = p_invite_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invite_not_found';
  END IF;
  IF v_invite.status <> 'pending' THEN
    RAISE EXCEPTION 'already_decided';
  END IF;
  SELECT id INTO v_caller_master_id FROM public.masters WHERE profile_id = auth.uid() LIMIT 1;
  IF v_caller_master_id IS NULL OR v_caller_master_id <> v_invite.master_id THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE public.master_team_invites
  SET status = 'declined', decided_at = now()
  WHERE id = p_invite_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.decline_master_team_invite(uuid) TO authenticated;
