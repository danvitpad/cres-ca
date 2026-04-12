-- Phase 5 live-DB fixes discovered during family-booking verification.
-- 1. clients INSERT policy — клиент должен мочь создать свою запись при первом бронировании
--    (в т.ч. family-member row). Ранее этого не было: работало только потому что Зоя
--    уже имела client row; Мария падала молча.
-- 2. Note: seed masters.working_hours empty-object fallback fix is data-only, не DDL.

DROP POLICY IF EXISTS "Clients can insert own records" ON clients;
CREATE POLICY "Clients can insert own records"
  ON clients FOR INSERT
  WITH CHECK (profile_id = auth.uid());
