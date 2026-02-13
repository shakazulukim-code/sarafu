-- Add performance indexes for frequently queried columns
-- This significantly improves query performance for common operations

-- Coins table indexes
CREATE INDEX IF NOT EXISTS idx_coins_is_active_approved 
ON public.coins(is_active, is_approved) 
WHERE is_active = true AND is_approved = true;

CREATE INDEX IF NOT EXISTS idx_coins_creator_id 
ON public.coins(creator_id);

CREATE INDEX IF NOT EXISTS idx_coins_created_at_desc 
ON public.coins(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_coins_market_cap_desc 
ON public.coins(market_cap DESC NULLS LAST);

-- Transactions table indexes
CREATE INDEX IF NOT EXISTS idx_transactions_user_status 
ON public.transactions(user_id, status);

CREATE INDEX IF NOT EXISTS idx_transactions_coin_status 
ON public.transactions(coin_id, status) 
WHERE coin_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_type_status 
ON public.transactions(type, status);

CREATE INDEX IF NOT EXISTS idx_transactions_created_at_desc 
ON public.transactions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_checkout_request 
ON public.transactions(checkout_request_id) 
WHERE checkout_request_id IS NOT NULL;

-- Holdings table indexes
CREATE INDEX IF NOT EXISTS idx_holdings_user_coin 
ON public.holdings(user_id, coin_id);

CREATE INDEX IF NOT EXISTS idx_holdings_coin_amount 
ON public.holdings(coin_id, amount DESC);

-- Price history indexes
CREATE INDEX IF NOT EXISTS idx_price_history_coin_created 
ON public.price_history(coin_id, created_at DESC);

-- Wallets table index
CREATE INDEX IF NOT EXISTS idx_wallets_user_id 
ON public.wallets(user_id);

-- User roles index
CREATE INDEX IF NOT EXISTS idx_user_roles_user_role 
ON public.user_roles(user_id, role);

-- Withdrawal requests indexes
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status 
ON public.withdrawal_requests(status);

CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_user_status 
ON public.withdrawal_requests(user_id, status);

COMMENT ON INDEX idx_coins_is_active_approved IS 'Speeds up queries for active and approved coins on launchpad';
COMMENT ON INDEX idx_transactions_user_status IS 'Speeds up user transaction history queries';
COMMENT ON INDEX idx_price_history_coin_created IS 'Speeds up coin price chart queries';
