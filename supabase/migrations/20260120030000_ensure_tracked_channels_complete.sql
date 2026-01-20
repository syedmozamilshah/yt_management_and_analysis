-- ============================================
-- Ensure Tracked Channels Exist for All Subscriptions
-- ============================================

-- ============================================
-- 1. Create tracked_channels for ALL subscribed channels that don't have entries
-- ============================================
INSERT INTO public.tracked_channels (channel_id, channel_name, rss_feed_url, is_active, user_id)
SELECT DISTINCT ON (ucs.channel_id)
  ucs.channel_id,
  COALESCE(
    (SELECT uv.channel_name FROM public.user_videos uv WHERE uv.channel_id = ucs.channel_id LIMIT 1),
    'Unknown Channel'
  ),
  'https://www.youtube.com/feeds/videos.xml?channel_id=' || ucs.channel_id,
  true,
  ucs.user_id
FROM public.user_channel_subscriptions ucs
WHERE ucs.is_active = true
  AND ucs.channel_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.tracked_channels tc WHERE tc.channel_id = ucs.channel_id
  )
ORDER BY ucs.channel_id, ucs.created_at DESC
ON CONFLICT DO NOTHING;

-- ============================================
-- 2. Create subscriptions for all channels that have tracked_channels but no subscription
-- ============================================
INSERT INTO public.user_channel_subscriptions (user_id, channel_id, niche, is_active)
SELECT DISTINCT ON (uv.user_id, uv.channel_id)
  uv.user_id,
  uv.channel_id,
  COALESCE(uv.niche, 'General'),
  true
FROM public.user_videos uv
WHERE uv.channel_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.user_channel_subscriptions ucs 
    WHERE ucs.user_id = uv.user_id AND ucs.channel_id = uv.channel_id
  )
ORDER BY uv.user_id, uv.channel_id, uv.created_at DESC
ON CONFLICT (user_id, channel_id) DO UPDATE SET
  is_active = true,
  updated_at = now();

-- ============================================
-- 3. Ensure user_activity exists for all users with subscriptions
-- ============================================
INSERT INTO public.user_activity (user_id, last_ideation_opened_at, is_active, created_at, updated_at)
SELECT DISTINCT
  ucs.user_id,
  now(),
  true,
  now(),
  now()
FROM public.user_channel_subscriptions ucs
WHERE ucs.is_active = true
ON CONFLICT (user_id) DO UPDATE SET
  last_ideation_opened_at = COALESCE(public.user_activity.last_ideation_opened_at, now()),
  is_active = true,
  updated_at = now();

-- ============================================
-- 4. Log final state
-- ============================================
DO $$
DECLARE
  v_tracked_channels INT;
  v_subscriptions INT;
  v_active_users INT;
BEGIN
  SELECT COUNT(*) INTO v_tracked_channels FROM public.tracked_channels WHERE is_active = true;
  SELECT COUNT(*) INTO v_subscriptions FROM public.user_channel_subscriptions WHERE is_active = true;
  SELECT COUNT(*) INTO v_active_users FROM public.user_activity WHERE is_active = true;
  
  RAISE NOTICE 'Tracked channels: %, Subscriptions: %, Active users: %', 
    v_tracked_channels, v_subscriptions, v_active_users;
END $$;
