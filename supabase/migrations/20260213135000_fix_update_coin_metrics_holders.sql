CREATE OR REPLACE FUNCTION public.update_coin_metrics()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  coin_data RECORD;
  v_holders_count INTEGER;
  v_volume_24h NUMERIC;
BEGIN
  IF NEW.status != 'completed' OR NEW.type NOT IN ('buy', 'sell') THEN
    RETURN NEW;
  END IF;
  
  SELECT * INTO coin_data FROM public.coins WHERE id = NEW.coin_id;
  
  IF coin_data IS NULL THEN
    RETURN NEW;
  END IF;
  
  SELECT COUNT(DISTINCT user_id) INTO v_holders_count
  FROM public.holdings
  WHERE coin_id = NEW.coin_id AND amount > 0;
  
  SELECT COALESCE(SUM(total_value), 0) INTO v_volume_24h
  FROM public.transactions
  WHERE coin_id = NEW.coin_id 
    AND status = 'completed'
    AND type IN ('buy', 'sell')
    AND created_at >= now() - INTERVAL '24 hours';
  
  UPDATE public.coins
  SET
    holders_count = COALESCE(v_holders_count, 0),
    volume_24h = v_volume_24h,
    high_24h = CASE 
      WHEN price > COALESCE(high_24h, 0) THEN price 
      ELSE COALESCE(high_24h, 0) 
    END,
    low_24h = CASE 
      WHEN price > 0 AND (low_24h = 0 OR price < low_24h) THEN price 
      ELSE COALESCE(low_24h, 0.001) 
    END,
    liquidity = v_volume_24h * 0.5,
    last_price_update = now(),
    updated_at = now()
  WHERE id = NEW.coin_id;
  
  INSERT INTO public.price_history 
    (coin_id, price, circulating_supply, market_cap, volume_24h, holders_count, created_at)
  VALUES 
    (NEW.coin_id, coin_data.price, coin_data.circulating_supply, coin_data.market_cap, v_volume_24h, v_holders_count, now())
  ON CONFLICT (coin_id, created_at) DO UPDATE SET
    volume_24h = EXCLUDED.volume_24h,
    holders_count = EXCLUDED.holders_count;
  
  RETURN NEW;
END;
$$;
