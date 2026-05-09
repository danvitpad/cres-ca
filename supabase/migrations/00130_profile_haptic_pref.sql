-- Migration 00130: profiles.haptic_enabled
-- Per-user toggle for Telegram Mini App haptic feedback.
-- Default true so existing users get haptics; can disable in Settings.

alter table public.profiles
  add column if not exists haptic_enabled boolean not null default true;

comment on column public.profiles.haptic_enabled
  is 'Master/client toggle for Mini App haptic feedback. Read by HapticProvider.';
