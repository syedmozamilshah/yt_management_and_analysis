-- Migration: Create competitor analysis history table
-- Created: 2024-12-24

-- Create table for storing competitor analysis history
CREATE TABLE IF NOT EXISTS public.competitor_analyses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Source channel info
    source_channel_id TEXT NOT NULL,
    source_channel_name TEXT NOT NULL,
    source_channel_handle TEXT,
    source_channel_thumbnail TEXT,
    
    -- Analysis results (stored as JSONB for flexibility)
    similar_channels JSONB NOT NULL DEFAULT '[]'::jsonb,
    total_channels_found INTEGER NOT NULL DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create index for faster user lookups
CREATE INDEX IF NOT EXISTS idx_competitor_analyses_user_id 
ON public.competitor_analyses(user_id);

-- Create index for faster date sorting
CREATE INDEX IF NOT EXISTS idx_competitor_analyses_created_at 
ON public.competitor_analyses(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.competitor_analyses ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view their own analyses
CREATE POLICY "Users can view own competitor analyses"
ON public.competitor_analyses
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Users can insert their own analyses
CREATE POLICY "Users can insert own competitor analyses"
ON public.competitor_analyses
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own analyses
CREATE POLICY "Users can delete own competitor analyses"
ON public.competitor_analyses
FOR DELETE
USING (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_competitor_analyses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-updating updated_at
DROP TRIGGER IF EXISTS trigger_competitor_analyses_updated_at ON public.competitor_analyses;
CREATE TRIGGER trigger_competitor_analyses_updated_at
BEFORE UPDATE ON public.competitor_analyses
FOR EACH ROW
EXECUTE FUNCTION update_competitor_analyses_updated_at();

-- Grant permissions
GRANT ALL ON public.competitor_analyses TO authenticated;
GRANT SELECT ON public.competitor_analyses TO anon;
