-- Apply holdings and supply changes automatically when a transaction completes
-- This unifies wallet buys and M-PESA buys under one market-driven path
CREATE OR REPLACE FUNCTION public.update_holdings_from_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_holding RECORD;
  coin_record RECORD;
  holdersCount INTEGER;
BEGIN
  -- Only process completed buy/sell transactions
  IF NEW.status != 'completed' OR NEW.type NOT IN ('buy', 'sell') THEN
    RETURN NEW;
  END IF;

  -- BUY: increase user holdings and coin circulating supply
  IF NEW.type = 'buy' THEN
    SELECT * INTO existing_holding
    FROM public.holdings
    WHERE user_id = NEW.user_id AND coin_id = NEW.coin_id;

    IF FOUND THEN
      UPDATE public.holdings
      SET
        amount = existing_holding.amount + NEW.amount,
        average_buy_price = (
          (existing_holding.average_buy_price * existing_holding.amount) +
          (NEW.price_per_coin * NEW.amount)
        ) / (existing_holding.amount + NEW.amount),
        updated_at = now()
      WHERE id = existing_holding.id;
    ELSE
      INSERT INTO public.holdings (user_id, coin_id, amount, average_buy_price)
      VALUES (NEW.user_id, NEW.coin_id, NEW.amount, NEW.price_per_coin);
    END IF;

    SELECT circulating_supply, holders_count INTO coin_record
    FROM public.coins WHERE id = NEW.coin_id;

    IF coin_record IS NOT NULL THEN
      SELECT COUNT(*) INTO holdersCount
      FROM public.holdings
      WHERE coin_id = NEW.coin_id AND amount > 0;

      UPDATE public.coins
      SET
        circulating_supply = coin_record.circulating_supply + NEW.amount,
        holders_count = COALESCE(holdersCount, coin_record.holders_count),
        updated_at = now()
      WHERE id = NEW.coin_id;
    END IF;
  END IF;

  -- SELL: decrease user holdings and coin circulating supply
  IF NEW.type = 'sell' THEN
    SELECT * INTO existing_holding
    FROM public.holdings
    WHERE user_id = NEW.user_id AND coin_id = NEW.coin_id;

    IF FOUND THEN
      UPDATE public.holdings
      SET
        amount = GREATEST(existing_holding.amount - NEW.amount, 0),
        updated_at = now()
      WHERE id = existing_holding.id;
    END IF;

    SELECT circulating_supply, holders_count INTO coin_record
    FROM public.coins WHERE id = NEW.coin_id;

    IF coin_record IS NOT NULL THEN
      SELECT COUNT(*) INTO holdersCount
      FROM public.holdings
      WHERE coin_id = NEW.coin_id AND amount > 0;

      UPDATE public.coins
      SET
        circulating_supply = GREATEST(coin_record.circulating_supply - NEW.amount, 0),
        holders_count = COALESCE(holdersCount, coin_record.holders_count),
        updated_at = now()
      WHERE id = NEW.coin_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger on status transition to 'completed'
DROP TRIGGER IF EXISTS trigger_update_holdings_on_transaction_update ON public.transactions;
CREATE TRIGGER trigger_update_holdings_on_transaction_update
AFTER UPDATE ON public.transactions
FOR EACH ROW
WHEN (NEW.status = 'completed' AND OLD.status != 'completed')
EXECUTE FUNCTION public.update_holdings_from_transaction();

-- Also handle direct inserts with status 'completed'
DROP TRIGGER IF EXISTS trigger_update_holdings_on_transaction_insert ON public.transactions;
CREATE TRIGGER trigger_update_holdings_on_transaction_insert
AFTER INSERT ON public.transactions
FOR EACH ROW
WHEN (NEW.status = 'completed')
EXECUTE FUNCTION public.update_holdings_from_transaction();

-- Ensure price trigger also fires on INSERT completed (for immediate wallet buys)
DROP TRIGGER IF EXISTS trigger_update_price_on_transaction_insert ON public.transactions;
CREATE TRIGGER trigger_update_price_on_transaction_insert
AFTER INSERT ON public.transactions
FOR EACH ROW
WHEN (NEW.status = 'completed')
EXECUTE FUNCTION public.update_coin_price_from_transaction();
