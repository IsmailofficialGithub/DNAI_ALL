-- Ads Table Schema for Supabase
-- This table stores ad campaigns created from boosted posts

CREATE TABLE IF NOT EXISTS public.ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Foreign Keys
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES public.content_calendar(id) ON DELETE CASCADE,
  social_account_id UUID NOT NULL REFERENCES public.social_accounts(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Post Information
  platform TEXT NOT NULL CHECK (platform IN ('facebook', 'instagram', 'linkedin', 'tiktok')),
  social_id TEXT, -- Original post social_id from content_calendar
  
  -- Ad Campaign Details
  project_name TEXT NOT NULL,
  ad_goal TEXT NOT NULL CHECK (ad_goal IN ('traffic', 'leads', 'sales')),
  conversion_button TEXT, -- e.g., 'sign_up', 'learn_more', 'shop_now'
  objective TEXT, -- Legacy field, can be same as ad_goal
  
  -- Campaign Dates
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  
  -- Budget
  daily_budget DECIMAL(10, 2) NOT NULL,
  total_budget DECIMAL(10, 2), -- Calculated: daily_budget * days
  
  -- Targeting
  locations TEXT[] DEFAULT '{}', -- Array of location strings
  age_min INTEGER CHECK (age_min >= 13 AND age_min <= 65),
  age_max INTEGER CHECK (age_max >= 13 AND age_max <= 65),
  gender TEXT CHECK (gender IN ('all', 'male', 'female')),
  interests TEXT, -- Legacy field for interests
  
  -- Meta/Facebook Ad IDs (populated after ad creation)
  ad_id TEXT, -- Facebook Ad ID
  ad_set_id TEXT, -- Facebook Ad Set ID
  campaign_id TEXT, -- Facebook Campaign ID
  ad_account_id TEXT, -- Facebook Ad Account ID
  
  -- Status
  ad_status TEXT DEFAULT 'pending' CHECK (ad_status IN ('pending', 'active', 'paused', 'completed', 'failed', 'cancelled')),
  
  -- Response from webhook/n8n
  webhook_response JSONB, -- Store full response from n8n webhook
  webhook_error TEXT, -- Store any error messages
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ, -- When ad was actually published
  
  -- Constraints
  CONSTRAINT valid_date_range CHECK (end_date > start_date),
  CONSTRAINT valid_age_range CHECK (age_max >= age_min)
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_ads_brand_id ON public.ads(brand_id);
CREATE INDEX IF NOT EXISTS idx_ads_post_id ON public.ads(post_id);
CREATE INDEX IF NOT EXISTS idx_ads_social_account_id ON public.ads(social_account_id);
CREATE INDEX IF NOT EXISTS idx_ads_created_by ON public.ads(created_by);
CREATE INDEX IF NOT EXISTS idx_ads_platform ON public.ads(platform);
CREATE INDEX IF NOT EXISTS idx_ads_status ON public.ads(ad_status);
CREATE INDEX IF NOT EXISTS idx_ads_created_at ON public.ads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ads_campaign_id ON public.ads(campaign_id) WHERE campaign_id IS NOT NULL;

-- Enable Row Level Security (RLS)
ALTER TABLE public.ads ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only see ads for brands they own
CREATE POLICY "Users can view ads for their brands"
  ON public.ads FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.brands
      WHERE brands.id = ads.brand_id
      AND brands.owner_user_id = auth.uid()
    )
  );

-- RLS Policy: Users can insert ads for their brands
CREATE POLICY "Users can create ads for their brands"
  ON public.ads FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.brands
      WHERE brands.id = ads.brand_id
      AND brands.owner_user_id = auth.uid()
    )
  );

-- RLS Policy: Users can update ads for their brands
CREATE POLICY "Users can update ads for their brands"
  ON public.ads FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.brands
      WHERE brands.id = ads.brand_id
      AND brands.owner_user_id = auth.uid()
    )
  );

-- RLS Policy: Users can delete ads for their brands
CREATE POLICY "Users can delete ads for their brands"
  ON public.ads FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.brands
      WHERE brands.id = ads.brand_id
      AND brands.owner_user_id = auth.uid()
    )
  );

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_ads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at on row update
CREATE TRIGGER update_ads_updated_at
  BEFORE UPDATE ON public.ads
  FOR EACH ROW
  EXECUTE FUNCTION update_ads_updated_at();

-- Function to calculate total_budget based on daily_budget and date range
CREATE OR REPLACE FUNCTION calculate_ads_total_budget()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.daily_budget IS NOT NULL AND NEW.start_date IS NOT NULL AND NEW.end_date IS NOT NULL THEN
    NEW.total_budget := NEW.daily_budget * GREATEST(1, EXTRACT(EPOCH FROM (NEW.end_date - NEW.start_date)) / 86400);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-calculate total_budget
CREATE TRIGGER calculate_ads_total_budget
  BEFORE INSERT OR UPDATE ON public.ads
  FOR EACH ROW
  WHEN (NEW.daily_budget IS NOT NULL AND NEW.start_date IS NOT NULL AND NEW.end_date IS NOT NULL)
  EXECUTE FUNCTION calculate_ads_total_budget();

-- Comments for documentation
COMMENT ON TABLE public.ads IS 'Stores ad campaigns created from boosted posts';
COMMENT ON COLUMN public.ads.ad_id IS 'Facebook/Meta Ad ID returned after ad creation';
COMMENT ON COLUMN public.ads.ad_set_id IS 'Facebook/Meta Ad Set ID';
COMMENT ON COLUMN public.ads.campaign_id IS 'Facebook/Meta Campaign ID';
COMMENT ON COLUMN public.ads.webhook_response IS 'Full JSON response from n8n webhook after ad creation';
COMMENT ON COLUMN public.ads.ad_status IS 'Status of the ad: pending (created but not published), active (running), paused, completed, failed, cancelled';

