-- 00122: единый каталог услуг салона.
-- Используется когда salons.team_mode = 'unified': admin создаёт услуги
-- на уровне салона, любой активный мастер команды может их выполнять.
-- Когда team_mode = 'marketplace' — каждый мастер пользуется своими `services`
-- (текущее поведение, не трогаем).

CREATE TABLE IF NOT EXISTS public.salon_services (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id          uuid NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  name              text NOT NULL,
  description       text,
  duration_minutes  integer,
  price             numeric,
  currency          text NOT NULL DEFAULT 'UAH',
  category_id       uuid REFERENCES public.service_categories(id) ON DELETE SET NULL,
  is_active         boolean NOT NULL DEFAULT true,
  sort_order        integer NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS salon_services_salon_active_idx
  ON public.salon_services (salon_id, is_active, sort_order);

ALTER TABLE public.salon_services ENABLE ROW LEVEL SECURITY;

-- READ: публичные активные услуги салона видны всем (для booking drawer).
DROP POLICY IF EXISTS salon_services_public_read ON public.salon_services;
CREATE POLICY salon_services_public_read ON public.salon_services
  FOR SELECT USING (is_active = true);

-- ADMIN: read + write только owner/admin салона.
DROP POLICY IF EXISTS salon_services_admin_read ON public.salon_services;
CREATE POLICY salon_services_admin_read ON public.salon_services
  FOR SELECT USING (
    salon_id IN (SELECT id FROM public.salons WHERE owner_id = auth.uid())
    OR salon_id IN (
      SELECT sm.salon_id FROM public.salon_members sm
      JOIN public.masters m ON m.id = sm.master_id
      WHERE m.profile_id = auth.uid() AND sm.role = 'admin' AND sm.status = 'active'
    )
  );

DROP POLICY IF EXISTS salon_services_admin_insert ON public.salon_services;
CREATE POLICY salon_services_admin_insert ON public.salon_services
  FOR INSERT WITH CHECK (
    salon_id IN (SELECT id FROM public.salons WHERE owner_id = auth.uid())
    OR salon_id IN (
      SELECT sm.salon_id FROM public.salon_members sm
      JOIN public.masters m ON m.id = sm.master_id
      WHERE m.profile_id = auth.uid() AND sm.role = 'admin' AND sm.status = 'active'
    )
  );

DROP POLICY IF EXISTS salon_services_admin_update ON public.salon_services;
CREATE POLICY salon_services_admin_update ON public.salon_services
  FOR UPDATE USING (
    salon_id IN (SELECT id FROM public.salons WHERE owner_id = auth.uid())
    OR salon_id IN (
      SELECT sm.salon_id FROM public.salon_members sm
      JOIN public.masters m ON m.id = sm.master_id
      WHERE m.profile_id = auth.uid() AND sm.role = 'admin' AND sm.status = 'active'
    )
  );

DROP POLICY IF EXISTS salon_services_admin_delete ON public.salon_services;
CREATE POLICY salon_services_admin_delete ON public.salon_services
  FOR DELETE USING (
    salon_id IN (SELECT id FROM public.salons WHERE owner_id = auth.uid())
    OR salon_id IN (
      SELECT sm.salon_id FROM public.salon_members sm
      JOIN public.masters m ON m.id = sm.master_id
      WHERE m.profile_id = auth.uid() AND sm.role = 'admin' AND sm.status = 'active'
    )
  );

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.salon_services_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS salon_services_touch_updated_at ON public.salon_services;
CREATE TRIGGER salon_services_touch_updated_at
  BEFORE UPDATE ON public.salon_services
  FOR EACH ROW EXECUTE FUNCTION public.salon_services_touch_updated_at();
