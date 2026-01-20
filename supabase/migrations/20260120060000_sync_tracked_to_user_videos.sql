-- ============================================
-- Sync Existing Tracked Videos to User Videos
-- ============================================
-- The trigger only works for NEW videos. We need to backfill existing videos.

-- First, let's see what we're working with
DO $$
DECLARE
  v_subscriptions INT;
  v_tracked_videos INT;
  v_matching INT;
BEGIN
  SELECT COUNT(*) INTO v_subscriptions FROM public.user_channel_subscriptions WHERE is_active = true;
  SELECT COUNT(*) INTO v_tracked_videos FROM public.tracked_videos WHERE published_at > now() - INTERVAL '30 days';
  
  SELECT COUNT(DISTINCT tv.video_id) INTO v_matching
  FROM public.tracked_videos tv
  JOIN public.user_channel_subscriptions ucs ON ucs.channel_id = tv.channel_id
  WHERE ucs.is_active = true AND tv.published_at > now() - INTERVAL '30 days';
  
  RAISE NOTICE 'Subscriptions: %, Tracked videos (30d): %, Matching: %', 
    v_subscriptions, v_tracked_videos, v_matching;
END $$;

-- Insert videos from tracked_videos into user_videos for all subscribed users
INSERT INTO public.user_videos (
  user_id,
  title,
  youtube_url,
  video_id,
  thumbnail_url,
  channel_id,
  channel_name,
  upload_date,
  view_count,
  niche,
  created_at
)
SELECT DISTINCT ON (ucs.user_id, tv.video_id)
  ucs.user_id,
  tv.title,
  COALESCE(tv.youtube_url, 'https://www.youtube.com/watch?v=' || tv.video_id),
  tv.video_id,
  COALESCE(tv.thumbnail_url, 'https://i.ytimg.com/vi/' || tv.video_id || '/hqdefault.jpg'),
  tv.channel_id,
  COALESCE(tc.channel_name, 'Unknown Channel'),
  tv.published_at::text,
  COALESCE(tv.view_count, 0),
  ucs.niche,
  now()
FROM public.tracked_videos tv
JOIN public.user_channel_subscriptions ucs ON ucs.channel_id = tv.channel_id
LEFT JOIN public.tracked_channels tc ON tc.channel_id = tv.channel_id
WHERE ucs.is_active = true
  AND tv.published_at > now() - INTERVAL '30 days'  -- Only recent videos
ORDER BY ucs.user_id, tv.video_id
ON CONFLICT (user_id, video_id) DO UPDATE SET
  view_count = COALESCE(EXCLUDED.view_count, public.user_videos.view_count),
  channel_id = COALESCE(EXCLUDED.channel_id, public.user_videos.channel_id);

-- Log what was synced
DO $$
DECLARE
  v_synced INT;
BEGIN
  GET DIAGNOSTICS v_synced = ROW_COUNT;
  RAISE NOTICE 'Synced/updated % video records to user_videos', v_synced;
END $$;
