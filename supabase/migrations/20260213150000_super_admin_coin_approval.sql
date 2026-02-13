-- Super Admin coin approval RPC with auto initial balance calculation
-- Formula: initial_circulating_supply = (creation_fee - gas_fee) / initial_price
-- Creator gets this allocation; bonding curve drives price from there
CREATE OR REPLACE FUNCTION public.super_admin_approve_coin(
  p_coin_id UUID,
  p_initial_price NUMERIC,
  p_initial_circulating_supply NUMERIC DEFAULT NULL,
  p_gas_fee NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coin RECORD;
  v_creation_fee NUMERIC;
  v_gas_fee NUMERIC;
  v_initial_supply NUMERIC;
  v_computed_price NUMERIC;
  v_caller_id UUID;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL OR NOT public.has_role(v_caller_id, 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Only super admin can approve coins';
  END IF;

  IF p_initial_price IS NULL OR p_initial_price <= 0 THEN
    RAISE EXCEPTION 'Initial price must be positive';
  END IF;

  SELECT * INTO v_coin FROM public.coins WHERE id = p_coin_id;
  IF v_coin IS NULL THEN
    RAISE EXCEPTION 'Coin not found';
  END IF;

  IF v_coin.is_approved = true THEN
    RAISE EXCEPTION 'Coin is already approved';
  END IF;

  -- Resolve initial circulating supply
  IF p_initial_circulating_supply IS NOT NULL AND p_initial_circulating_supply >= 0 THEN
    v_initial_supply := LEAST(p_initial_circulating_supply, v_coin.total_supply);
  ELSE
    -- Auto: (creation_fee - gas_fee) / initial_price
    SELECT COALESCE(coin_creation_fee, 5000) INTO v_creation_fee
    FROM public.site_settings LIMIT 1;
    v_gas_fee := COALESCE(p_gas_fee, v_creation_fee * 0.10);
    v_initial_supply := GREATEST(0, (v_creation_fee - v_gas_fee) / p_initial_price);
    v_initial_supply := LEAST(v_initial_supply, v_coin.total_supply * 0.5);
  END IF;

  v_initial_supply := ROUND(v_initial_supply::numeric, 4);

  -- Compute price from bonding curve (same formula as update_coin_price_from_transaction)
  v_computed_price := public.calculate_bonding_curve_price(
    p_initial_price,
    v_coin.total_supply,
    v_initial_supply
  );
  v_computed_price := GREATEST(v_computed_price, 0.0001);

  -- Create creator holding if applicable
  IF v_coin.creator_id IS NOT NULL AND v_initial_supply > 0 THEN
    INSERT INTO public.holdings (user_id, coin_id, amount, average_buy_price)
    VALUES (v_coin.creator_id, p_coin_id, v_initial_supply, v_computed_price)
    ON CONFLICT (user_id, coin_id) DO UPDATE SET
      amount = public.holdings.amount + EXCLUDED.amount,
      average_buy_price = (public.holdings.average_buy_price * public.holdings.amount + EXCLUDED.average_buy_price * EXCLUDED.amount)
        / NULLIF(public.holdings.amount + EXCLUDED.amount, 0),
      updated_at = now();
  END IF;

  -- Approve and set metrics
  UPDATE public.coins
  SET
    is_approved = true,
    approval_status = 'approved',
    initial_price = p_initial_price,
    price = v_computed_price,
    circulating_supply = v_initial_supply,
    use_price_override = false,
    price_override = NULL,
    is_active = true,
    volatility = 0,
    holders_count = CASE
      WHEN v_coin.creator_id IS NOT NULL AND v_initial_supply > 0 THEN 1
      ELSE 0
    END,
    updated_at = now()
  WHERE id = p_coin_id;

  -- Insert price history for metrics sync
  INSERT INTO public.price_history (coin_id, price, circulating_supply, market_cap, volume_24h, holders_count, created_at)
  VALUES (
    p_coin_id,
    v_computed_price,
    v_initial_supply,
    v_computed_price * v_initial_supply,
    0,
    CASE WHEN v_coin.creator_id IS NOT NULL AND v_initial_supply > 0 THEN 1 ELSE 0 END,
    now()
  )
  ON CONFLICT (coin_id, created_at) DO NOTHING;

  RETURN jsonb_build_object(
    'success', true,
    'initial_circulating_supply', v_initial_supply,
    'computed_price', v_computed_price,
    'creator_allocation', v_initial_supply
  );
END;
$$;

COMMENT ON FUNCTION public.super_admin_approve_coin IS 'Super admin approves a coin with auto or manual initial circulating supply. Creator gets allocation.';

-- Super Admin: freeze coin at zero value (floor price, pause trading)
CREATE OR REPLACE FUNCTION public.super_admin_reset_coin_to_zero(p_coin_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
  v_coin RECORD;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL OR NOT public.has_role(v_caller_id, 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Only super admin can reset coin to zero';
  END IF;

  SELECT * INTO v_coin FROM public.coins WHERE id = p_coin_id;
  IF v_coin IS NULL THEN
    RAISE EXCEPTION 'Coin not found';
  END IF;

  UPDATE public.coins
  SET
    price = 0.0001,
    price_override = 0.0001,
    use_price_override = true,
    trading_paused = true,
    volatility = 0,
    updated_at = now()
  WHERE id = p_coin_id;

  RETURN jsonb_build_object('success', true, 'message', 'Coin value reset to zero, trading paused');
END;
$$;

COMMENT ON FUNCTION public.super_admin_reset_coin_to_zero IS 'Super admin freezes coin at floor price (zero value) and pauses trading';
