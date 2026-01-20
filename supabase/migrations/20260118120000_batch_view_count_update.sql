-- ============================================
-- Daily Batch View Count Update Support
-- ============================================
-- This migration adds:
-- 1. view_count_update_logs table for tracking batch update runs
-- 2. Index on tracked_videos.updated_at for efficient queries
-- 3. Updated_at trigger for tracked_videos

-- ============================================
-- 1. View Count Update Logs Table
-- ============================================
-- Tracks each batch update run for monitoring and debugging
CREATE TABLE IF NOT EXISTS public.view_count_update_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  videos_processed INTEGER NOT NULL DEFAULT 0,
  videos_updated INTEGER NOT NULL DEFAULT 0,
  api_calls INTEGER NOT NULL DEFAULT 0,
  quota_used INTEGER NOT NULL DEFAULT 0,
  errors JSONB,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- No RLS needed - this is a system table accessed only by service role
ALTER TABLE public.view_count_update_logs ENABLE ROW LEVEL SECURITY;

-- Only service role can access
CREATE POLICY "Service role full access to view_count_update_logs"
  ON public.view_count_update_logs
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================
-- 2. Index for Efficient Batch Queries
-- ============================================
-- Index on updated_at to quickly find videos that need updating
CREATE INDEX IF NOT EXISTS idx_tracked_videos_updated_at 
  ON public.tracked_videos(updated_at ASC);

-- Composite index for the batch update query pattern
CREATE INDEX IF NOT EXISTS idx_tracked_videos_batch_update 
  ON public.tracked_videos(updated_at ASC, published_at DESC);

-- ============================================
-- 3. Auto-update updated_at on tracked_videos
-- ============================================
-- Ensure updated_at is automatically set on changes
CREATE OR REPLACE FUNCTION public.update_tracked_videos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS trigger_update_tracked_videos_updated_at ON public.tracked_videos;
CREATE TRIGGER trigger_update_tracked_videos_updated_at
  BEFORE UPDATE ON public.tracked_videos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_tracked_videos_updated_at();

-- ============================================
-- 4. Add view_count_updated_at to tracked_videos
-- ============================================
-- Separate column to track specifically when view counts were updated
-- (vs general updated_at which changes on any update)
ALTER TABLE public.tracked_videos 
ADD COLUMN IF NOT EXISTS view_count_updated_at TIMESTAMP WITH TIME ZONE;

-- Index for view count update tracking
CREATE INDEX IF NOT EXISTS idx_tracked_videos_view_count_updated_at 
  ON public.tracked_videos(view_count_updated_at ASC NULLS FIRST);
