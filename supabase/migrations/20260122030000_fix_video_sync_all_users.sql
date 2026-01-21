-- ============================================
-- Fix video sync to ensure new videos from tracked channels sync to ALL users
-- The issue: auto_sync_video_to_users requires user_channel_subscriptions + recent activity
-- This is too restrictive - users want to see ALL new videos from their tracked channels
-- ============================================

-- 1. Update auto_sync_video_to_users to sync to ALL users who have the channel tracked
CREATE OR REPLACE FUNCTION public.auto_sync_video_to_users()
RETURNS TRIGGER AS $$
DECLARE
  v_channel_name TEXT;
BEGIN
  -- Get channel name
  v_channel_name := COALESCE(NEW.channel_name, (
    SELECT tc.channel_name FROM public.tracked_channels tc 
    WHERE tc.channel_id = NEW.channel_id LIMIT 1
  ), (
    SELECT agc.channel_name FROM public.admin_global_channels agc 
    WHERE agc.channel_id = NEW.channel_id LIMIT 1
  ));

  -- Insert video for ALL users who have this channel in their tracked_channels
  -- No activity requirement - they added the channel, they should get the videos
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
    created_at
  )
  SELECT DISTINCT
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
    now()
  FROM public.tracked_channels tc
  WHERE tc.channel_id = NEW.channel_id
    AND tc.is_active = true
  ON CONFLICT (user_id, video_id) DO UPDATE SET
    view_count = EXCLUDED.view_count,
    channel_name = COALESCE(EXCLUDED.channel_name, public.user_videos.channel_name);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Also sync to users via user_channel_subscriptions (for users who subscribed but don't have in tracked_channels)
CREATE OR REPLACE FUNCTION public.sync_video_via_subscriptions()
RETURNS TRIGGER AS $$
DECLARE
  v_channel_name TEXT;
BEGIN
  -- Get channel name
  v_channel_name := COALESCE(NEW.channel_name, (
    SELECT tc.channel_name FROM public.tracked_channels tc 
    WHERE tc.channel_id = NEW.channel_id LIMIT 1
  ));

  -- Insert video for users who have this channel in subscriptions
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
    created_at
  )
  SELECT DISTINCT
    ucs.user_id,
    NEW.title,
    COALESCE(NEW.youtube_url, 'https://www.youtube.com/watch?v=' || NEW.video_id),
    NEW.video_id,
    COALESCE(NEW.thumbnail_url, 'https://i.ytimg.com/vi/' || NEW.video_id || '/hqdefault.jpg'),
    v_channel_name,
    NEW.published_at::date,
    COALESCE(NEW.view_count, 0),
    ucs.niche,
    NEW.channel_id,
    now()
  FROM public.user_channel_subscriptions ucs
  WHERE ucs.channel_id = NEW.channel_id
    AND ucs.is_active = true
  ON CONFLICT (user_id, video_id) DO UPDATE SET
    view_count = EXCLUDED.view_count,
    niche = EXCLUDED.niche;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Recreate the triggers
DROP TRIGGER IF EXISTS trigger_auto_sync_video ON public.tracked_videos;
CREATE TRIGGER trigger_auto_sync_video
  AFTER INSERT ON public.tracked_videos
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_sync_video_to_users();

DROP TRIGGER IF EXISTS trigger_sync_video_subscriptions ON public.tracked_videos;
CREATE TRIGGER trigger_sync_video_subscriptions
  AFTER INSERT ON public.tracked_videos
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_video_via_subscriptions();

-- 4. Sync any recent videos that may have been missed (last 24 hours)
-- This is a one-time sync for videos that were inserted but not synced properly
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
  created_at
)
SELECT DISTINCT
  tc.user_id,
  tv.title,
  COALESCE(tv.youtube_url, 'https://www.youtube.com/watch?v=' || tv.video_id),
  tv.video_id,
  COALESCE(tv.thumbnail_url, 'https://i.ytimg.com/vi/' || tv.video_id || '/hqdefault.jpg'),
  COALESCE(tv.channel_name, tc.channel_name, 'Unknown Channel'),
  tv.published_at::date,
  COALESCE(tv.view_count, 0),
  COALESCE(
    (SELECT ucs.niche FROM public.user_channel_subscriptions ucs 
     WHERE ucs.user_id = tc.user_id AND ucs.channel_id = tv.channel_id LIMIT 1),
    (SELECT agc.niche FROM public.admin_global_channels agc 
     WHERE agc.channel_id = tv.channel_id LIMIT 1),
    'Uncategorized'
  ),
  tv.channel_id,
  tv.created_at
FROM public.tracked_videos tv
INNER JOIN public.tracked_channels tc ON tc.channel_id = tv.channel_id AND tc.is_active = true
WHERE tv.created_at > now() - INTERVAL '24 hours'
ON CONFLICT (user_id, video_id) DO UPDATE SET
  view_count = EXCLUDED.view_count,
  channel_name = COALESCE(EXCLUDED.channel_name, public.user_videos.channel_name);
