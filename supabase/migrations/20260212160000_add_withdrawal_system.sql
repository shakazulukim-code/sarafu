-- Create withdrawal requests table
CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount DECIMAL(20, 2) NOT NULL,
  phone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'processing', 'completed', 'failed')),
  reason TEXT,
  withdrawal_fee DECIMAL(10, 2) NOT NULL DEFAULT 0,
  mpesa_receipt TEXT,
  mpesa_error_reason TEXT,
  admin_notes TEXT,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies for withdrawal requests
CREATE POLICY "Users can view their own withdrawals" ON public.withdrawal_requests 
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create withdrawal requests" ON public.withdrawal_requests 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all withdrawal requests" ON public.withdrawal_requests 
  FOR SELECT USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage all withdrawal requests" ON public.withdrawal_requests 
  FOR ALL USING (public.is_admin(auth.uid()));

-- Create indexes for fast lookups
CREATE INDEX idx_withdrawal_status ON public.withdrawal_requests(status);
CREATE INDEX idx_withdrawal_user ON public.withdrawal_requests(user_id, created_at DESC);
CREATE INDEX idx_withdrawal_approved_by ON public.withdrawal_requests(approved_by);
CREATE INDEX idx_withdrawal_created ON public.withdrawal_requests(created_at DESC);

-- Create trigger for updated_at
CREATE TRIGGER update_withdrawal_requests_updated_at 
  BEFORE UPDATE ON public.withdrawal_requests 
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add withdrawal settings to site_settings
ALTER TABLE public.site_settings
ADD COLUMN IF NOT EXISTS withdrawal_fee_percentage DECIMAL(5, 2) NOT NULL DEFAULT 2.5,
ADD COLUMN IF NOT EXISTS min_withdrawal DECIMAL(10, 2) NOT NULL DEFAULT 100,
ADD COLUMN IF NOT EXISTS max_withdrawal DECIMAL(10, 2) NOT NULL DEFAULT 50000,
ADD COLUMN IF NOT EXISTS require_phone_verification BOOLEAN NOT NULL DEFAULT true;

-- Add comments
COMMENT ON TABLE public.withdrawal_requests IS 'Stores user withdrawal requests with approval workflow';
COMMENT ON COLUMN public.withdrawal_requests.status IS 'pending -> approved -> processing -> completed, or rejected/failed';
COMMENT ON COLUMN public.withdrawal_requests.withdrawal_fee IS 'Fee deducted from withdrawal amount';
COMMENT ON COLUMN public.withdrawal_requests.mpesa_receipt IS 'M-PESA receipt number after payout';
