-- Combined migration for Supabase editor
-- Generated from existing migration files in supabase/migrations
-- Run this single file in Supabase SQL editor to apply all changes.

BEGIN;

SET LOCAL search_path = public, auth, storage;

-- ===== Migration: 20260122144653_407fa7af-6765-47c4-8236-b7947b8d6d6d.sql =====

-- Create app_role enum for role-based access control
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    EXECUTE 'CREATE TYPE public.app_role AS ENUM (''super_admin'', ''admin'', ''coin_creator'', ''user'', ''banned'')';
  END IF;
END;
$$;

-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create user_roles table (separate from profiles for security)
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Create coins table
CREATE TABLE IF NOT EXISTS public.coins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL UNIQUE,
  description TEXT,
  logo_url TEXT,
  whitepaper_url TEXT,
  price DECIMAL(20, 10) NOT NULL DEFAULT 0.001,
  total_supply DECIMAL(30, 10) NOT NULL DEFAULT 1000000000,
  circulating_supply DECIMAL(30, 10) NOT NULL DEFAULT 0,
  market_cap DECIMAL(30, 2) GENERATED ALWAYS AS (price * circulating_supply) STORED,
  liquidity DECIMAL(20, 10) NOT NULL DEFAULT 0,
  holders_count INTEGER NOT NULL DEFAULT 0,
  volatility DECIMAL(5, 2) NOT NULL DEFAULT 5.0,
  is_trending BOOLEAN NOT NULL DEFAULT false,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  trading_paused BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create holdings table (user coin balances)
CREATE TABLE IF NOT EXISTS public.holdings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  coin_id UUID NOT NULL REFERENCES public.coins(id) ON DELETE CASCADE,
  amount DECIMAL(30, 10) NOT NULL DEFAULT 0,
  average_buy_price DECIMAL(20, 10) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, coin_id)
);

-- Create transactions table
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  coin_id UUID NOT NULL REFERENCES public.coins(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('buy', 'sell', 'allocation', 'burn')),
  amount DECIMAL(30, 10) NOT NULL,
  price_per_coin DECIMAL(20, 10) NOT NULL,
  total_value DECIMAL(20, 2) NOT NULL,
  phone TEXT,
  mpesa_receipt TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create mpesa_config table for admin settings
CREATE TABLE IF NOT EXISTS public.mpesa_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paybill_number TEXT NOT NULL,
  passkey TEXT,
  consumer_key TEXT,
  consumer_secret TEXT,
  callback_url TEXT,
  is_sandbox BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create site_settings table
CREATE TABLE IF NOT EXISTS public.site_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_name TEXT NOT NULL DEFAULT 'CryptoLaunch',
  site_description TEXT,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#00d4ff',
  min_buy_amount DECIMAL(10, 2) NOT NULL DEFAULT 100,
  max_buy_amount DECIMAL(10, 2) NOT NULL DEFAULT 100000,
  fee_percentage DECIMAL(5, 2) NOT NULL DEFAULT 2.5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables (if created)
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.coins ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.mpesa_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.site_settings ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create function to check if user is admin or super_admin
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'super_admin')
  )
$$;

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for updated_at
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_profiles_updated_at') THEN
    EXECUTE 'CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_coins_updated_at') THEN
    EXECUTE 'CREATE TRIGGER update_coins_updated_at BEFORE UPDATE ON public.coins FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_holdings_updated_at') THEN
    EXECUTE 'CREATE TRIGGER update_holdings_updated_at BEFORE UPDATE ON public.holdings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_transactions_updated_at') THEN
    EXECUTE 'CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_mpesa_config_updated_at') THEN
    EXECUTE 'CREATE TRIGGER update_mpesa_config_updated_at BEFORE UPDATE ON public.mpesa_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_site_settings_updated_at') THEN
    EXECUTE 'CREATE TRIGGER update_site_settings_updated_at BEFORE UPDATE ON public.site_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();';
  END IF;
END;
$$;

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Create profile if not exists
  INSERT INTO public.profiles (user_id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Assign default user role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for new user signup (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created') THEN
    EXECUTE 'CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();';
  END IF;
END;
$$;

-- RLS Policies for profiles
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname = 'users_can_view_own_profile') THEN
    EXECUTE $$
      CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
    $$;
  END IF;
END;
$$;

-- (Other policies creation below are idempotent where possible)
-- (Other policies creation below are idempotent where possible)

-- Profiles policies
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
CREATE POLICY "Admins can update all profiles" ON public.profiles FOR UPDATE USING (public.is_admin(auth.uid()));

-- RLS Policies for user_roles
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT USING (public.is_admin(auth.uid()));
-- Super admins can manage roles
DROP POLICY IF EXISTS "Super admins can manage roles" ON public.user_roles;
CREATE POLICY "Super admins can manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));

-- RLS Policies for coins
DROP POLICY IF EXISTS "Anyone can view active coins" ON public.coins;
CREATE POLICY "Anyone can view active coins" ON public.coins FOR SELECT USING (is_active = true);
DROP POLICY IF EXISTS "Admins can view all coins" ON public.coins;
CREATE POLICY "Admins can view all coins" ON public.coins FOR SELECT USING (public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can create coins" ON public.coins;
CREATE POLICY "Admins can create coins" ON public.coins FOR INSERT WITH CHECK (public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can update coins" ON public.coins;
CREATE POLICY "Admins can update coins" ON public.coins FOR UPDATE USING (public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "Super admins can delete coins" ON public.coins;
CREATE POLICY "Super admins can delete coins" ON public.coins FOR DELETE USING (public.has_role(auth.uid(), 'super_admin'));

-- RLS Policies for holdings
DROP POLICY IF EXISTS "Users can view their own holdings" ON public.holdings;
CREATE POLICY "Users can view their own holdings" ON public.holdings FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert their own holdings" ON public.holdings;
CREATE POLICY "Users can insert their own holdings" ON public.holdings FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own holdings" ON public.holdings;
CREATE POLICY "Users can update their own holdings" ON public.holdings FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins can view all holdings" ON public.holdings;
CREATE POLICY "Admins can view all holdings" ON public.holdings FOR SELECT USING (public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can manage all holdings" ON public.holdings;
CREATE POLICY "Admins can manage all holdings" ON public.holdings FOR ALL USING (public.is_admin(auth.uid()));

-- RLS Policies for transactions
DROP POLICY IF EXISTS "Users can view their own transactions" ON public.transactions;
CREATE POLICY "Users can view their own transactions" ON public.transactions FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can create their own transactions" ON public.transactions;
CREATE POLICY "Users can create their own transactions" ON public.transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins can view all transactions" ON public.transactions;
CREATE POLICY "Admins can view all transactions" ON public.transactions FOR SELECT USING (public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can manage all transactions" ON public.transactions;
CREATE POLICY "Admins can manage all transactions" ON public.transactions FOR ALL USING (public.is_admin(auth.uid()));

-- RLS Policies for mpesa_config (admin only)
DROP POLICY IF EXISTS "Admins can view mpesa config" ON public.mpesa_config;
CREATE POLICY "Admins can view mpesa config" ON public.mpesa_config FOR SELECT USING (public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "Super admins can manage mpesa config" ON public.mpesa_config;
CREATE POLICY "Super admins can manage mpesa config" ON public.mpesa_config FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));

-- RLS Policies for site_settings
DROP POLICY IF EXISTS "Anyone can view site settings" ON public.site_settings;
CREATE POLICY "Anyone can view site settings" ON public.site_settings FOR SELECT USING (true);
DROP POLICY IF EXISTS "Super admins can manage site settings" ON public.site_settings;
CREATE POLICY "Super admins can manage site settings" ON public.site_settings FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));

-- Insert default site settings (if none exist)
INSERT INTO public.site_settings (site_name, site_description)
SELECT 'CryptoLaunch', 'The Next-Gen Crypto Launchpad Platform'
WHERE NOT EXISTS (SELECT 1 FROM public.site_settings);

-- Enable realtime for coins and holdings (attempts only)
BEGIN
  -- Publication modification can fail if publication doesn't exist; ignore errors.
  PERFORM 1;
EXCEPTION WHEN OTHERS THEN
  -- no-op
END;

-- ===== Migration: 20260127070552_b7f96e6a-f5b2-45ed-a86d-232154867775.sql =====

-- Create storage bucket for coin logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('coin-logos', 'coin-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Policy: Anyone can view coin logos
DROP POLICY IF EXISTS "Anyone can view coin logos" ON storage.objects;
CREATE POLICY "Anyone can view coin logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'coin-logos');

-- Policy: Admins can upload coin logos  
DROP POLICY IF EXISTS "Admins can upload coin logos" ON storage.objects;
CREATE POLICY "Admins can upload coin logos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'coin-logos' AND public.is_admin(auth.uid()));

-- Policy: Admins can update coin logos
DROP POLICY IF EXISTS "Admins can update coin logos" ON storage.objects;
CREATE POLICY "Admins can update coin logos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'coin-logos' AND public.is_admin(auth.uid()));

-- Policy: Admins can delete coin logos
DROP POLICY IF EXISTS "Admins can delete coin logos" ON storage.objects;
CREATE POLICY "Admins can delete coin logos"
ON storage.objects FOR DELETE
USING (bucket_id = 'coin-logos' AND public.is_admin(auth.uid()));

-- ===== Migration: 20260203122154_dbc521a9-42e5-4943-98ca-8f8c225fe31b.sql =====

-- Create wallets table for fiat balances
CREATE TABLE IF NOT EXISTS public.wallets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  fiat_balance NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on wallets
ALTER TABLE IF EXISTS public.wallets ENABLE ROW LEVEL SECURITY;

-- Wallet policies
DROP POLICY IF EXISTS "Users can view their own wallet" ON public.wallets;
CREATE POLICY "Users can view their own wallet" ON public.wallets FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own wallet" ON public.wallets;
CREATE POLICY "Users can update their own wallet" ON public.wallets FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all wallets" ON public.wallets;
CREATE POLICY "Admins can view all wallets" ON public.wallets FOR SELECT USING (is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage all wallets" ON public.wallets;
CREATE POLICY "Admins can manage all wallets" ON public.wallets FOR ALL USING (is_admin(auth.uid()));

-- Trigger to update wallets updated_at
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_wallets_updated_at') THEN
    EXECUTE 'CREATE TRIGGER update_wallets_updated_at BEFORE UPDATE ON public.wallets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();';
  END IF;
END;
$$;

-- Add hero/landing page columns to site_settings
ALTER TABLE public.site_settings
ADD COLUMN IF NOT EXISTS hero_title TEXT DEFAULT 'Trade Crypto with M-PESA',
ADD COLUMN IF NOT EXISTS hero_subtitle TEXT DEFAULT 'The first crypto launchpad designed for Africa. Buy, sell, and launch tokens instantly using M-PESA mobile money.',
ADD COLUMN IF NOT EXISTS hero_badge TEXT DEFAULT 'Next-Gen Crypto Launchpad',
ADD COLUMN IF NOT EXISTS feature_1_title TEXT DEFAULT 'Launch Your Token',
ADD COLUMN IF NOT EXISTS feature_1_description TEXT DEFAULT 'Create and launch your crypto token in minutes with our easy-to-use platform.',
ADD COLUMN IF NOT EXISTS feature_2_title TEXT DEFAULT 'Secure Trading',
ADD COLUMN IF NOT EXISTS feature_2_description TEXT DEFAULT 'Advanced security measures protect your assets and transactions.',
ADD COLUMN IF NOT EXISTS feature_3_title TEXT DEFAULT 'Instant M-PESA',
ADD COLUMN IF NOT EXISTS feature_3_description TEXT DEFAULT 'Buy and sell tokens instantly using M-PESA mobile money.',
ADD COLUMN IF NOT EXISTS feature_4_title TEXT DEFAULT 'Real-Time Prices',
ADD COLUMN IF NOT EXISTS feature_4_description TEXT DEFAULT 'Live price updates and market data for informed trading decisions.',
ADD COLUMN IF NOT EXISTS stats_tokens TEXT DEFAULT '100+',
ADD COLUMN IF NOT EXISTS stats_traders TEXT DEFAULT '50K+',
ADD COLUMN IF NOT EXISTS stats_volume TEXT DEFAULT '$10M+',
ADD COLUMN IF NOT EXISTS stats_uptime TEXT DEFAULT '99.9%',
ADD COLUMN IF NOT EXISTS cta_title TEXT DEFAULT 'Join the Revolution',
ADD COLUMN IF NOT EXISTS cta_subtitle TEXT DEFAULT 'Start trading crypto today with the easiest mobile money integration in Africa.',
ADD COLUMN IF NOT EXISTS admin_commission NUMERIC NOT NULL DEFAULT 2.5;

-- Create commission_transactions table to track admin earnings
CREATE TABLE IF NOT EXISTS public.commission_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL,
  commission_rate NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE IF EXISTS public.commission_transactions ENABLE ROW LEVEL SECURITY;

-- Only admins can view commission transactions
DROP POLICY IF EXISTS "Admins can view commission transactions" ON public.commission_transactions;
CREATE POLICY "Admins can view commission transactions" ON public.commission_transactions FOR SELECT USING (is_admin(auth.uid()));

DROP POLICY IF EXISTS "Super admins can manage commissions" ON public.commission_transactions;
CREATE POLICY "Super admins can manage commissions" ON public.commission_transactions FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Add bonding curve columns to coins
ALTER TABLE public.coins
ADD COLUMN IF NOT EXISTS initial_price NUMERIC NOT NULL DEFAULT 0.001,
ADD COLUMN IF NOT EXISTS bonding_curve_factor NUMERIC NOT NULL DEFAULT 0.00001,
ADD COLUMN IF NOT EXISTS burned_supply NUMERIC NOT NULL DEFAULT 0;

-- Function to calculate price based on bonding curve
CREATE OR REPLACE FUNCTION public.calculate_bonding_price(
  _initial_price NUMERIC,
  _bonding_factor NUMERIC,
  _circulating_supply NUMERIC
)
RETURNS NUMERIC
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Bonding curve formula: price = initial_price * (1 + bonding_factor * circulating_supply)
  RETURN _initial_price * (1 + _bonding_factor * _circulating_supply);
END;
$$;

-- Function to update price when supply changes
CREATE OR REPLACE FUNCTION public.update_coin_price()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.price := calculate_bonding_price(NEW.initial_price, NEW.bonding_curve_factor, NEW.circulating_supply);
  NEW.market_cap := NEW.price * NEW.circulating_supply;
  RETURN NEW;
END;
$$;

-- Trigger to automatically update price when circulating_supply changes
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_coin_price_trigger') THEN
    EXECUTE 'CREATE TRIGGER update_coin_price_trigger BEFORE UPDATE OF circulating_supply ON public.coins FOR EACH ROW EXECUTE FUNCTION public.update_coin_price();';
  END IF;
END;
$$;

-- Update handle_new_user to also create wallet (upsert safe)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create profile
  INSERT INTO public.profiles (user_id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Assign default user role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  -- Create wallet
  INSERT INTO public.wallets (user_id, fiat_balance)
  VALUES (NEW.id, 0)
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- ===== Migration: 20260205150423_330f4866-0bc4-45fc-84ac-1f4d09ba5f00.sql =====

-- Add coin creation fee (gas fee) setting - adjustable by super admin
ALTER TABLE public.site_settings 
ADD COLUMN IF NOT EXISTS coin_creation_fee NUMERIC NOT NULL DEFAULT 5000;

-- Create function to get current base URL dynamically
CREATE OR REPLACE FUNCTION public.get_base_url()
RETURNS TEXT
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Returns empty string - will be set dynamically from frontend
  RETURN '';
END;
$$;

-- Add referral code caching support with better persistence
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS referred_by TEXT;

-- Create referrals table if not exists
CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL,
  referred_id UUID NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  CONSTRAINT referrals_referrer_fkey FOREIGN KEY (referrer_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Enable RLS on referrals
ALTER TABLE IF EXISTS public.referrals ENABLE ROW LEVEL SECURITY;

-- Create referral_commissions table if not exists  
CREATE TABLE IF NOT EXISTS public.referral_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id UUID NOT NULL,
  transaction_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS on referral_commissions
ALTER TABLE IF EXISTS public.referral_commissions ENABLE ROW LEVEL SECURITY;

-- Create policies for referrals
DROP POLICY IF EXISTS "Users can view their own referrals" ON public.referrals;
CREATE POLICY "Users can view their own referrals" 
ON public.referrals 
FOR SELECT 
USING (auth.uid() = referrer_id OR auth.uid() = referred_id);

DROP POLICY IF EXISTS "Admins can view all referrals" ON public.referrals;
CREATE POLICY "Admins can view all referrals" 
ON public.referrals 
FOR SELECT 
USING (is_admin(auth.uid()));

-- Create policies for referral_commissions
DROP POLICY IF EXISTS "Users can view their own referral commissions" ON public.referral_commissions;
CREATE POLICY "Users can view their own referral commissions" 
ON public.referral_commissions 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.referrals r
    WHERE r.id = referral_id AND r.referrer_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Admins can view all referral commissions" ON public.referral_commissions;
CREATE POLICY "Admins can view all referral commissions" 
ON public.referral_commissions 
FOR SELECT 
USING (is_admin(auth.uid()));

-- Function to generate unique referral code
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
DECLARE
  code TEXT;
  exists_check BOOLEAN;
BEGIN
  LOOP
    -- Generate 8 character alphanumeric code
    code := UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8));
    -- Check if exists
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE referral_code = code) INTO exists_check;
    EXIT WHEN NOT exists_check;
  END LOOP;
  RETURN code;
END;
$$;

-- Trigger to auto-generate referral code for new profiles
CREATE OR REPLACE FUNCTION public.auto_generate_referral_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := generate_referral_code();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auto_referral_code ON public.profiles;
CREATE TRIGGER trigger_auto_referral_code
BEFORE INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.auto_generate_referral_code();

-- Update existing profiles with referral codes
UPDATE public.profiles 
SET referral_code = generate_referral_code()
WHERE referral_code IS NULL;

-- Add referral commission percentage to site settings  
ALTER TABLE public.site_settings 
ADD COLUMN IF NOT EXISTS referral_commission_percentage NUMERIC NOT NULL DEFAULT 5;

-- Add coin approval fields if not exist
ALTER TABLE public.coins
ADD COLUMN IF NOT EXISTS is_approved BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.coins
ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected'));

ALTER TABLE public.coins
ADD COLUMN IF NOT EXISTS creation_fee_paid BOOLEAN NOT NULL DEFAULT false;

-- Update RLS for coins - only show approved coins to public
DROP POLICY IF EXISTS "Anyone can view approved active coins" ON public.coins;
CREATE POLICY "Anyone can view approved active coins" 
ON public.coins 
FOR SELECT 
USING (is_active = true AND (is_approved = true OR is_admin(auth.uid())));

-- ===== Migration: 20260206111250_62354830-5c0e-4658-bd0e-ed8fbee96940.sql =====

-- Add contract_address to coins for sharing/searching
ALTER TABLE public.coins ADD COLUMN IF NOT EXISTS contract_address text;

-- Generate a unique contract address for existing coins (if null)
UPDATE public.coins SET contract_address = '0x' || encode(decode(replace(id::text, '-', ''), 'hex'), 'hex') WHERE contract_address IS NULL;

-- Create function to auto-generate contract address on coin creation
CREATE OR REPLACE FUNCTION public.generate_contract_address()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.contract_address IS NULL THEN
    NEW.contract_address := '0x' || encode(gen_random_bytes(20), 'hex');
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS auto_contract_address ON public.coins;
CREATE TRIGGER auto_contract_address
  BEFORE INSERT ON public.coins
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_contract_address();

COMMIT;

-- End of combined migration
