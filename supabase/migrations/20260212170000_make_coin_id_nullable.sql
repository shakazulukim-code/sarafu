-- Make coin_id nullable for deposit and withdrawal transactions
ALTER TABLE transactions ALTER COLUMN coin_id DROP NOT NULL;

-- Add comment explaining when coin_id can be NULL
COMMENT ON COLUMN transactions.coin_id IS 'Foreign key to coins. NULL for deposit, withdrawal, and other non-coin transactions.';
