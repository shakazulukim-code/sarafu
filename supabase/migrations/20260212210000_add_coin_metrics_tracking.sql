-- Add detailed metrics columns to coins
ALTER TABLE public.coins
ADD COLUMN IF NOT EXISTS price_24h_ago NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS high_24h NUMERIC NOT NULL DEFAULT 0.001,
ADD COLUMN IF NOT EXISTS low_24h NUMERIC NOT NULL DEFAULT 0.001,
ADD COLUMN IF NOT EXISTS volume_24h NUMERIC NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS liquidity NUMERIC NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS holders_count INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS volatility NUMERIC NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_price_update TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Create price history table to track price changes over time
CREATE TABLE IF NOT EXISTS public.price_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  coin_id UUID NOT NULL REFERENCES public.coins(id) ON DELETE CASCADE,
  price NUMERIC NOT NULL,
  circulating_supply NUMERIC NOT NULL,
  market_cap NUMERIC NOT NULL,
  volume_24h NUMERIC NOT NULL DEFAULT 0,
  holders_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  UNIQUE(coin_id, created_at)
);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_price_history_coin_id_created 
ON public.price_history(coin_id, created_at DESC);

-- Create function to calculate 24h change percentage
CREATE OR REPLACE FUNCTION public.calculate_24h_change(coin_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  current_price NUMERIC;
  price_24h_ago NUMERIC;
  change_percent NUMERIC;
BEGIN
  -- Get current price
  SELECT price INTO current_price FROM public.coins WHERE id = coin_id;
  
  IF current_price IS NULL THEN
    RETURN 0;
  END IF;
  
  -- Get price from 24 hours ago
  SELECT price INTO price_24h_ago 
  FROM public.price_history
  WHERE coin_id = price_history.coin_id 
    AND created_at >= now() - INTERVAL '24 hours'
  ORDER BY created_at ASC
  LIMIT 1;
  
  -- If no history, return 0
  IF price_24h_ago IS NULL THEN
    RETURN 0;
  END IF;
  
  -- Calculate percentage change
  change_percent := ((current_price - price_24h_ago) / price_24h_ago) * 100;
  
  RETURN ROUND(change_percent::numeric, 2);
END;
$$;

-- Create function to update coin metrics after a buy/sell
CREATE OR REPLACE FUNCTION public.update_coin_metrics()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  coin_data RECORD;
  holders_count INTEGER;
  volume_24h NUMERIC;
BEGIN
  -- Only process on completed buy/sell transactions
  IF NEW.status != 'completed' OR NEW.type NOT IN ('buy', 'sell') THEN
    RETURN NEW;
  END IF;
  
  -- Get current coin data
  SELECT * INTO coin_data FROM public.coins WHERE id = NEW.coin_id;
  
  IF coin_data IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Count unique holders (users with amount > 0)
  SELECT COUNT(DISTINCT user_id) INTO holders_count
  FROM public.holdings
  WHERE coin_id = NEW.coin_id AND amount > 0;
  
  -- Calculate 24h volume
  SELECT COALESCE(SUM(total_value), 0) INTO volume_24h
  FROM public.transactions
  WHERE coin_id = NEW.coin_id 
    AND status = 'completed'
    AND type IN ('buy', 'sell')
    AND created_at >= now() - INTERVAL '24 hours';
  
  -- Update coin metrics
  UPDATE public.coins
  SET
    holders_count = COALESCE(holders_count, 0),
    volume_24h = volume_24h,
    high_24h = CASE 
      WHEN price > COALESCE(high_24h, 0) THEN price 
      ELSE COALESCE(high_24h, 0) 
    END,
    low_24h = CASE 
      WHEN price > 0 AND (low_24h = 0 OR price < low_24h) THEN price 
      ELSE COALESCE(low_24h, 0.001) 
    END,
    liquidity = volume_24h * 0.5, -- 50% of volume as liquidity approximation
    last_price_update = now(),
    updated_at = now()
  WHERE id = NEW.coin_id;
  
  -- Record price history snapshot
  INSERT INTO public.price_history 
    (coin_id, price, circulating_supply, market_cap, volume_24h, holders_count, created_at)
  VALUES 
    (NEW.coin_id, coin_data.price, coin_data.circulating_supply, coin_data.market_cap, volume_24h, holders_count, now())
  ON CONFLICT (coin_id, created_at) DO UPDATE SET
    volume_24h = EXCLUDED.volume_24h,
    holders_count = EXCLUDED.holders_count;
  
  RETURN NEW;
END;
$$;

-- Drop old trigger if exists and create new one
DROP TRIGGER IF EXISTS trigger_update_coin_metrics ON public.transactions;

CREATE TRIGGER trigger_update_coin_metrics
AFTER INSERT OR UPDATE ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.update_coin_metrics();

-- Create view for coin metrics
CREATE OR REPLACE VIEW public.coin_metrics AS
SELECT
  c.id,
  c.name,
  c.symbol,
  c.price,
  c.circulating_supply,
  c.market_cap,
  c.holders_count,
  c.volume_24h,
  c.liquidity,
  c.high_24h,
  c.low_24h,
  public.calculate_24h_change(c.id) as change_24h_percent,
  c.volatility,
  COUNT(DISTINCT ph.id) as price_points_24h
FROM public.coins c
LEFT JOIN public.price_history ph 
  ON c.id = ph.coin_id 
  AND ph.created_at >= now() - INTERVAL '24 hours'
GROUP BY c.id, c.name, c.symbol, c.price, c.circulating_supply, c.market_cap, 
         c.holders_count, c.volume_24h, c.liquidity, c.high_24h, c.low_24h, c.volatility;

-- Initialize price history for existing coins
INSERT INTO public.price_history (coin_id, price, circulating_supply, market_cap, volume_24h, holders_count)
SELECT 
  c.id,
  c.price,
  c.circulating_supply,
  c.market_cap,
  0,
  COALESCE((
    SELECT COUNT(DISTINCT user_id)
    FROM public.holdings
    WHERE coin_id = c.id AND amount > 0
  ), 0)
FROM public.coins c
WHERE NOT EXISTS (
  SELECT 1 FROM public.price_history WHERE coin_id = c.id
)
ON CONFLICT DO NOTHING;
