-- Add missing fields to transactions table for proper payment status tracking

-- First, update the type constraint to include coin_creation
ALTER TABLE public.transactions 
DROP CONSTRAINT IF EXISTS "transactions_type_check",
ADD CONSTRAINT "transactions_type_check" CHECK (type IN ('buy', 'sell', 'allocation', 'burn', 'coin_creation', 'deposit'));

-- Update the status constraint to include new statuses
ALTER TABLE public.transactions 
DROP CONSTRAINT IF EXISTS "transactions_status_check",
ADD CONSTRAINT "transactions_status_check" CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled', 'stk_sent', 'timeout'));

-- Add error_reason column if it doesn't exist
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS error_reason TEXT;

-- Add merchant_request_id for tracking M-PESA requests
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS merchant_request_id TEXT;

-- Create index on mpesa_receipt for faster lookups
CREATE INDEX IF NOT EXISTS idx_transactions_mpesa_receipt ON public.transactions(mpesa_receipt) WHERE mpesa_receipt IS NOT NULL;

-- Create index on status for filtering transactions
CREATE INDEX IF NOT EXISTS idx_transactions_status ON public.transactions(status);

-- Create index on user_id and created_at for user transaction history
CREATE INDEX IF NOT EXISTS idx_transactions_user_created ON public.transactions(user_id, created_at DESC);

-- Add comment to document the new fields
COMMENT ON COLUMN public.transactions.error_reason IS 'Stores error message if payment fails or is cancelled';
COMMENT ON COLUMN public.transactions.merchant_request_id IS 'M-PESA merchant request ID for tracking';
