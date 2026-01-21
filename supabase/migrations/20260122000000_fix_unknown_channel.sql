-- ============================================
-- Fix "Unknown Channel" issue
-- The tracked_videos table doesn't have channel_name column
-- The trigger needs to get channel_name from tracked_channels or admin_global_channels
-- ============================================

-- 1. Add channel_name column to tracked_videos for better data integrity
ALTER TABLE public.tracked_videos 
ADD COLUMN IF NOT EXISTS channel_name TEXT;

-- 2. Update existing tracked_videos with channel names from tracked_channels
UPDATE public.tracked_videos tv
SET channel_name = tc.channel_name
FROM public.tracked_channels tc
WHERE tv.channel_id = tc.channel_id
  AND tv.channel_name IS NULL
  AND tc.channel_name IS NOT NULL;

-- 3. Also update from admin_global_channels for global channels
UPDATE public.tracked_videos tv
SET channel_name = agc.channel_name
FROM public.admin_global_channels agc
WHERE tv.channel_id = agc.channel_id
  AND tv.channel_name IS NULL
  AND agc.channel_name IS NOT NULL;

-- 4. Fix user_videos that have "Unknown Channel" - update them with correct channel names
UPDATE public.user_videos uv
SET channel_name = tc.channel_name
FROM public.tracked_channels tc
WHERE uv.channel_id = tc.channel_id
  AND (uv.channel_name IS NULL OR uv.channel_name = 'Unknown Channel')
  AND tc.channel_name IS NOT NULL;

-- 5. Also update from admin_global_channels
UPDATE public.user_videos uv
SET channel_name = agc.channel_name
FROM public.admin_global_channels agc
WHERE uv.channel_id = agc.channel_id
  AND (uv.channel_name IS NULL OR uv.channel_name = 'Unknown Channel')
  AND agc.channel_name IS NOT NULL;

-- 6. Update the auto_sync_video_to_users function to get channel_name properly
CREATE OR REPLACE FUNCTION public.auto_sync_video_to_users()
RETURNS TRIGGER AS $$
DECLARE
  v_channel_name TEXT;
BEGIN
  -- Try to get channel name from the video itself first (if tracked_videos now has it)
  v_channel_name := NEW.channel_name;
  
  -- If not in video, try from tracked_channels
  IF v_channel_name IS NULL THEN
    SELECT tc.channel_name INTO v_channel_name
    FROM public.tracked_channels tc
    WHERE tc.channel_id = NEW.channel_id
    LIMIT 1;
  END IF;
  
  -- If still null, try from admin_global_channels
  IF v_channel_name IS NULL THEN
    SELECT agc.channel_name INTO v_channel_name
    FROM public.admin_global_channels agc
    WHERE agc.channel_id = NEW.channel_id
    LIMIT 1;
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
    channel_id,
    created_at
  )
  SELECT 
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
  INNER JOIN public.user_activity ua ON ua.user_id = ucs.user_id
  WHERE ucs.channel_id = NEW.channel_id
    AND ucs.is_active = true
    AND (ua.last_ideation_opened_at IS NULL OR ua.last_ideation_opened_at > (now() - INTERVAL '72 hours'))
  ON CONFLICT (user_id, video_id) DO UPDATE SET
    view_count = EXCLUDED.view_count,
    channel_name = COALESCE(EXCLUDED.channel_name, public.user_videos.channel_name);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Update the sync_new_global_video_to_users function to get channel_name properly
CREATE OR REPLACE FUNCTION public.sync_new_global_video_to_users()
RETURNS TRIGGER AS $$
DECLARE
  v_global_channel RECORD;
  v_user_id UUID;
  v_channel_name TEXT;
BEGIN
  -- Check if this video is from a global channel
  SELECT * INTO v_global_channel 
  FROM public.admin_global_channels 
  WHERE channel_id = NEW.channel_id AND is_active = true;
  
  IF v_global_channel IS NOT NULL THEN
    -- Get channel name from global channel record (it should have it)
    v_channel_name := COALESCE(v_global_channel.channel_name, NEW.channel_name);
    
    -- If still null, try tracked_channels
    IF v_channel_name IS NULL THEN
      SELECT tc.channel_name INTO v_channel_name
      FROM public.tracked_channels tc
      WHERE tc.channel_id = NEW.channel_id
      LIMIT 1;
    END IF;
    
    -- Sync to all users
    FOR v_user_id IN SELECT id FROM auth.users LOOP
      INSERT INTO public.user_videos (
        user_id,
        video_id,
        title,
        youtube_url,
        thumbnail_url,
        channel_name,
        channel_subscribers,
        upload_date,
        view_count,
        niche,
        channel_id,
        is_global
      ) VALUES (
        v_user_id,
        NEW.video_id,
        NEW.title,
        'https://www.youtube.com/watch?v=' || NEW.video_id,
        NEW.thumbnail_url,
        v_channel_name,
        v_global_channel.channel_subscribers,
        NEW.published_at::date,
        COALESCE(NEW.view_count, 0),
        v_global_channel.niche,
        NEW.channel_id,
        true
      ) ON CONFLICT (user_id, video_id) DO UPDATE SET
        view_count = EXCLUDED.view_count,
        is_global = true,
        channel_name = COALESCE(EXCLUDED.channel_name, public.user_videos.channel_name);
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Update poll-rss-feeds to include channel_name when inserting into tracked_videos
-- This needs to be done in the Edge Function as well

-- 9. Recreate triggers
DROP TRIGGER IF EXISTS trigger_auto_sync_video ON public.tracked_videos;
CREATE TRIGGER trigger_auto_sync_video
  AFTER INSERT ON public.tracked_videos
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_sync_video_to_users();

DROP TRIGGER IF EXISTS trigger_sync_new_global_video ON public.tracked_videos;
CREATE TRIGGER trigger_sync_new_global_video
  AFTER INSERT ON public.tracked_videos
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_new_global_video_to_users();
