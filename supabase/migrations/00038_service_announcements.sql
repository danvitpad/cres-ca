-- Service announcements — admin-managed banners shown in dashboard header
-- Managed via Supabase Dashboard; no INSERT/UPDATE/DELETE for regular users
CREATE TABLE IF NOT EXISTS service_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text,
  link text,
  link_label text,
  type text NOT NULL DEFAULT 'info' CHECK (type IN ('info','promo','warning','update')),
  is_active boolean NOT NULL DEFAULT true,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE service_announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read active announcements"
  ON service_announcements FOR SELECT TO authenticated
  USING (is_active = true AND starts_at <= now() AND (ends_at IS NULL OR ends_at > now()));
