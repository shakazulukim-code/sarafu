-- Create sitemap configuration table for dynamic sitemap.xml generation
-- Allows admin to manage which URLs appear in sitemap with priority and change frequency

CREATE TABLE IF NOT EXISTS public.sitemap_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url_path TEXT NOT NULL, -- e.g., '/', '/launchpad', '/coin/123'
  priority NUMERIC(2,1) NOT NULL DEFAULT 0.5 CHECK (priority >= 0.0 AND priority <= 1.0),
  change_frequency TEXT NOT NULL DEFAULT 'weekly' CHECK (change_frequency IN ('always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never')),
  last_modified TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_sitemap_config_active ON public.sitemap_config(is_active);
CREATE INDEX IF NOT EXISTS idx_sitemap_config_priority ON public.sitemap_config(priority DESC);

-- Enable RLS
ALTER TABLE public.sitemap_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Public can read active sitemap config (for sitemap generation)
CREATE POLICY "Anyone can read active sitemap config"
ON public.sitemap_config FOR SELECT
USING (is_active = true);

-- Only super admin can manage sitemap
CREATE POLICY "Super admin can manage sitemap config"
ON public.sitemap_config FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'super_admin'
  )
);

-- Insert default sitemap entries for static pages
INSERT INTO public.sitemap_config (url_path, priority, change_frequency, last_modified)
VALUES 
  ('/', 1.0, 'daily', NOW()),
  ('/launchpad', 0.9, 'hourly', NOW()),
  ('/about', 0.6, 'monthly', NOW()),
  ('/blockchain', 0.7, 'weekly', NOW()),
  ('/terms', 0.4, 'yearly', NOW()),
  ('/privacy', 0.4, 'yearly', NOW()),
  ('/create-coin', 0.8, 'weekly', NOW())
ON CONFLICT DO NOTHING;

-- Function to update last_modified on update
CREATE OR REPLACE FUNCTION update_sitemap_last_modified()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_modified = NOW();
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update timestamps
CREATE TRIGGER sitemap_config_last_modified
BEFORE UPDATE ON public.sitemap_config
FOR EACH ROW
EXECUTE FUNCTION update_sitemap_last_modified();

COMMENT ON TABLE public.sitemap_config IS 'Configuration for sitemap.xml generation with priorities and change frequencies';
