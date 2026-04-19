-- Phase 2: Auth flows
-- 2.5 Two-factor authentication via Telegram (scaffold)
-- 2.6 Soft-delete with 30-day grace period

-- 2.6 profiles.deleted_at — soft-delete marker
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_profiles_deleted_at
  ON public.profiles (deleted_at)
  WHERE deleted_at IS NOT NULL;

COMMENT ON COLUMN public.profiles.deleted_at IS
  'Phase 2.6: set when user requests account deletion. A 30-day cron then hard-deletes auth.user. On login, if not null, user can restore.';

-- 2.5 profiles.tg_2fa_enabled
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tg_2fa_enabled boolean DEFAULT false;

COMMENT ON COLUMN public.profiles.tg_2fa_enabled IS
  'Phase 2.5: when true, login requires a 6-digit code sent via @crescacom_bot after password success.';

-- 2.5 tg_2fa_codes
CREATE TABLE IF NOT EXISTS public.tg_2fa_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  code_hash text NOT NULL,            -- store hashed code, not plaintext
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '5 minutes'),
  used_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tg_2fa_codes_profile_created
  ON public.tg_2fa_codes (profile_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tg_2fa_codes_expiry
  ON public.tg_2fa_codes (expires_at)
  WHERE used_at IS NULL;

ALTER TABLE public.tg_2fa_codes ENABLE ROW LEVEL SECURITY;

-- Service-role only — user-facing routes validate via initData or auth.uid() and hit this via admin client.
CREATE POLICY "tg_2fa_codes_owner_select" ON public.tg_2fa_codes
  FOR SELECT USING (profile_id = auth.uid());

COMMENT ON TABLE public.tg_2fa_codes IS
  'Phase 2.5: short-lived (5 min) 6-digit codes for Telegram-based 2FA. code_hash is SHA-256 — plaintext never stored.';
