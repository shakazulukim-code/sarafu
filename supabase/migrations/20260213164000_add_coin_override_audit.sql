-- Create audit log table for tracking admin overrides
-- Provides transparency and accountability for admin actions

CREATE TABLE IF NOT EXISTS public.coin_override_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coin_id UUID NOT NULL REFERENCES public.coins(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL REFERENCES auth.users(id),
  field_name TEXT NOT NULL, -- e.g., 'price', 'market_cap', 'price_24h_change', 'volume_24h'
  old_value NUMERIC,
  new_value NUMERIC,
  override_enabled BOOLEAN NOT NULL, -- true if enabling override, false if disabling
  notes TEXT, -- Optional admin notes about why override was made
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_coin_override_audit_coin 
ON public.coin_override_audit(coin_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_coin_override_audit_admin 
ON public.coin_override_audit(admin_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_coin_override_audit_field 
ON public.coin_override_audit(field_name);

-- Enable RLS
ALTER TABLE public.coin_override_audit ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Admins can read all audit logs
CREATE POLICY "Admins can read audit logs"
ON public.coin_override_audit FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'super_admin')
  )
);

-- Function to automatically log override changes
CREATE OR REPLACE FUNCTION log_coin_override_change()
RETURNS TRIGGER AS $$
DECLARE
  admin_user_id UUID;
BEGIN
  -- Get current user ID (admin making the change)
  admin_user_id := auth.uid();
  
  -- Log price override changes
  IF (NEW.use_price_override IS DISTINCT FROM OLD.use_price_override) OR 
     (NEW.price_override IS DISTINCT FROM OLD.price_override) THEN
    INSERT INTO public.coin_override_audit (coin_id, admin_id, field_name, old_value, new_value, override_enabled)
    VALUES (NEW.id, admin_user_id, 'price', OLD.price_override, NEW.price_override, NEW.use_price_override);
  END IF;
  
  -- Log market cap override changes
  IF (NEW.use_market_cap_override IS DISTINCT FROM OLD.use_market_cap_override) OR 
     (NEW.market_cap_override IS DISTINCT FROM OLD.market_cap_override) THEN
    INSERT INTO public.coin_override_audit (coin_id, admin_id, field_name, old_value, new_value, override_enabled)
    VALUES (NEW.id, admin_user_id, 'market_cap', OLD.market_cap_override, NEW.market_cap_override, NEW.use_market_cap_override);
  END IF;
  
  -- Log 24h price change override changes
  IF (NEW.use_price_24h_change_override IS DISTINCT FROM OLD.use_price_24h_change_override) OR 
     (NEW.price_24h_change_override IS DISTINCT FROM OLD.price_24h_change_override) THEN
    INSERT INTO public.coin_override_audit (coin_id, admin_id, field_name, old_value, new_value, override_enabled)
    VALUES (NEW.id, admin_user_id, 'price_24h_change', OLD.price_24h_change_override, NEW.price_24h_change_override, NEW.use_price_24h_change_override);
  END IF;
  
  -- Log 24h volume override changes
  IF (NEW.use_volume_24h_override IS DISTINCT FROM OLD.use_volume_24h_override) OR 
     (NEW.volume_24h_override IS DISTINCT FROM OLD.volume_24h_override) THEN
    INSERT INTO public.coin_override_audit (coin_id, admin_id, field_name, old_value, new_value, override_enabled)
    VALUES (NEW.id, admin_user_id, 'volume_24h', OLD.volume_24h_override, NEW.volume_24h_override, NEW.use_volume_24h_override);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically log override changes
CREATE TRIGGER coin_override_audit_trigger
AFTER UPDATE ON public.coins
FOR EACH ROW
WHEN (
  (NEW.use_price_override IS DISTINCT FROM OLD.use_price_override) OR
  (NEW.price_override IS DISTINCT FROM OLD.price_override) OR
  (NEW.use_market_cap_override IS DISTINCT FROM OLD.use_market_cap_override) OR
  (NEW.market_cap_override IS DISTINCT FROM OLD.market_cap_override) OR
  (NEW.use_price_24h_change_override IS DISTINCT FROM OLD.use_price_24h_change_override) OR
  (NEW.price_24h_change_override IS DISTINCT FROM OLD.price_24h_change_override) OR
  (NEW.use_volume_24h_override IS DISTINCT FROM OLD.use_volume_24h_override) OR
  (NEW.volume_24h_override IS DISTINCT FROM OLD.volume_24h_override)
)
EXECUTE FUNCTION log_coin_override_change();

COMMENT ON TABLE public.coin_override_audit IS 'Audit log for tracking admin override changes to coin data';
COMMENT ON FUNCTION log_coin_override_change IS 'Automatically logs when admin modifies coin override values';
