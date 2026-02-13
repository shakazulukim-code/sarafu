-- Enhanced bonding curve calculation with market mechanics
-- Use a sigmoid curve for more natural price discovery

CREATE OR REPLACE FUNCTION public.calculate_bonding_curve_price(
  _initial_price NUMERIC,
  _total_supply NUMERIC,
  _circulating_supply NUMERIC
)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  supply_ratio NUMERIC;
  price NUMERIC;
  curve_factor NUMERIC := 0.00001;
BEGIN
  -- Avoid division by zero and ensure we have valid numbers
  IF _total_supply <= 0 OR _initial_price <= 0 THEN
    RETURN 0.001;
  END IF;
  
  -- Calculate what percentage of supply is in circulation
  supply_ratio := _circulating_supply / _total_supply;
  
  -- More circulating supply = higher price (quadratic curve)
  -- price = initial_price * (1 + curve_factor * supply_ratio^2)
  price := _initial_price * (1 + curve_factor * (supply_ratio ^ 2));
  
  -- Add randomness based on holders for realistic volatility
  RETURN GREATEST(price, 0.0001);
END;
$$;

-- Function to calculate price impact when someone buys
CREATE OR REPLACE FUNCTION public.calculate_buy_price_impact(
  current_price NUMERIC,
  amount NUMERIC,
  current_supply NUMERIC,
  total_supply NUMERIC
)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  new_supply NUMERIC;
  new_price NUMERIC;
  impact NUMERIC;
BEGIN
  new_supply := current_supply + amount;
  
  -- Calculate new price with increased supply
  new_price := public.calculate_bonding_curve_price(
    current_price / (1 + 0.00001 * ((current_supply / total_supply) ^ 2)),
    total_supply,
    new_supply
  );
  
  -- Price impact = (new_price - current_price) / current_price
  impact := (new_price - current_price) / current_price;
  
  RETURN GREATEST(impact, -0.5); -- Max -50% impact
END;
$$;

-- Function to update coin price after transaction
CREATE OR REPLACE FUNCTION public.update_coin_price_from_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  coin_data RECORD;
  new_price NUMERIC;
  price_change_percent NUMERIC;
  new_volatility NUMERIC;
BEGIN
  -- Only process completed buy/sell transactions
  IF NEW.status != 'completed' OR NEW.type NOT IN ('buy', 'sell') THEN
    RETURN NEW;
  END IF;
  
  -- Get coin data
  SELECT * INTO coin_data FROM public.coins WHERE id = NEW.coin_id;
  
  IF coin_data IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Calculate new price based on bonding curve
  new_price := public.calculate_bonding_curve_price(
    coin_data.initial_price,
    coin_data.total_supply,
    coin_data.circulating_supply
  );
  
  -- Calculate price change percentage
  price_change_percent := ABS((new_price - coin_data.price) / coin_data.price * 100);
  
  -- Update volatility: rolling average with new price change
  new_volatility := (coin_data.volatility + price_change_percent) / 2;
  
  -- Update coin price and volatility
  UPDATE public.coins
  SET
    price = new_price,
    volatility = LEAST(new_volatility, 100),
    updated_at = now()
  WHERE id = NEW.coin_id;
  
  RETURN NEW;
END;
$$;

-- Create trigger for price updates
DROP TRIGGER IF EXISTS trigger_update_price_on_transaction ON public.transactions;

CREATE TRIGGER trigger_update_price_on_transaction
AFTER UPDATE ON public.transactions
FOR EACH ROW
WHEN (NEW.status = 'completed' AND OLD.status != 'completed')
EXECUTE FUNCTION public.update_coin_price_from_transaction();

-- Add RLS for price history
ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view price history" ON public.price_history
FOR SELECT USING (true);

-- Create function to get coin performance metrics
CREATE OR REPLACE FUNCTION public.get_coin_performance(_coin_id UUID)
RETURNS TABLE (
  current_price NUMERIC,
  price_24h_ago NUMERIC,
  change_24h_percent NUMERIC,
  high_24h NUMERIC,
  low_24h NUMERIC,
  market_cap NUMERIC,
  liquidity NUMERIC,
  volume_24h NUMERIC,
  holders_count INTEGER,
  volatility NUMERIC
)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.price,
    COALESCE(c.price_24h_ago, c.price),
    public.calculate_24h_change(_coin_id),
    c.high_24h,
    c.low_24h,
    c.market_cap,
    c.liquidity,
    c.volume_24h,
    c.holders_count,
    c.volatility
  FROM public.coins c
  WHERE c.id = _coin_id;
END;
$$;
