-- Fix: Ensure contract_address column is properly populated even if gen_random_bytes isn't available

-- Step 1: Ensure contract_address column exists
ALTER TABLE public.coins ADD COLUMN IF NOT EXISTS contract_address text;

-- Step 2: Recreate the generate_contract_address function with fallback
-- This function will use gen_random_bytes if available, otherwise fall back to deterministic generation
CREATE OR REPLACE FUNCTION public.generate_contract_address()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.contract_address IS NULL THEN
    -- Try to use gen_random_bytes, fall back to md5 if not available
    BEGIN
      NEW.contract_address := '0x' || encode(substring(gen_random_bytes(20), 1, 20), 'hex');
    EXCEPTION WHEN OTHERS THEN
      -- Fallback: use combination of id, timestamp, and other fields
      NEW.contract_address := '0x' || substring(md5(NEW.id::text || NEW.created_at::text || NEW.symbol), 1, 40);
    END;
  END IF;
  RETURN NEW;
END;
$$;

-- Step 3: Recreate the trigger
DROP TRIGGER IF EXISTS auto_contract_address ON public.coins;

CREATE TRIGGER auto_contract_address
  BEFORE INSERT ON public.coins
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_contract_address();

-- Step 4: Fill in missing contract addresses for existing coins
-- Use deterministic generation for consistency
UPDATE public.coins 
SET contract_address = '0x' || substring(md5(id::text || created_at::text || symbol), 1, 40)
WHERE contract_address IS NULL OR contract_address = '';

-- Step 5: Verify at least some contract addresses exist
SELECT COUNT(*) as coins_with_addresses FROM public.coins WHERE contract_address IS NOT NULL;




