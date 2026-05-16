-- Migration: add client privacy preference columns to profiles
-- These power /api/me/privacy used by the client Mini App settings.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS privacy_profile_visible    boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS privacy_show_visit_history boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS privacy_show_in_reviews    boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS privacy_share_with_team    boolean NOT NULL DEFAULT false;
