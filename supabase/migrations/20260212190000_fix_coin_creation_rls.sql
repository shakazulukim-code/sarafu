-- Fix RLS policies for coins table to allow users to create their own coins

-- Drop existing INSERT policy
DROP POLICY IF EXISTS "Admins can create coins" ON public.coins;

-- Add policy allowing users to create coins (creators)
CREATE POLICY "Users can create coins" ON public.coins
FOR INSERT WITH CHECK (
  auth.uid() = creator_id OR public.is_admin(auth.uid())
);

-- Allow creators to view their own coins
DROP POLICY IF EXISTS "Anyone can view active coins" ON public.coins;
CREATE POLICY "Anyone can view active coins" ON public.coins
FOR SELECT USING (
  is_active = true 
  OR auth.uid() = creator_id 
  OR public.is_admin(auth.uid())
);

-- Drop existing UPDATE policy
DROP POLICY IF EXISTS "Admins can update coins" ON public.coins;

-- Allow creators to update their own coins, admins to update all
CREATE POLICY "Users can update own coins, admins can update all" ON public.coins
FOR UPDATE USING (
  auth.uid() = creator_id OR public.is_admin(auth.uid())
);
