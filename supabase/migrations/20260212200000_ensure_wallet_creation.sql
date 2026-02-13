-- Create trigger to automatically create wallet when user has no wallet
CREATE OR REPLACE FUNCTION public.ensure_wallet_exists()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If this is a deposit transaction for a user without a wallet, create one
  IF NEW.type = 'deposit' AND NEW.status = 'completed' THEN
    INSERT INTO public.wallets (user_id, fiat_balance)
    VALUES (NEW.user_id, NEW.total_value)
    ON CONFLICT (user_id) DO
      UPDATE SET fiat_balance = wallets.fiat_balance + EXCLUDED.fiat_balance;
  END IF;
  RETURN NEW;
END;
$$;

-- Drop if exists and recreate
DROP TRIGGER IF EXISTS ensure_wallet_on_deposit ON public.transactions;

CREATE TRIGGER ensure_wallet_on_deposit
AFTER INSERT OR UPDATE ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.ensure_wallet_exists();

-- Ensure all users who don't have wallets get one created
-- This is a one-time operation
INSERT INTO public.wallets (user_id, fiat_balance)
SELECT auth.users.id, 1000
FROM auth.users
WHERE NOT EXISTS (SELECT 1 FROM public.wallets WHERE wallets.user_id = auth.users.id)
ON CONFLICT (user_id) DO NOTHING;
