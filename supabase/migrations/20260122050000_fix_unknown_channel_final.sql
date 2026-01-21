-- ============================================
-- Final fix for "Unknown Channel" issue
-- 1. Update tracked_videos with channel names from tracked_channels
-- 2. Update user_videos with channel names from tracked_videos/tracked_channels
-- 3. Update the sync function to never return Unknown Channel
-- ============================================

-- 1. First, update tracked_videos that have NULL channel_name
UPDATE public.tracked_videos tv
SET channel_name = tc.channel_name
FROM public.tracked_channels tc
WHERE tv.channel_id = tc.channel_id
  AND tc.channel_name IS NOT NULL
  AND tc.channel_name != ''
  AND (tv.channel_name IS NULL OR tv.channel_name = 'Unknown Channel' OR tv.channel_name = '');

-- 2. Also try to get channel name from admin_global_channels
UPDATE public.tracked_videos tv
SET channel_name = agc.channel_name
FROM public.admin_global_channels agc
WHERE tv.channel_id = agc.channel_id
  AND agc.channel_name IS NOT NULL
  AND agc.channel_name != ''
  AND (tv.channel_name IS NULL OR tv.channel_name = 'Unknown Channel' OR tv.channel_name = '');

-- 3. Update user_videos that have NULL or Unknown Channel
UPDATE public.user_videos uv
SET channel_name = tv.channel_name
FROM public.tracked_videos tv
WHERE uv.video_id = tv.video_id
  AND tv.channel_name IS NOT NULL
  AND tv.channel_name != ''
  AND tv.channel_name != 'Unknown Channel'
  AND (uv.channel_name IS NULL OR uv.channel_name = 'Unknown Channel' OR uv.channel_name = '');

-- 4. Also try from tracked_channels directly using channel_id
UPDATE public.user_videos uv
SET channel_name = tc.channel_name
FROM public.tracked_channels tc
WHERE uv.channel_id = tc.channel_id
  AND tc.channel_name IS NOT NULL
  AND tc.channel_name != ''
  AND (uv.channel_name IS NULL OR uv.channel_name = 'Unknown Channel' OR uv.channel_name = '');

-- 5. Also try from admin_global_channels
UPDATE public.user_videos uv
SET channel_name = agc.channel_name
FROM public.admin_global_channels agc
WHERE uv.channel_id = agc.channel_id
  AND agc.channel_name IS NOT NULL
  AND agc.channel_name != ''
  AND (uv.channel_name IS NULL OR uv.channel_name = 'Unknown Channel' OR uv.channel_name = '');

-- 6. Update auto_sync_video_to_users to be more robust about getting channel name
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

  -- Insert video for users who have this channel tracked and are active
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
    AND (
      ua.last_ideation_opened_at IS NOT NULL 
      AND ua.last_ideation_opened_at > (now() - INTERVAL '72 hours')
    )
  ON CONFLICT (user_id, video_id) DO UPDATE SET
    view_count = EXCLUDED.view_count,
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

-- 7. Update sync_missed_videos_for_user to be more robust
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
    COALESCE(
      NULLIF(tv.channel_name, ''),
      NULLIF(tv.channel_name, 'Unknown Channel'),
      NULLIF(tc.channel_name, ''),
      NULLIF((SELECT agc.channel_name FROM public.admin_global_channels agc WHERE agc.channel_id = tv.channel_id LIMIT 1), ''),
      'Channel ' || SUBSTRING(tv.channel_id FROM 1 FOR 8)
    ),
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
  ON CONFLICT (user_id, video_id) DO UPDATE SET
    channel_name = CASE 
      WHEN EXCLUDED.channel_name IS NOT NULL 
           AND EXCLUDED.channel_name != '' 
           AND EXCLUDED.channel_name != 'Unknown Channel'
           AND NOT EXCLUDED.channel_name LIKE 'Channel %'
      THEN EXCLUDED.channel_name 
      ELSE COALESCE(
        NULLIF(public.user_videos.channel_name, 'Unknown Channel'),
        EXCLUDED.channel_name
      )
    END;

  GET DIAGNOSTICS v_synced_count = ROW_COUNT;
  
  RETURN v_synced_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.sync_missed_videos_for_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_missed_videos_for_user(UUID) TO service_role;

-- 8. Recreate the trigger
DROP TRIGGER IF EXISTS trigger_auto_sync_video ON public.tracked_videos;
CREATE TRIGGER trigger_auto_sync_video
  AFTER INSERT ON public.tracked_videos
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_sync_video_to_users();

-- 9. Log how many were fixed
DO $$
DECLARE
  v_fixed_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_fixed_count 
  FROM public.user_videos 
  WHERE channel_name = 'Unknown Channel' OR channel_name IS NULL OR channel_name = '';
  
  RAISE NOTICE 'Remaining videos without proper channel name: %', v_fixed_count;
END $$;
