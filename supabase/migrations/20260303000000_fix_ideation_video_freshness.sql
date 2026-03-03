-- ============================================
-- Fix Ideation Video Freshness Issues
-- ============================================
-- Problem: Videos show up 1-2 days late in ideation instead of immediately
-- Root causes:
--   1) get_channels_needing_renewal() checks last_competitor_route_opened_at (wrong column)
--      → WebSub subscriptions expire for ideation-only users → no real-time push notifications
--   2) No cron job for renewing WebSub subscriptions → channels go stale
--   3) auto_sync_video_to_users trigger has a LEFT JOIN on user_activity + 72h check for non-ideation tabs
--      → user_activity row must exist; if last_ideation_opened_at is stale, sync fails for non-ideation
--   4) poll-rss-feeds runs every 5 min but YouTube RSS feeds have ~15-60 min cache
--      → Best fix: ensure WebSub push is always active so new videos arrive instantly

-- ==============================================
-- 1. Fix get_channels_needing_renewal() to use last_ideation_opened_at
--    AND be more lenient (7 days instead of 72 hours)
-- ==============================================
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
  SELECT DISTINCT ON (tc.channel_id)
    tc.id,
    tc.user_id,
    tc.channel_id,
    tc.channel_name,
    tc.rss_feed_url,
    tc.subscription_expires_at
  FROM public.tracked_channels tc
  WHERE tc.is_active = true
    AND tc.webhook_subscribed = true
    AND tc.subscription_expires_at IS NOT NULL
    AND tc.subscription_expires_at < (now() + INTERVAL '48 hours')
  ORDER BY tc.channel_id, tc.subscription_expires_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================
-- 2. Create function to get channels that have NEVER been subscribed
--    or whose subscription has fully expired (for re-subscription)
-- ==============================================
CREATE OR REPLACE FUNCTION get_channels_needing_subscription()
RETURNS TABLE (
  channel_id TEXT,
  channel_name TEXT,
  rss_feed_url TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (tc.channel_id)
    tc.channel_id,
    tc.channel_name,
    tc.rss_feed_url
  FROM public.tracked_channels tc
  WHERE tc.is_active = true
    AND tc.rss_feed_url IS NOT NULL
    AND tc.rss_feed_url != ''
    AND (
      -- Never subscribed
      tc.webhook_subscribed = false
      OR tc.webhook_subscribed IS NULL
      -- Subscription has expired
      OR (tc.subscription_expires_at IS NOT NULL AND tc.subscription_expires_at < now())
    )
  ORDER BY tc.channel_id, tc.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_channels_needing_subscription TO service_role;
GRANT EXECUTE ON FUNCTION get_channels_needing_renewal TO service_role;

-- ==============================================
-- 3. Fix auto_sync_video_to_users trigger to be even more reliable
--    Remove the LEFT JOIN on user_activity that can cause missed syncs
-- ==============================================
CREATE OR REPLACE FUNCTION public.auto_sync_video_to_users()
RETURNS TRIGGER AS $$
DECLARE
  v_channel_name TEXT;
BEGIN
  -- Get channel name from multiple sources, prioritizing non-null values
  v_channel_name := NEW.channel_name;
  
  -- If channel_name from NEW is null or empty, try tracked_channels
  IF v_channel_name IS NULL OR v_channel_name = '' OR v_channel_name = 'Unknown Channel' THEN
    SELECT tc.channel_name INTO v_channel_name
    FROM public.tracked_channels tc 
    WHERE tc.channel_id = NEW.channel_id 
      AND tc.channel_name IS NOT NULL 
      AND tc.channel_name != ''
    LIMIT 1;
  END IF;
  
  -- If still null, try admin_global_channels
  IF v_channel_name IS NULL OR v_channel_name = '' OR v_channel_name = 'Unknown Channel' THEN
    SELECT agc.channel_name INTO v_channel_name
    FROM public.admin_global_channels agc 
    WHERE agc.channel_id = NEW.channel_id
      AND agc.channel_name IS NOT NULL 
      AND agc.channel_name != ''
    LIMIT 1;
  END IF;
  
  -- Last resort: use a placeholder with the channel ID
  IF v_channel_name IS NULL OR v_channel_name = '' THEN
    v_channel_name := 'Channel ' || SUBSTRING(NEW.channel_id FROM 1 FOR 8);
  END IF;

  -- Insert video for ALL users who have this channel tracked (active channels)
  -- NO user_activity check — every active tracked channel subscription gets the video
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
    channel_id,
    created_at,
    tab_type,
    is_global
  )
  SELECT DISTINCT ON (tc.user_id)
    tc.user_id,
    NEW.title,
    COALESCE(NEW.youtube_url, 'https://www.youtube.com/watch?v=' || NEW.video_id),
    NEW.video_id,
    COALESCE(NEW.thumbnail_url, 'https://i.ytimg.com/vi/' || NEW.video_id || '/hqdefault.jpg'),
    v_channel_name,
    NEW.published_at::date,
    COALESCE(NEW.view_count, 0),
    COALESCE(
      (SELECT ucs.niche FROM public.user_channel_subscriptions ucs 
       WHERE ucs.user_id = tc.user_id AND ucs.channel_id = NEW.channel_id LIMIT 1),
      (SELECT agc.niche FROM public.admin_global_channels agc 
       WHERE agc.channel_id = NEW.channel_id LIMIT 1),
      'Uncategorized'
    ),
    NEW.channel_id,
    now(),
    COALESCE(tc.tab_type, 'ideation'),
    COALESCE(tc.is_global, false)
  FROM public.tracked_channels tc
  WHERE tc.channel_id = NEW.channel_id
    AND tc.is_active = true
  ON CONFLICT (user_id, video_id) DO UPDATE SET
    view_count = EXCLUDED.view_count,
    tab_type = EXCLUDED.tab_type,
    is_global = EXCLUDED.is_global,
    channel_name = CASE 
      WHEN EXCLUDED.channel_name IS NOT NULL 
           AND EXCLUDED.channel_name != '' 
           AND EXCLUDED.channel_name != 'Unknown Channel'
      THEN EXCLUDED.channel_name 
      ELSE COALESCE(public.user_videos.channel_name, EXCLUDED.channel_name)
    END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
DROP TRIGGER IF EXISTS trigger_auto_sync_video ON public.tracked_videos;
CREATE TRIGGER trigger_auto_sync_video
  AFTER INSERT ON public.tracked_videos
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_sync_video_to_users();

-- ==============================================
-- 4. Schedule WebSub renewal cron job (every 6 hours)
--    This ensures subscriptions are renewed before they expire
-- ==============================================
DO $$
BEGIN
  -- Remove old renewal job if exists
  PERFORM cron.unschedule('renew-websub-subscriptions');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'renew-websub-subscriptions',
  '0 */6 * * *', -- Every 6 hours
  $$
  SELECT net.http_post(
    url := 'https://baffhoalkllpeugluyon.supabase.co/functions/v1/renew-websub-subscriptions',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhZmZob2Fsa2xscGV1Z2x1eW9uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzI5OTc5NDgsImV4cCI6MjA0ODU3Mzk0OH0.RfxPpx1Gt3LbpKYv5HU2NxN-lh2EsEzC8aYuMxhDJ68'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ==============================================
-- 5. Ensure the RSS poll is still every 5 minutes as fallback
-- ==============================================
DO $$
BEGIN
  PERFORM cron.unschedule('poll-rss-feeds-5min');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('poll-rss-feeds-optimized');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'poll-rss-feeds-5min',
  '*/5 * * * *', -- Every 5 minutes
  $$
  SELECT net.http_post(
    url := 'https://baffhoalkllpeugluyon.supabase.co/functions/v1/poll-rss-feeds',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhZmZob2Fsa2xscGV1Z2x1eW9uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzI5OTc5NDgsImV4cCI6MjA0ODU3Mzk0OH0.RfxPpx1Gt3LbpKYv5HU2NxN-lh2EsEzC8aYuMxhDJ68'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ==============================================
-- 6. Log migration 
-- ==============================================
DO $$
DECLARE
  v_total_channels INT;
  v_subscribed_channels INT;
  v_expired_channels INT;
BEGIN
  SELECT COUNT(DISTINCT channel_id) INTO v_total_channels
  FROM public.tracked_channels WHERE is_active = true;
  
  SELECT COUNT(DISTINCT channel_id) INTO v_subscribed_channels
  FROM public.tracked_channels WHERE is_active = true AND webhook_subscribed = true
    AND subscription_expires_at > now();
    
  SELECT COUNT(DISTINCT channel_id) INTO v_expired_channels
  FROM public.tracked_channels WHERE is_active = true
    AND (webhook_subscribed = false OR subscription_expires_at IS NULL OR subscription_expires_at < now());
  
  RAISE NOTICE 'Migration complete: % total channels, % with active WebSub, % need (re)subscription',
    v_total_channels, v_subscribed_channels, v_expired_channels;
END $$;
