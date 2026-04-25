-- 00100_message_template_subjects.sql
-- Adds optional subject line to message_templates for gmail-style editing
-- (subject + body). For TG dispatch the subject becomes the bold first line;
-- for email it becomes the real Subject header.

ALTER TABLE public.message_templates
  ADD COLUMN IF NOT EXISTS subject text;

COMMENT ON COLUMN public.message_templates.subject IS
  'Subject line. For TG: rendered as bold first line of message; for email: real Subject header. NULL falls back to a per-kind hardcoded default.';
