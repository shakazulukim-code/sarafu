CREATE OR REPLACE FUNCTION public.update_holdings_from_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_holding RECORD;
  coin_record RECORD;
  v_holders_count INTEGER;
  v_new_amount NUMERIC;
BEGIN
  IF NEW.status != 'completed' OR NEW.type NOT IN ('buy', 'sell') THEN
    RETURN NEW;
  END IF;

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
      SELECT COUNT(*) INTO v_holders_count
      FROM public.holdings
      WHERE coin_id = NEW.coin_id AND amount > 0;

      UPDATE public.coins
      SET
        circulating_supply = coin_record.circulating_supply + NEW.amount,
        holders_count = COALESCE(v_holders_count, coin_record.holders_count),
        updated_at = now()
      WHERE id = NEW.coin_id;
    END IF;
  END IF;

  IF NEW.type = 'sell' THEN
    SELECT * INTO existing_holding
    FROM public.holdings
    WHERE user_id = NEW.user_id AND coin_id = NEW.coin_id;

    IF FOUND THEN
      v_new_amount := existing_holding.amount - NEW.amount;
      IF v_new_amount <= 0 THEN
        DELETE FROM public.holdings WHERE id = existing_holding.id;
      ELSE
        UPDATE public.holdings
        SET
          amount = v_new_amount,
          updated_at = now()
        WHERE id = existing_holding.id;
      END IF;
    END IF;

    SELECT circulating_supply, holders_count INTO coin_record
    FROM public.coins WHERE id = NEW.coin_id;

    IF coin_record IS NOT NULL THEN
      SELECT COUNT(*) INTO v_holders_count
      FROM public.holdings
      WHERE coin_id = NEW.coin_id AND amount > 0;

      UPDATE public.coins
      SET
        circulating_supply = GREATEST(coin_record.circulating_supply - NEW.amount, 0),
        holders_count = COALESCE(v_holders_count, coin_record.holders_count),
        updated_at = now()
      WHERE id = NEW.coin_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
