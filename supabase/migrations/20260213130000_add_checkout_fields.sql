-- Add dedicated fields for M-PESA identifiers and errors on transactions
-- Ensures polling uses CheckoutRequestID reliably while storing final MpesaReceiptNumber separately
-- Safe to run multiple times
DO $$
BEGIN
  -- Add checkout_request_id for STK push tracking
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'checkout_request_id'
  ) THEN
    ALTER TABLE public.transactions
    ADD COLUMN checkout_request_id TEXT;
  END IF;

  -- Add merchant_request_id for correlating requests
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'merchant_request_id'
  ) THEN
    ALTER TABLE public.transactions
    ADD COLUMN merchant_request_id TEXT;
  END IF;

  -- Add error_reason for callback/query diagnostics
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'error_reason'
  ) THEN
    ALTER TABLE public.transactions
    ADD COLUMN error_reason TEXT;
  END IF;
END;
$$;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_transactions_checkout_request ON public.transactions(checkout_request_id);
CREATE INDEX IF NOT EXISTS idx_transactions_merchant_request ON public.transactions(merchant_request_id);
