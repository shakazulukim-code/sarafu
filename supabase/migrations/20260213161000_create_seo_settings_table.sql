-- Create SEO settings table for managing meta tags and SEO content
-- Allows super admin to configure SEO for each page

CREATE TABLE IF NOT EXISTS public.seo_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_path TEXT UNIQUE NOT NULL, -- e.g., '/', '/launchpad', '/coin/:id'
  meta_title TEXT,
  meta_description TEXT,
  meta_keywords TEXT[], -- Array of keywords
  og_title TEXT,
  og_description TEXT,
  og_image TEXT,
  twitter_title TEXT,
  twitter_description TEXT,
  twitter_image TEXT,
  canonical_url TEXT,
  robots_meta TEXT DEFAULT 'index,follow', -- e.g., 'index,follow', 'noindex,nofollow'
  structured_data JSONB, -- JSON-LD structured data
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for fast page lookup
CREATE INDEX IF NOT EXISTS idx_seo_settings_page_path ON public.seo_settings(page_path);
CREATE INDEX IF NOT EXISTS idx_seo_settings_active ON public.seo_settings(is_active);

-- Enable RLS
ALTER TABLE public.seo_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Public can read active SEO settings
CREATE POLICY "Anyone can read active SEO settings"
ON public.seo_settings FOR SELECT
USING (is_active = true);

-- Only super admin can insert SEO settings
CREATE POLICY "Super admin can insert SEO settings"
ON public.seo_settings FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'super_admin'
  )
);

-- Only super admin can update SEO settings
CREATE POLICY "Super admin can update SEO settings"
ON public.seo_settings FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'super_admin'
  )
);

-- Only super admin can delete SEO settings
CREATE POLICY "Super admin can delete SEO settings"
ON public.seo_settings FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'super_admin'
  )
);

-- Insert default SEO settings for main pages
INSERT INTO public.seo_settings (page_path, meta_title, meta_description, meta_keywords, og_title, og_description, robots_meta)
VALUES 
  ('/', 'Sarafu Mpya - Noble Coin Launch Platform', 'Launch and trade community tokens on the premier Kenyan cryptocurrency platform. Create your own coin, trade with M-PESA, and join the crypto revolution.', ARRAY['cryptocurrency', 'Kenya', 'M-PESA', 'token launch', 'crypto trading', 'blockchain', 'Sarafu'], 'Sarafu Mpya - Launch Your Community Token', 'Create and trade community tokens with M-PESA integration', 'index,follow'),
  ('/launchpad', 'Launchpad - Discover New Coins | Sarafu Mpya', 'Explore and invest in newly launched community tokens. Find the next big crypto opportunity on our launchpad.', ARRAY['crypto launchpad', 'new tokens', 'ICO', 'token sale', 'investment'], 'Discover New Tokens on Sarafu Launchpad', 'Browse and invest in the latest community token launches', 'index,follow'),
  ('/about', 'About Sarafu Mpya - Our Mission', 'Learn about our mission to democratize cryptocurrency access in Kenya through M-PESA integration and community empowerment.', ARRAY['about', 'mission', 'crypto Kenya', 'financial inclusion'], 'About Sarafu Mpya', 'Democratizing crypto access in Kenya', 'index,follow'),
  ('/dashboard', 'My Dashboard | Sarafu Mpya', 'Manage your crypto portfolio, view holdings, and track transactions.', ARRAY['dashboard', 'portfolio', 'crypto wallet'], 'Your Crypto Dashboard', 'Manage your digital assets', 'noindex,follow'),
  ('/create-coin', 'Create Your Token | Sarafu Mpya', 'Launch your own community token in minutes with our easy-to-use platform.', ARRAY['create token', 'launch coin', 'ICO', 'tokenization'], 'Create Your Own Token', 'Launch your community coin today', 'index,follow')
ON CONFLICT (page_path) DO NOTHING;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_seo_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER seo_settings_updated_at
BEFORE UPDATE ON public.seo_settings
FOR EACH ROW
EXECUTE FUNCTION update_seo_settings_updated_at();

COMMENT ON TABLE public.seo_settings IS 'SEO configuration for each page/route in the application';
