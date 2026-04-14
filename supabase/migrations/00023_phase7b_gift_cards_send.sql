-- Phase 7b: sendable gift cards with sender/recipient + RLS
-- Adds sender_profile_id, recipient_profile_id, sender_message to gift_certificates
-- and RLS policies for sender and recipient to read/insert/update.

ALTER TABLE gift_certificates
  ADD COLUMN IF NOT EXISTS sender_profile_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS recipient_profile_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sender_message text;

CREATE INDEX IF NOT EXISTS idx_gift_cards_recipient ON gift_certificates(recipient_profile_id) WHERE recipient_profile_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_gift_cards_sender ON gift_certificates(sender_profile_id) WHERE sender_profile_id IS NOT NULL;

ALTER TABLE gift_certificates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Sender and recipient read gift cards" ON gift_certificates;
CREATE POLICY "Sender and recipient read gift cards"
  ON gift_certificates FOR SELECT
  USING (
    sender_profile_id = auth.uid()
    OR recipient_profile_id = auth.uid()
  );

DROP POLICY IF EXISTS "Sender can insert own gift cards" ON gift_certificates;
CREATE POLICY "Sender can insert own gift cards"
  ON gift_certificates FOR INSERT
  WITH CHECK (sender_profile_id = auth.uid());

DROP POLICY IF EXISTS "Recipient can mark redeemed" ON gift_certificates;
CREATE POLICY "Recipient can mark redeemed"
  ON gift_certificates FOR UPDATE
  USING (recipient_profile_id = auth.uid() OR sender_profile_id = auth.uid())
  WITH CHECK (recipient_profile_id = auth.uid() OR sender_profile_id = auth.uid());
