-- Cancellation policy for masters
alter table masters add column if not exists cancellation_policy jsonb
  default '{"free_hours": 24, "partial_hours": 12, "partial_percent": 50}';

-- Birthday greeting settings
alter table masters add column if not exists birthday_auto_greet boolean default false;
alter table masters add column if not exists birthday_discount_percent int default 0;
