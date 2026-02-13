CREATE OR REPLACE FUNCTION public.process_wallet_sell(
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
  v_net_value NUMERIC;
  v_current_amount NUMERIC;
  v_tx_id UUID;
  v_wallet_id UUID;
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

  SELECT amount INTO v_current_amount
  FROM public.holdings
  WHERE user_id = p_user_id AND coin_id = p_coin_id
  FOR UPDATE;

  IF v_current_amount IS NULL THEN
    RAISE EXCEPTION 'Holding not found';
  END IF;

  IF v_current_amount < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  v_total_value := p_amount * v_coin_price;
  v_fee_amount := v_total_value * (v_fee_percentage / 100);
  v_net_value := v_total_value - v_fee_amount;

  INSERT INTO public.transactions
    (user_id, coin_id, type, amount, price_per_coin, total_value, status)
  VALUES
    (p_user_id, p_coin_id, 'sell', p_amount, v_coin_price, v_total_value, 'completed')
  RETURNING id INTO v_tx_id;

  INSERT INTO public.commission_transactions
    (transaction_id, amount, commission_rate)
  VALUES
    (v_tx_id, v_fee_amount, v_fee_percentage);

  UPDATE public.wallets
  SET fiat_balance = fiat_balance + v_net_value,
      updated_at = now()
  WHERE user_id = p_user_id
  RETURNING id INTO v_wallet_id;

  IF v_wallet_id IS NULL THEN
    INSERT INTO public.wallets (user_id, fiat_balance)
    VALUES (p_user_id, v_net_value)
    RETURNING id INTO v_wallet_id;
  END IF;

  RETURN v_tx_id;
END;
$$;
