-- Verification SQL Commands
-- Run these in Supabase SQL Editor to verify the fixes are working

-- 1. Verify contract address function exists and is correct
SELECT 
  proname,
  prosrc
FROM pg_proc 
WHERE proname = 'generate_contract_address' 
AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- 2. Verify trigger is attached to coins table
SELECT 
  tgname,
  tgrelid::regclass as table_name,
  tgprocid::regprocedure as function_name
FROM pg_trigger 
WHERE tgname = 'auto_contract_address';

-- 3. Check contract addresses for existing coins
SELECT 
  id,
  name,
  symbol,
  contract_address,
  created_at
FROM public.coins 
WHERE contract_address IS NOT NULL
LIMIT 20;

-- 4. Check for any coins missing contract addresses (should be empty)
SELECT id, name, symbol FROM public.coins WHERE contract_address IS NULL;

-- 5. Verify trigger fires on new coin creation
-- (After creating a new coin, run this to verify it got an address)
SELECT 
  id,
  name,
  symbol,
  contract_address,
  created_at
FROM public.coins 
ORDER BY created_at DESC 
LIMIT 1;

-- 6. Check transaction status tracking
SELECT 
  id,
  type,
  status,
  mpesa_receipt,
  created_at
FROM public.transactions 
WHERE type IN ('coin_creation', 'buy')
ORDER BY created_at DESC
LIMIT 10;

-- 7. Verify coins with completed payments
SELECT 
  c.id,
  c.name,
  c.symbol,
  c.creation_fee_paid,
  c.approval_status,
  c.created_at
FROM public.coins c
WHERE c.creation_fee_paid = true
ORDER BY c.updated_at DESC
LIMIT 10;

-- 8. Test function creation inline
-- This tests if the fallback MD5 method works
SELECT '0x' || substring(md5('test-id-' || now()::text), 1, 40) as test_address;

-- 9. Check if pgcrypto is available (will show extension in results)
SELECT * FROM pg_extension WHERE extname = 'pgcrypto';

-- 10. Monitor callback function execution (check for errors)
SELECT 
  id,
  name,
  created_at,
  updated_at
FROM pg_stat_user_functions 
WHERE funcname LIKE '%mpesa%' 
OR funcname LIKE '%callback%'
LIMIT 10;

-- Troubleshooting Queries

-- If coin creation payments aren't working, check this:
SELECT 
  t.id,
  t.type,
  t.status,
  c.creation_fee_paid,
  c.approval_status,
  t.created_at
FROM public.transactions t
JOIN public.coins c ON c.id = t.coin_id
WHERE t.type = 'coin_creation'
ORDER BY t.created_at DESC
LIMIT 5;

-- Check for failed transactions
SELECT 
  id,
  type,
  status,
  user_id,
  coin_id,
  created_at
FROM public.transactions 
WHERE status = 'failed'
ORDER BY created_at DESC
LIMIT 10;

-- Get stats on coin creation payments
SELECT 
  COUNT(*) as total_coins,
  SUM(CASE WHEN creation_fee_paid = true THEN 1 ELSE 0 END) as paid_coins,
  SUM(CASE WHEN creation_fee_paid = false THEN 1 ELSE 0 END) as unpaid_coins
FROM public.coins;
