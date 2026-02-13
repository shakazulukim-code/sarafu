-- Add Google Search Console verification code to site_settings
-- This allows admins to verify their site with Google Search Console

ALTER TABLE public.site_settings
ADD COLUMN IF NOT EXISTS google_verification_code TEXT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.site_settings.google_verification_code IS 'Google Search Console verification meta tag content value';
