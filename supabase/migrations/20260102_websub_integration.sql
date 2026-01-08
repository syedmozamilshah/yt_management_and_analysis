-- ============================================
-- WebSub Integration Migration
-- YouTube PubSubHubbub webhook-first architecture
-- ============================================

-- ============================================
-- 1. User Activity Tracking
-- ============================================
-- Create a separate user_activity table for tracking user activity
CREATE TABLE IF NOT EXISTS public.user_activity (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  last_competitor_route_opened_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on user_activity
ALTER TABLE public.user_activity ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_activity
CREATE POLICY "Users can view their own activity"
  ON public.user_activity FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own activity"
  ON public.user_activity FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own activity"
  ON public.user_activity FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================
-- 2. Tracked Channels Table (WebSub enabled)
-- ============================================
CREATE TABLE IF NOT EXISTS public.tracked_channels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel_id TEXT NOT NULL,
  channel_name TEXT,
  channel_handle TEXT,
  channel_thumbnail TEXT,
  channel_subscribers INTEGER,
  rss_feed_url TEXT,
  webhook_subscribed BOOLEAN DEFAULT false,
  subscription_expires_at TIMESTAMP WITH TIME ZONE,
  last_webhook_received_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, channel_id)
);

-- Enable RLS on tracked_channels
ALTER TABLE public.tracked_channels ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tracked_channels
CREATE POLICY "Users can view their own tracked channels"
  ON public.tracked_channels FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tracked channels"
  ON public.tracked_channels FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tracked channels"
  ON public.tracked_channels FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tracked channels"
  ON public.tracked_channels FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes for tracked_channels
CREATE INDEX IF NOT EXISTS idx_tracked_channels_user_id ON public.tracked_channels(user_id);
CREATE INDEX IF NOT EXISTS idx_tracked_channels_channel_id ON public.tracked_channels(channel_id);
CREATE INDEX IF NOT EXISTS idx_tracked_channels_subscription_expires ON public.tracked_channels(subscription_expires_at);
CREATE INDEX IF NOT EXISTS idx_tracked_channels_webhook_subscribed ON public.tracked_channels(webhook_subscribed);

-- ============================================
-- 3. Tracked Videos Table (from WebSub notifications)
-- ============================================
CREATE TABLE IF NOT EXISTS public.tracked_videos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id TEXT NOT NULL UNIQUE, -- UNIQUE constraint for video_id
  channel_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  published_at TIMESTAMP WITH TIME ZONE NOT NULL,
  youtube_url TEXT,
  view_count INTEGER,
  like_count INTEGER,
  comment_count INTEGER,
  source TEXT DEFAULT 'websub', -- 'websub' or 'rss_poll'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on tracked_videos (public read for videos from tracked channels)
ALTER TABLE public.tracked_videos ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tracked_videos - users can view videos from their tracked channels
CREATE POLICY "Users can view videos from their tracked channels"
  ON public.tracked_videos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tracked_channels tc
      WHERE tc.channel_id = tracked_videos.channel_id
      AND tc.user_id = auth.uid()
    )
  );

-- Service role can insert/update (for webhooks)
CREATE POLICY "Service role can insert videos"
  ON public.tracked_videos FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can update videos"
  ON public.tracked_videos FOR UPDATE
  USING (true);

-- Indexes for tracked_videos
CREATE INDEX IF NOT EXISTS idx_tracked_videos_video_id ON public.tracked_videos(video_id);
CREATE INDEX IF NOT EXISTS idx_tracked_videos_channel_id ON public.tracked_videos(channel_id);
CREATE INDEX IF NOT EXISTS idx_tracked_videos_published_at ON public.tracked_videos(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_tracked_videos_created_at ON public.tracked_videos(created_at DESC);

-- ============================================
-- 4. WebSub Subscription Log Table
-- ============================================
CREATE TABLE IF NOT EXISTS public.websub_subscription_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id TEXT NOT NULL,
  action TEXT NOT NULL, -- 'subscribe', 'unsubscribe', 'renew', 'verify'
  status TEXT NOT NULL, -- 'pending', 'success', 'failed'
  hub_response TEXT,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for logs
CREATE INDEX IF NOT EXISTS idx_websub_logs_channel_id ON public.websub_subscription_logs(channel_id);
CREATE INDEX IF NOT EXISTS idx_websub_logs_created_at ON public.websub_subscription_logs(created_at DESC);

-- ============================================
-- 5. Webhook Events Log Table (for debugging)
-- ============================================
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL, -- 'verification', 'notification', 'error'
  channel_id TEXT,
  video_id TEXT,
  payload TEXT,
  processed BOOLEAN DEFAULT false,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for webhook events
CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at ON public.webhook_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON public.webhook_events(processed);

-- ============================================
-- 6. Function to update timestamps
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_tracked_channels_updated_at ON public.tracked_channels;
CREATE TRIGGER update_tracked_channels_updated_at
  BEFORE UPDATE ON public.tracked_channels
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tracked_videos_updated_at ON public.tracked_videos;
CREATE TRIGGER update_tracked_videos_updated_at
  BEFORE UPDATE ON public.tracked_videos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_activity_updated_at ON public.user_activity;
CREATE TRIGGER update_user_activity_updated_at
  BEFORE UPDATE ON public.user_activity
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 7. Function to check if user is active (opened route in last 72 hours)
-- ============================================
CREATE OR REPLACE FUNCTION is_user_active(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_last_opened TIMESTAMP WITH TIME ZONE;
BEGIN
  SELECT last_competitor_route_opened_at INTO v_last_opened
  FROM public.user_activity
  WHERE user_id = p_user_id;
  
  IF v_last_opened IS NULL THEN
    RETURN false;
  END IF;
  
  -- Active if opened in last 72 hours
  RETURN v_last_opened > (now() - INTERVAL '72 hours');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 8. Function to get channels needing subscription renewal
-- ============================================
CREATE OR REPLACE FUNCTION get_channels_needing_renewal()
RETURNS TABLE (
  id UUID,
  user_id UUID,
  channel_id TEXT,
  channel_name TEXT,
  rss_feed_url TEXT,
  subscription_expires_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    tc.id,
    tc.user_id,
    tc.channel_id,
    tc.channel_name,
    tc.rss_feed_url,
    tc.subscription_expires_at
  FROM public.tracked_channels tc
  INNER JOIN public.user_activity ua ON ua.user_id = tc.user_id
  WHERE tc.webhook_subscribed = true
    AND tc.is_active = true
    AND tc.subscription_expires_at IS NOT NULL
    AND tc.subscription_expires_at < (now() + INTERVAL '24 hours')
    AND ua.last_competitor_route_opened_at > (now() - INTERVAL '72 hours');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 9. Function to get channels for RSS polling fallback
-- ============================================
CREATE OR REPLACE FUNCTION get_channels_for_rss_poll()
RETURNS TABLE (
  id UUID,
  user_id UUID,
  channel_id TEXT,
  channel_name TEXT,
  rss_feed_url TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    tc.id,
    tc.user_id,
    tc.channel_id,
    tc.channel_name,
    tc.rss_feed_url
  FROM public.tracked_channels tc
  INNER JOIN public.user_activity ua ON ua.user_id = tc.user_id
  WHERE tc.is_active = true
    AND tc.rss_feed_url IS NOT NULL
    AND ua.last_competitor_route_opened_at > (now() - INTERVAL '72 hours');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 10. Grant permissions for service role
-- ============================================
GRANT ALL ON public.tracked_channels TO service_role;
GRANT ALL ON public.tracked_videos TO service_role;
GRANT ALL ON public.websub_subscription_logs TO service_role;
GRANT ALL ON public.webhook_events TO service_role;
GRANT ALL ON public.user_activity TO service_role;
GRANT EXECUTE ON FUNCTION is_user_active TO service_role;
GRANT EXECUTE ON FUNCTION get_channels_needing_renewal TO service_role;
GRANT EXECUTE ON FUNCTION get_channels_for_rss_poll TO service_role;
