-- Add comprehensive admin override fields to coins table
-- This allows super admin to override market-driven coin data

-- Add market cap override
ALTER TABLE public.coins
ADD COLUMN IF NOT EXISTS market_cap_override NUMERIC NULL,
ADD COLUMN IF NOT EXISTS use_market_cap_override BOOLEAN NOT NULL DEFAULT FALSE;

-- Add 24h price change override
ALTER TABLE public.coins
ADD COLUMN IF NOT EXISTS price_24h_change_override NUMERIC NULL,
ADD COLUMN IF NOT EXISTS use_price_24h_change_override BOOLEAN NOT NULL DEFAULT FALSE;

-- Add 24h volume override
ALTER TABLE public.coins
ADD COLUMN IF NOT EXISTS volume_24h_override NUMERIC NULL,
ADD COLUMN IF NOT EXISTS use_volume_24h_override BOOLEAN NOT NULL DEFAULT FALSE;

-- Create indexes for faster filtering
CREATE INDEX IF NOT EXISTS idx_coins_use_market_cap_override ON public.coins(use_market_cap_override);
CREATE INDEX IF NOT EXISTS idx_coins_use_price_24h_override ON public.coins(use_price_24h_change_override);
CREATE INDEX IF NOT EXISTS idx_coins_use_volume_24h_override ON public.coins(use_volume_24h_override);

-- Comments for documentation
COMMENT ON COLUMN public.coins.market_cap_override IS 'Override market cap set by admin (only if use_market_cap_override = true)';
COMMENT ON COLUMN public.coins.use_market_cap_override IS 'If true, use market_cap_override instead of calculated market cap';
COMMENT ON COLUMN public.coins.price_24h_change_override IS 'Override 24h price change percentage set by admin';
COMMENT ON COLUMN public.coins.use_price_24h_change_override IS 'If true, use price_24h_change_override instead of calculated change';
COMMENT ON COLUMN public.coins.volume_24h_override IS 'Override 24h trading volume set by admin';
COMMENT ON COLUMN public.coins.use_volume_24h_override IS 'If true, use volume_24h_override instead of calculated volume';
