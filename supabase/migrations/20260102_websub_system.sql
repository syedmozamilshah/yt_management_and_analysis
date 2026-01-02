-- Migration: WebSub Webhook System for YouTube Channel Tracking
-- This adds support for WebSub (PubSubHubbub) subscriptions and real-time video notifications

-- Extend user_competitor_channels with WebSub fields
ALTER TABLE public.user_competitor_channels
ADD COLUMN IF NOT EXISTS rss_feed_url TEXT,
ADD COLUMN IF NOT EXISTS webhook_subscribed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_webhook_delivery TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'inactive' CHECK (subscription_status IN ('inactive', 'pending', 'active', 'failed'));

-- Create table for tracking competitor videos from WebSub
CREATE TABLE IF NOT EXISTS public.user_competitor_videos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel_id TEXT NOT NULL,
  video_id TEXT NOT NULL,
  title TEXT NOT NULL,
  published_at TIMESTAMP WITH TIME ZONE NOT NULL,
  thumbnail_url TEXT,
  source TEXT DEFAULT 'websub' CHECK (source IN ('websub', 'rss_polling', 'manual')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, video_id)
);

-- Create table for tracking WebSub subscription management
CREATE TABLE IF NOT EXISTS public.websub_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel_id TEXT NOT NULL,
  hub_lease_seconds INTEGER DEFAULT 432000,
  subscription_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  last_renewal_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  renewal_status TEXT DEFAULT 'active' CHECK (renewal_status IN ('active', 'failed', 'pending')),
  last_renewal_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, channel_id)
);

-- Update users table to track competitor tracker activity
ALTER TABLE auth.users
ADD COLUMN IF NOT EXISTS last_competitor_route_opened TIMESTAMP WITH TIME ZONE;

-- Enable Row Level Security on new tables
ALTER TABLE public.user_competitor_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.websub_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_competitor_videos
CREATE POLICY "Users can view their own competitor videos"
  ON public.user_competitor_videos
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own competitor videos"
  ON public.user_competitor_videos
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own competitor videos"
  ON public.user_competitor_videos
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own competitor videos"
  ON public.user_competitor_videos
  FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for websub_subscriptions
CREATE POLICY "Users can view their own subscriptions"
  ON public.websub_subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own subscriptions"
  ON public.websub_subscriptions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own subscriptions"
  ON public.websub_subscriptions
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own subscriptions"
  ON public.websub_subscriptions
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_competitor_videos_user_id ON public.user_competitor_videos(user_id);
CREATE INDEX IF NOT EXISTS idx_user_competitor_videos_channel_id ON public.user_competitor_videos(channel_id);
CREATE INDEX IF NOT EXISTS idx_user_competitor_videos_published_at ON public.user_competitor_videos(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_competitor_videos_video_id ON public.user_competitor_videos(video_id);
CREATE INDEX IF NOT EXISTS idx_websub_subscriptions_user_id ON public.websub_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_websub_subscriptions_expires_at ON public.websub_subscriptions(subscription_expires_at);
CREATE INDEX IF NOT EXISTS idx_websub_subscriptions_renewal_status ON public.websub_subscriptions(renewal_status);

-- Create function to update user's last_competitor_route_opened
CREATE OR REPLACE FUNCTION update_competitor_route_activity()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE auth.users
  SET last_competitor_route_opened = now()
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for tracking competitor route access
CREATE TRIGGER trigger_competitor_route_activity
AFTER INSERT ON public.user_competitor_channels
FOR EACH ROW
EXECUTE FUNCTION update_competitor_route_activity();
