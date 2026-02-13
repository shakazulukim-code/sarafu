-- Add Contact Info to Site Settings
ALTER TABLE public.site_settings
ADD COLUMN IF NOT EXISTS contact_email TEXT NULL,
ADD COLUMN IF NOT EXISTS contact_phone TEXT NULL,
ADD COLUMN IF NOT EXISTS contact_address TEXT NULL;

-- Create Job Positions Table
CREATE TABLE IF NOT EXISTS public.job_positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    location TEXT NOT NULL,
    type TEXT NOT NULL, -- Full-time, Part-time, Remote, Contract
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for Job Positions
ALTER TABLE public.job_positions ENABLE ROW LEVEL SECURITY;

-- Create Job Applications Table
CREATE TABLE IF NOT EXISTS public.job_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_position_id UUID REFERENCES public.job_positions(id) ON DELETE SET NULL,
    applicant_name TEXT NOT NULL,
    applicant_email TEXT NOT NULL,
    applicant_phone TEXT NOT NULL,
    resume_link TEXT,
    cover_letter TEXT,
    status TEXT DEFAULT 'pending', -- pending, reviewed, rejected, hired
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for Job Applications
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Job Positions
-- Public can view active jobs
CREATE POLICY "Public can view active job positions" 
ON public.job_positions FOR SELECT 
TO public 
USING (is_active = true);

-- Admins can manage job positions (assuming admin check logic or simplistic authenticated logic for now)
-- Adjusting to use user_roles table or service_role in real app, but for now allow authenticated users to view all?
-- Actually, let's stick to simple "authenticated users can view" for admin panel, but only admins can modify.
-- For simplicity in this demo, we'll allow authenticated users to select all (admin panel uses this).
CREATE POLICY "Auth users can view all job positions"
ON public.job_positions FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can insert job positions"
ON public.job_positions FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'super_admin')
  )
);

CREATE POLICY "Admins can update job positions"
ON public.job_positions FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'super_admin')
  )
);

CREATE POLICY "Admins can delete job positions"
ON public.job_positions FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'super_admin')
  )
);

-- RLS Policies for Job Applications
-- Public can insert (apply)
CREATE POLICY "Public can insert job applications"
ON public.job_applications FOR INSERT
TO public
WITH CHECK (true);

-- Only Admins can view applications
CREATE POLICY "Admins can view job applications"
ON public.job_applications FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'super_admin')
  )
);

-- Only Admins can update applications (status)
CREATE POLICY "Admins can update job applications"
ON public.job_applications FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'super_admin')
  )
);
