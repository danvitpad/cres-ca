-- 00121: Fix approve_salon_join_request + accept_master_team_invite RPCs.
-- Both inserted into salon_members with master_id only (profile_id is NOT NULL,
-- and the UNIQUE is on (salon_id, profile_id), not (salon_id, master_id)).
-- This patch resolves profile_id from the master and uses the correct conflict
-- target.

CREATE OR REPLACE FUNCTION public.approve_salon_join_request(p_request_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request public.salon_join_requests%ROWTYPE;
  v_caller_is_admin boolean;
  v_member_id uuid;
  v_master_profile_id uuid;
BEGIN
  SELECT * INTO v_request FROM public.salon_join_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'request_not_found';
  END IF;

  SELECT
    EXISTS (SELECT 1 FROM public.salons s WHERE s.id = v_request.salon_id AND s.owner_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.salon_members sm
      JOIN public.masters m ON m.id = sm.master_id
      WHERE sm.salon_id = v_request.salon_id
        AND m.profile_id = auth.uid()
        AND sm.role = 'admin'
        AND sm.status = 'active'
    )
  INTO v_caller_is_admin;
  IF NOT v_caller_is_admin THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'already_decided';
  END IF;

  SELECT profile_id INTO v_master_profile_id FROM public.masters WHERE id = v_request.master_id;
  IF v_master_profile_id IS NULL THEN
    RAISE EXCEPTION 'master_has_no_profile';
  END IF;

  INSERT INTO public.salon_members (salon_id, profile_id, master_id, role, status, joined_at)
  VALUES (v_request.salon_id, v_master_profile_id, v_request.master_id, 'master', 'active', now())
  ON CONFLICT (salon_id, profile_id) DO UPDATE
    SET status = 'active',
        master_id = COALESCE(public.salon_members.master_id, EXCLUDED.master_id),
        role = COALESCE(public.salon_members.role, 'master'),
        joined_at = COALESCE(public.salon_members.joined_at, now())
  RETURNING id INTO v_member_id;

  UPDATE public.salon_join_requests
  SET status = 'approved',
      decided_by = auth.uid(),
      decided_at = now()
  WHERE id = p_request_id;

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


CREATE OR REPLACE FUNCTION public.accept_master_team_invite(p_invite_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite public.master_team_invites%ROWTYPE;
  v_caller_master_id uuid;
  v_master_profile_id uuid;
  v_member_id uuid;
BEGIN
  SELECT * INTO v_invite FROM public.master_team_invites WHERE id = p_invite_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invite_not_found';
  END IF;

  IF v_invite.status <> 'pending' THEN
    RAISE EXCEPTION 'already_decided';
  END IF;

  SELECT id, profile_id INTO v_caller_master_id, v_master_profile_id
  FROM public.masters WHERE profile_id = auth.uid()
  LIMIT 1;
  IF v_caller_master_id IS NULL OR v_caller_master_id <> v_invite.master_id THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  INSERT INTO public.salon_members (salon_id, profile_id, master_id, role, status, joined_at)
  VALUES (v_invite.salon_id, v_master_profile_id, v_invite.master_id, 'master', 'active', now())
  ON CONFLICT (salon_id, profile_id) DO UPDATE
    SET status = 'active',
        master_id = COALESCE(public.salon_members.master_id, EXCLUDED.master_id),
        role = COALESCE(public.salon_members.role, 'master'),
        joined_at = COALESCE(public.salon_members.joined_at, now())
  RETURNING id INTO v_member_id;

  UPDATE public.master_team_invites
  SET status = 'accepted', decided_at = now()
  WHERE id = p_invite_id;

  UPDATE public.salon_join_requests
  SET status = 'withdrawn', decided_by = auth.uid(), decided_at = now()
  WHERE salon_id = v_invite.salon_id
    AND master_id = v_invite.master_id
    AND status = 'pending';

  RETURN v_member_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_master_team_invite(uuid) TO authenticated;
