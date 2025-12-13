-- Migration: User-specific data tables with RLS
-- This creates user_videos and user_niches tables with proper Row Level Security

-- Create user_videos table for user-specific video storage
CREATE TABLE IF NOT EXISTS public.user_videos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  youtube_url TEXT NOT NULL,
  video_id TEXT NOT NULL,
  thumbnail_url TEXT NOT NULL,
  channel_name TEXT,
  channel_subscribers INTEGER,
  upload_date TEXT,
  view_count INTEGER,
  vph NUMERIC,
  niche TEXT,
  is_favorite BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, video_id)
);

-- Create user_niches table for user-specific niche storage
CREATE TABLE IF NOT EXISTS public.user_niches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  image_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, name)
);

-- Enable Row Level Security on user_videos
ALTER TABLE public.user_videos ENABLE ROW LEVEL SECURITY;

-- Enable Row Level Security on user_niches
ALTER TABLE public.user_niches ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_videos
-- Users can only view their own videos
CREATE POLICY "Users can view their own videos"
  ON public.user_videos
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can only insert their own videos
CREATE POLICY "Users can insert their own videos"
  ON public.user_videos
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can only update their own videos
CREATE POLICY "Users can update their own videos"
  ON public.user_videos
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can only delete their own videos
CREATE POLICY "Users can delete their own videos"
  ON public.user_videos
  FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for user_niches
-- Users can only view their own niches
CREATE POLICY "Users can view their own niches"
  ON public.user_niches
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can only insert their own niches
CREATE POLICY "Users can insert their own niches"
  ON public.user_niches
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can only update their own niches
CREATE POLICY "Users can update their own niches"
  ON public.user_niches
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can only delete their own niches
CREATE POLICY "Users can delete their own niches"
  ON public.user_niches
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_videos_user_id ON public.user_videos(user_id);
CREATE INDEX IF NOT EXISTS idx_user_videos_created_at ON public.user_videos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_niches_user_id ON public.user_niches(user_id);

-- Create user_competitor_channels table for user-specific competitor tracking
CREATE TABLE IF NOT EXISTS public.user_competitor_channels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel_name TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  channel_subscribers INTEGER,
  total_videos INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, channel_id)
);

-- Enable Row Level Security on user_competitor_channels
ALTER TABLE public.user_competitor_channels ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_competitor_channels
CREATE POLICY "Users can view their own competitor channels"
  ON public.user_competitor_channels
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own competitor channels"
  ON public.user_competitor_channels
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own competitor channels"
  ON public.user_competitor_channels
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own competitor channels"
  ON public.user_competitor_channels
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_competitor_channels_user_id ON public.user_competitor_channels(user_id);
