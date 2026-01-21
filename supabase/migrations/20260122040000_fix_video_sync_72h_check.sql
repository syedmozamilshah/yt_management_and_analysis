-- ============================================
-- Fix video sync with proper 72-hour activity check
-- 1. Only sync to users who have been active in last 72 hours
-- 2. When user opens ideation, sync any missed videos
-- ============================================

-- 1. Update auto_sync_video_to_users with proper 72-hour check
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

  -- Insert video for users who:
  -- 1. Have this channel tracked
  -- 2. Have been active in the last 72 hours (opened ideation)
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
  LEFT JOIN public.user_activity ua ON ua.user_id = tc.user_id
  WHERE tc.channel_id = NEW.channel_id
    AND tc.is_active = true
    -- Only sync to users active in last 72 hours
    AND (
      ua.last_ideation_opened_at IS NOT NULL 
      AND ua.last_ideation_opened_at > (now() - INTERVAL '72 hours')
    )
  ON CONFLICT (user_id, video_id) DO UPDATE SET
    view_count = EXCLUDED.view_count,
    channel_name = COALESCE(EXCLUDED.channel_name, public.user_videos.channel_name);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Function to sync missed videos when user opens ideation
-- This should be called when user opens the ideation page
CREATE OR REPLACE FUNCTION public.sync_missed_videos_for_user(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_synced_count INTEGER := 0;
BEGIN
  -- Update user activity first
  INSERT INTO public.user_activity (user_id, last_ideation_opened_at)
  VALUES (p_user_id, now())
  ON CONFLICT (user_id) DO UPDATE SET 
    last_ideation_opened_at = now(),
    updated_at = now();

  -- Sync videos from tracked channels that user missed
  -- Get videos from last 7 days that the user doesn't have yet
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
    p_user_id,
    tv.title,
    COALESCE(tv.youtube_url, 'https://www.youtube.com/watch?v=' || tv.video_id),
    tv.video_id,
    COALESCE(tv.thumbnail_url, 'https://i.ytimg.com/vi/' || tv.video_id || '/hqdefault.jpg'),
    COALESCE(tv.channel_name, tc.channel_name, 'Unknown Channel'),
    tv.published_at::date,
    COALESCE(tv.view_count, 0),
    COALESCE(
      (SELECT ucs.niche FROM public.user_channel_subscriptions ucs 
       WHERE ucs.user_id = p_user_id AND ucs.channel_id = tv.channel_id LIMIT 1),
      (SELECT agc.niche FROM public.admin_global_channels agc 
       WHERE agc.channel_id = tv.channel_id LIMIT 1),
      'Uncategorized'
    ),
    tv.channel_id,
    tv.created_at
  FROM public.tracked_videos tv
  INNER JOIN public.tracked_channels tc 
    ON tc.channel_id = tv.channel_id 
    AND tc.user_id = p_user_id
    AND tc.is_active = true
  WHERE tv.created_at > (now() - INTERVAL '7 days')
    AND NOT EXISTS (
      SELECT 1 FROM public.user_videos uv 
      WHERE uv.user_id = p_user_id AND uv.video_id = tv.video_id
    )
  ON CONFLICT (user_id, video_id) DO NOTHING;

  GET DIAGNOSTICS v_synced_count = ROW_COUNT;
  
  RETURN v_synced_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.sync_missed_videos_for_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_missed_videos_for_user(UUID) TO service_role;

-- 3. Recreate the trigger
DROP TRIGGER IF EXISTS trigger_auto_sync_video ON public.tracked_videos;
CREATE TRIGGER trigger_auto_sync_video
  AFTER INSERT ON public.tracked_videos
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_sync_video_to_users();

-- Drop the extra trigger we added
DROP TRIGGER IF EXISTS trigger_sync_video_subscriptions ON public.tracked_videos;
