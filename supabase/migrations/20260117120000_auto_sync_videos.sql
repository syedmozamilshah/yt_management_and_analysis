-- ============================================
-- Auto-sync New Videos to Ideation
-- Add niche mapping and activity tracking
-- ============================================

-- ============================================
-- 1. Add niche column to tracked_channels
-- ============================================
-- This stores the niche for each tracked channel
-- New videos from this channel will auto-assign to this niche
ALTER TABLE public.tracked_channels 
ADD COLUMN IF NOT EXISTS niche TEXT;

-- ============================================
-- 2. Add last_ideation_opened_at to user_activity
-- ============================================
-- Track when user last opened the ideation page
-- If > 3 days, pause fetching for this user
ALTER TABLE public.user_activity 
ADD COLUMN IF NOT EXISTS last_ideation_opened_at TIMESTAMP WITH TIME ZONE;

-- ============================================
-- 3. Create user_channel_videos table for auto-synced videos
-- ============================================
-- This links tracked_videos to user_videos automatically
-- When a new video comes in via webhook, it's auto-added here
CREATE TABLE IF NOT EXISTS public.user_channel_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel_id TEXT NOT NULL,
  niche TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, channel_id)
);

-- Enable RLS
ALTER TABLE public.user_channel_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own subscriptions"
  ON public.user_channel_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own subscriptions"
  ON public.user_channel_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own subscriptions"
  ON public.user_channel_subscriptions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own subscriptions"
  ON public.user_channel_subscriptions FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_channel_subscriptions_user_id 
  ON public.user_channel_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_channel_subscriptions_channel_id 
  ON public.user_channel_subscriptions(channel_id);
CREATE INDEX IF NOT EXISTS idx_user_channel_subscriptions_is_active 
  ON public.user_channel_subscriptions(is_active);

-- ============================================
-- 4. Add view_count_updated_at to user_videos
-- ============================================
-- Track when view counts were last updated
-- Only update view counts every 24 hours to save API quota
ALTER TABLE public.user_videos 
ADD COLUMN IF NOT EXISTS view_count_updated_at TIMESTAMP WITH TIME ZONE;

-- ============================================
-- 5. Create function to auto-add new videos to user_videos
-- ============================================
-- This function is called when a new video is inserted into tracked_videos
-- It checks if any users are subscribed to that channel and auto-adds the video
CREATE OR REPLACE FUNCTION public.auto_sync_video_to_users()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert video for all users who are subscribed to this channel
  -- and have been active in the last 3 days
  INSERT INTO public.user_videos (
    user_id,
    title,
    youtube_url,
    video_id,
    thumbnail_url,
    channel_name,
    upload_date,
    view_count,
    niche,
    created_at
  )
  SELECT 
    ucs.user_id,
    NEW.title,
    COALESCE(NEW.youtube_url, 'https://www.youtube.com/watch?v=' || NEW.video_id),
    NEW.video_id,
    COALESCE(NEW.thumbnail_url, 'https://i.ytimg.com/vi/' || NEW.video_id || '/hqdefault.jpg'),
    tc.channel_name,
    NEW.published_at,
    NEW.view_count,
    ucs.niche,
    now()
  FROM public.user_channel_subscriptions ucs
  JOIN public.tracked_channels tc ON tc.channel_id = ucs.channel_id AND tc.user_id = ucs.user_id
  JOIN public.user_activity ua ON ua.user_id = ucs.user_id
  WHERE ucs.channel_id = NEW.channel_id
    AND ucs.is_active = true
    -- Only sync for users who have been active in the last 3 days
    AND (ua.last_ideation_opened_at IS NULL OR ua.last_ideation_opened_at > now() - INTERVAL '3 days')
  ON CONFLICT (user_id, video_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to auto-sync videos
DROP TRIGGER IF EXISTS trigger_auto_sync_video ON public.tracked_videos;
CREATE TRIGGER trigger_auto_sync_video
  AFTER INSERT ON public.tracked_videos
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_sync_video_to_users();

-- ============================================
-- 6. Add unique constraint on user_videos for video_id per user
-- ============================================
-- Prevent duplicate videos for the same user
-- First check if constraint exists, then add
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'user_videos_user_id_video_id_key'
  ) THEN
    ALTER TABLE public.user_videos 
    ADD CONSTRAINT user_videos_user_id_video_id_key UNIQUE (user_id, video_id);
  END IF;
EXCEPTION
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;
