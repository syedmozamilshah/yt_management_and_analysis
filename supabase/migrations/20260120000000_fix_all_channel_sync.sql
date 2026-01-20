-- ============================================
-- Fix ALL Channel Sync - Complete Overhaul
-- ============================================
-- Issues fixed:
-- 1. get_channels_for_rss_poll only looked at tracked_channels, not user_channel_subscriptions
-- 2. It checked last_competitor_route_opened_at (removed route) instead of last_ideation_opened_at
-- 3. auto_sync_video_to_users required tracked_channels entry per user
-- 4. Videos showing 0 views because view_count wasn't being copied

-- ============================================
-- 1. Fix get_channels_for_rss_poll to use user_channel_subscriptions
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
  SELECT DISTINCT ON (tc.channel_id)
    tc.id,
    ucs.user_id,
    tc.channel_id,
    tc.channel_name,
    tc.rss_feed_url
  FROM public.tracked_channels tc
  INNER JOIN public.user_channel_subscriptions ucs ON ucs.channel_id = tc.channel_id
  INNER JOIN public.user_activity ua ON ua.user_id = ucs.user_id
  WHERE tc.is_active = true
    AND tc.rss_feed_url IS NOT NULL
    AND ucs.is_active = true
    -- Check last_ideation_opened_at instead of removed competitor route
    AND (ua.last_ideation_opened_at IS NULL OR ua.last_ideation_opened_at > (now() - INTERVAL '72 hours'))
  ORDER BY tc.channel_id, tc.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 2. Fix auto_sync_video_to_users to NOT require tracked_channels per user
-- ============================================
CREATE OR REPLACE FUNCTION public.auto_sync_video_to_users()
RETURNS TRIGGER AS $$
DECLARE
  v_channel_name TEXT;
BEGIN
  -- Get channel name from tracked_channels (it's global, not per-user)
  SELECT tc.channel_name INTO v_channel_name
  FROM public.tracked_channels tc
  WHERE tc.channel_id = NEW.channel_id
  LIMIT 1;

  -- If no channel name found, try to extract from the video
  IF v_channel_name IS NULL THEN
    v_channel_name := 'Unknown Channel';
  END IF;

  -- Insert video for ALL users who are subscribed to this channel
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
    v_channel_name,
    NEW.published_at,
    COALESCE(NEW.view_count, 0),
    ucs.niche,
    now()
  FROM public.user_channel_subscriptions ucs
  LEFT JOIN public.user_activity ua ON ua.user_id = ucs.user_id
  WHERE ucs.channel_id = NEW.channel_id
    AND ucs.is_active = true
    -- Only sync for users who have been active in the last 3 days
    -- If user_activity doesn't exist, still sync (new users)
    AND (ua.user_id IS NULL OR ua.last_ideation_opened_at IS NULL OR ua.last_ideation_opened_at > now() - INTERVAL '3 days')
  ON CONFLICT (user_id, video_id) DO UPDATE SET
    view_count = EXCLUDED.view_count,
    title = EXCLUDED.title;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-create trigger
DROP TRIGGER IF EXISTS trigger_auto_sync_video ON public.tracked_videos;
CREATE TRIGGER trigger_auto_sync_video
  AFTER INSERT ON public.tracked_videos
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_sync_video_to_users();

-- ============================================
-- 3. Ensure all channels from user_videos have tracked_channels entries
-- ============================================
-- This is needed because poll-rss-feeds uses tracked_channels for RSS URLs
INSERT INTO public.tracked_channels (channel_id, channel_name, rss_feed_url, is_active, user_id)
SELECT DISTINCT ON (tv.channel_id)
  tv.channel_id,
  uv.channel_name,
  'https://www.youtube.com/feeds/videos.xml?channel_id=' || tv.channel_id,
  true,
  uv.user_id
FROM public.user_videos uv
JOIN public.tracked_videos tv ON tv.video_id = uv.video_id
WHERE tv.channel_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.tracked_channels tc WHERE tc.channel_id = tv.channel_id
  )
ORDER BY tv.channel_id, uv.created_at DESC
ON CONFLICT DO NOTHING;

-- ============================================
-- 4. Fix user_activity for all users with videos
-- ============================================
-- Make sure all users with videos have activity records with ideation timestamp
INSERT INTO public.user_activity (user_id, last_ideation_opened_at, is_active, created_at, updated_at)
SELECT DISTINCT
  user_id,
  now(),
  true,
  now(),
  now()
FROM public.user_videos
ON CONFLICT (user_id) DO UPDATE SET
  last_ideation_opened_at = COALESCE(public.user_activity.last_ideation_opened_at, now()),
  is_active = true,
  updated_at = now();

-- ============================================
-- 5. Update existing videos with 0 views from tracked_videos
-- ============================================
-- Sync view counts from tracked_videos to user_videos where user_videos has 0
UPDATE public.user_videos uv
SET view_count = tv.view_count
FROM public.tracked_videos tv
WHERE uv.video_id = tv.video_id
  AND (uv.view_count IS NULL OR uv.view_count = 0)
  AND tv.view_count IS NOT NULL
  AND tv.view_count > 0;

-- ============================================
-- 6. Log what we fixed
-- ============================================
DO $$
DECLARE
  v_subscription_count INT;
  v_channel_count INT;
  v_updated_views INT;
BEGIN
  SELECT COUNT(*) INTO v_subscription_count FROM public.user_channel_subscriptions WHERE is_active = true;
  SELECT COUNT(DISTINCT channel_id) INTO v_channel_count FROM public.user_channel_subscriptions WHERE is_active = true;
  
  GET DIAGNOSTICS v_updated_views = ROW_COUNT;
  
  RAISE NOTICE 'Fixed channel sync: % active subscriptions for % unique channels', v_subscription_count, v_channel_count;
END $$;
