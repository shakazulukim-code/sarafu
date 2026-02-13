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
  v_coin_price NUMERIC;
  v_fee_percentage NUMERIC;
  v_total_value NUMERIC;
  v_fee_amount NUMERIC;
  v_total_with_fee NUMERIC;
  v_current_balance NUMERIC;
  v_tx_id UUID;
BEGIN
  SELECT price INTO v_coin_price
  FROM public.coins
  WHERE id = p_coin_id;

  IF v_coin_price IS NULL THEN
    RAISE EXCEPTION 'Coin not found';
  END IF;

  SELECT COALESCE(s.fee_percentage, 0) INTO v_fee_percentage
  FROM public.site_settings s
  LIMIT 1;

  v_total_value := p_amount * v_coin_price;
  v_fee_amount := v_total_value * (v_fee_percentage / 100);
  v_total_with_fee := v_total_value + v_fee_amount;

  SELECT fiat_balance INTO v_current_balance
  FROM public.wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_current_balance IS NULL THEN
    RAISE EXCEPTION 'Wallet not found';
  END IF;

  IF v_current_balance < v_total_with_fee THEN
    RAISE EXCEPTION 'Insufficient wallet balance';
  END IF;

  UPDATE public.wallets
  SET fiat_balance = v_current_balance - v_total_with_fee,
      updated_at = now()
  WHERE user_id = p_user_id;

  INSERT INTO public.transactions
    (user_id, coin_id, type, amount, price_per_coin, total_value, status)
  VALUES
    (p_user_id, p_coin_id, 'buy', p_amount, v_coin_price, v_total_value, 'completed')
  RETURNING id INTO v_tx_id;

  INSERT INTO public.commission_transactions
    (transaction_id, amount, commission_rate)
  VALUES
    (v_tx_id, v_fee_amount, v_fee_percentage);

  RETURN v_tx_id;
END;
$$;
