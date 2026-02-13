CREATE OR REPLACE FUNCTION public.process_wallet_buy(
  p_user_id UUID,
  p_coin_id UUID,
  p_amount NUMERIC
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  coin_price NUMERIC;
  fee_percentage NUMERIC;
  total_value NUMERIC;
  fee_amount NUMERIC;
  total_with_fee NUMERIC;
  current_balance NUMERIC;
  tx_id UUID;
BEGIN
  SELECT price INTO coin_price
  FROM public.coins
  WHERE id = p_coin_id;

  IF coin_price IS NULL THEN
    RAISE EXCEPTION 'Coin not found';
  END IF;

  SELECT COALESCE(fee_percentage, 0) INTO fee_percentage
  FROM public.site_settings
  LIMIT 1;

  total_value := p_amount * coin_price;
  fee_amount := total_value * (fee_percentage / 100);
  total_with_fee := total_value + fee_amount;

  SELECT fiat_balance INTO current_balance
  FROM public.wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF current_balance IS NULL THEN
    RAISE EXCEPTION 'Wallet not found';
  END IF;

  IF current_balance < total_with_fee THEN
    RAISE EXCEPTION 'Insufficient wallet balance';
  END IF;

  UPDATE public.wallets
  SET fiat_balance = current_balance - total_with_fee,
      updated_at = now()
  WHERE user_id = p_user_id;

  INSERT INTO public.transactions
    (user_id, coin_id, type, amount, price_per_coin, total_value, status)
  VALUES
    (p_user_id, p_coin_id, 'buy', p_amount, coin_price, total_value, 'completed')
  RETURNING id INTO tx_id;

  INSERT INTO public.commission_transactions
    (transaction_id, amount, commission_rate)
  VALUES
    (tx_id, fee_amount, fee_percentage);

  RETURN tx_id;
END;
$$;
