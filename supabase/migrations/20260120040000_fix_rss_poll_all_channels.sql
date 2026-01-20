-- ============================================
-- Fix RSS Poll to Include All Subscribed Channels
-- ============================================
-- Current issue: Only 5 channels are being polled because of strict user activity filter
-- Solution: Poll all channels that have ANY active subscription

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
  -- Get ALL channels that have at least one active subscription from an active user
  SELECT DISTINCT ON (tc.channel_id)
    tc.id,
    ucs.user_id,
    tc.channel_id,
    tc.channel_name,
    tc.rss_feed_url
  FROM public.tracked_channels tc
  INNER JOIN public.user_channel_subscriptions ucs ON ucs.channel_id = tc.channel_id
  LEFT JOIN public.user_activity ua ON ua.user_id = ucs.user_id
  WHERE tc.is_active = true
    AND tc.rss_feed_url IS NOT NULL
    AND ucs.is_active = true
    -- Be more lenient: either user opened ideation recently OR user_activity doesn't exist yet
    AND (
      ua.user_id IS NULL  -- No activity record yet (new user)
      OR ua.last_ideation_opened_at IS NULL  -- Never opened ideation
      OR ua.last_ideation_opened_at > (now() - INTERVAL '7 days')  -- Extended to 7 days
    )
  ORDER BY tc.channel_id, tc.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Also ensure ALL user_videos with channel_id have subscriptions
-- ============================================
INSERT INTO public.user_channel_subscriptions (user_id, channel_id, niche, is_active)
SELECT DISTINCT
  uv.user_id,
  uv.channel_id,
  COALESCE(uv.niche, 'General'),
  true
FROM public.user_videos uv
WHERE uv.channel_id IS NOT NULL
ON CONFLICT (user_id, channel_id) DO UPDATE SET
  is_active = true,
  updated_at = now();

-- ============================================
-- Log final count
-- ============================================
DO $$
DECLARE
  v_poll_channels INT;
  v_subscriptions INT;
BEGIN
  SELECT COUNT(*) INTO v_poll_channels FROM get_channels_for_rss_poll();
  SELECT COUNT(DISTINCT channel_id) INTO v_subscriptions FROM public.user_channel_subscriptions WHERE is_active = true;
  
  RAISE NOTICE 'Channels available for polling: %, Unique subscribed channels: %', 
    v_poll_channels, v_subscriptions;
END $$;
