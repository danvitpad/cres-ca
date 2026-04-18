-- Phase 2: service_materials (BOM — bill of materials)
-- Links a service to inventory items consumed per appointment.
-- FK material_id → inventory_items(id) (not a "materials" table — adapted per project schema).

create table if not exists service_materials (
  id uuid primary key default uuid_generate_v4(),
  service_id uuid not null references services(id) on delete cascade,
  material_id uuid not null references inventory_items(id) on delete cascade,
  quantity numeric(10,3) not null check (quantity > 0),
  unit text not null,
  is_optional boolean not null default false,
  created_at timestamptz not null default now(),
  unique (service_id, material_id)
);

create index if not exists idx_service_materials_service on service_materials(service_id);
create index if not exists idx_service_materials_material on service_materials(material_id);

alter table service_materials enable row level security;

-- Master manages service_materials for their own services (via service → master relation)
create policy "Master manages service_materials for own services"
  on service_materials for all
  using (
    service_id in (
      select s.id from services s
      where s.master_id in (select id from masters where profile_id = auth.uid())
    )
  )
  with check (
    service_id in (
      select s.id from services s
      where s.master_id in (select id from masters where profile_id = auth.uid())
    )
  );
