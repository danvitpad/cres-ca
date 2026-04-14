-- CF3: atomic wallet transfer RPC. Replaces best-effort client-side profile updates.

CREATE OR REPLACE FUNCTION public.wallet_transfer(
  recipient_lookup text,
  amount numeric
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sender_id uuid := auth.uid();
  sender_balance numeric;
  rcpt_row profiles%ROWTYPE;
  lookup text := lower(trim(recipient_lookup));
BEGIN
  IF sender_id IS NULL THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;
  IF amount IS NULL OR amount <= 0 THEN
    RETURN jsonb_build_object('error', 'invalid_amount');
  END IF;

  SELECT bonus_balance INTO sender_balance FROM profiles WHERE id = sender_id FOR UPDATE;
  IF sender_balance IS NULL OR sender_balance < amount THEN
    RETURN jsonb_build_object('error', 'insufficient_funds');
  END IF;

  SELECT * INTO rcpt_row FROM profiles
  WHERE lower(email) = lookup
     OR lower(slug)  = lookup
     OR lower(public_id) = lookup
  LIMIT 1;

  IF rcpt_row.id IS NULL THEN
    RETURN jsonb_build_object('error', 'recipient_not_found');
  END IF;
  IF rcpt_row.id = sender_id THEN
    RETURN jsonb_build_object('error', 'self_transfer');
  END IF;

  UPDATE profiles SET bonus_balance = bonus_balance - amount WHERE id = sender_id;
  UPDATE profiles SET bonus_balance = coalesce(bonus_balance, 0) + amount WHERE id = rcpt_row.id;

  INSERT INTO wallet_transactions (profile_id, kind, amount, balance_after, reason)
  VALUES (sender_id, 'transfer_out', -amount, sender_balance - amount,
          'Перевод → ' || coalesce(rcpt_row.full_name, rcpt_row.email, rcpt_row.public_id));

  INSERT INTO wallet_transactions (profile_id, kind, amount, balance_after, reason)
  VALUES (rcpt_row.id, 'transfer_in', amount, coalesce(rcpt_row.bonus_balance, 0) + amount,
          'Перевод от пользователя');

  RETURN jsonb_build_object(
    'ok', true,
    'recipient_id', rcpt_row.id,
    'recipient_name', rcpt_row.full_name,
    'new_balance', sender_balance - amount
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.wallet_transfer(text, numeric) TO authenticated;
