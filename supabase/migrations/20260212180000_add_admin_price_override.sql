-- Add columns for super admin price control
ALTER TABLE public.coins
ADD COLUMN IF NOT EXISTS price_override NUMERIC NULL,
ADD COLUMN IF NOT EXISTS use_price_override BOOLEAN NOT NULL DEFAULT FALSE;

-- Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_coins_use_price_override ON public.coins(use_price_override);

-- Comment
COMMENT ON COLUMN public.coins.price_override IS 'Override price set by super admin (only if use_price_override = true)';
COMMENT ON COLUMN public.coins.use_price_override IS 'If true, use price_override instead of market-driven pricing';
