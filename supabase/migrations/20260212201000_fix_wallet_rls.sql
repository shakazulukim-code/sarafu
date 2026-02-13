-- Add INSERT policy for wallets table to allow service role to create wallets
CREATE POLICY "System can insert wallets" ON public.wallets
FOR INSERT WITH CHECK (true);

-- Drop and recreate the update policy
DROP POLICY IF EXISTS "Users can update their own wallet" ON public.wallets;
DROP POLICY IF EXISTS "Admins can manage all wallets" ON public.wallets;

-- Create new policies
CREATE POLICY "Users can update their own wallet" ON public.wallets
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all wallets" ON public.wallets
FOR ALL USING (is_admin(auth.uid()));

-- System/service functions can also update wallets
CREATE POLICY "System can update wallets" ON public.wallets
FOR UPDATE USING (true);
