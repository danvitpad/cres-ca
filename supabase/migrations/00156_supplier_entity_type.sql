-- Add entity_type to suppliers: 'individual' (физ лицо) | 'company' (юр лицо)
ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS entity_type text NOT NULL DEFAULT 'individual'
  CHECK (entity_type IN ('individual', 'company'));
