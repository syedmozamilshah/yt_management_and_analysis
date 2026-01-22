-- Migration: Comprehensive fix for upload_date and niche issues
-- This migration:
-- 1. Fixes the auto_sync trigger to log what's happening
-- 2. Updates user_videos with correct timestamps from tracked_videos
-- 3. Fixes niche for all videos based on channel settings

-- ===============================
-- 1. Create a debug function to check timestamp flow
-- ===============================
CREATE OR REPLACE FUNCTION public.debug_check_video_timestamps(p_limit INTEGER DEFAULT 10)
RETURNS TABLE (
  video_id TEXT,
  title TEXT,
  tracked_published_at TIMESTAMPTZ,
  tracked_created_at TIMESTAMPTZ,
  user_upload_date TEXT,
  user_created_at TIMESTAMPTZ,
  time_diff_tracked_seconds NUMERIC,
  is_timestamp_suspicious BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    tv.video_id,
    tv.title,
    tv.published_at as tracked_published_at,
    tv.created_at as tracked_created_at,
    uv.upload_date as user_upload_date,
    uv.created_at as user_created_at,
    ABS(EXTRACT(EPOCH FROM (tv.published_at - tv.created_at))) as time_diff_tracked_seconds,
    ABS(EXTRACT(EPOCH FROM (tv.published_at - tv.created_at))) < 300 as is_timestamp_suspicious
  FROM public.tracked_videos tv
  LEFT JOIN public.user_videos uv ON tv.video_id = uv.video_id
  ORDER BY tv.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.debug_check_video_timestamps TO authenticated;

-- ===============================
-- 2. Force update ALL user_videos.upload_date from tracked_videos.published_at
-- This ensures the timestamp matches what's in tracked_videos
-- ===============================
UPDATE public.user_videos uv
SET upload_date = to_char(tv.published_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
FROM public.tracked_videos tv
WHERE uv.video_id = tv.video_id
  AND tv.published_at IS NOT NULL;

-- ===============================
-- 3. Update the auto_sync_video_to_users trigger to ALWAYS use the exact published_at
-- ===============================
CREATE OR REPLACE FUNCTION public.auto_sync_video_to_users()
RETURNS TRIGGER AS $$
DECLARE
  v_channel_name TEXT;
  v_channel_subscribers INTEGER;
  v_niche TEXT;
  v_upload_date TEXT;
BEGIN
  -- CRITICAL: Convert published_at to ISO 8601 string immediately
  -- This ensures we preserve the exact YouTube upload time
  v_upload_date := to_char(NEW.published_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
  
  -- Log for debugging
  RAISE NOTICE 'auto_sync: video_id=%, published_at=%, upload_date=%', 
    NEW.video_id, NEW.published_at, v_upload_date;
  
  -- Get channel name from admin_global_channels first (most reliable)
  SELECT agc.channel_name, agc.channel_subscribers 
  INTO v_channel_name, v_channel_subscribers
  FROM public.admin_global_channels agc 
  WHERE agc.channel_id = NEW.channel_id
    AND agc.channel_name IS NOT NULL 
    AND agc.channel_name != ''
  LIMIT 1;
  
  -- Fallback to tracked_channels
  IF v_channel_name IS NULL OR v_channel_name = '' OR v_channel_name = 'Unknown Channel' THEN
    SELECT tc.channel_name, COALESCE(tc.channel_subscribers, 0)
    INTO v_channel_name, v_channel_subscribers
    FROM public.tracked_channels tc 
    WHERE tc.channel_id = NEW.channel_id 
      AND tc.channel_name IS NOT NULL 
      AND tc.channel_name != ''
    LIMIT 1;
  END IF;
  
  -- Use tracked_videos channel_name as last resort
  IF v_channel_name IS NULL OR v_channel_name = '' THEN
    v_channel_name := COALESCE(NEW.channel_name, 'Channel ' || SUBSTRING(NEW.channel_id FROM 1 FOR 8));
  END IF;

  -- Insert video for users who have this channel tracked
  INSERT INTO public.user_videos (
    user_id,
    title,
    youtube_url,
    video_id,
    thumbnail_url,
    channel_name,
    channel_subscribers,
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
    COALESCE(
      v_channel_subscribers,
      (SELECT agc2.channel_subscribers FROM public.admin_global_channels agc2 WHERE agc2.channel_id = NEW.channel_id LIMIT 1),
      (SELECT tc2.channel_subscribers FROM public.tracked_channels tc2 WHERE tc2.channel_id = NEW.channel_id AND tc2.channel_subscribers > 0 LIMIT 1),
      0
    ),
    v_upload_date,  -- Use the converted timestamp string
    COALESCE(NEW.view_count, 0),
    -- Get niche: prefer user subscription, then agc, then 'Uncategorized'
    COALESCE(
      (SELECT ucs.niche FROM public.user_channel_subscriptions ucs 
       WHERE ucs.user_id = tc.user_id AND ucs.channel_id = NEW.channel_id 
       AND ucs.niche IS NOT NULL AND ucs.niche != '' AND ucs.niche != 'Uncategorized'
       LIMIT 1),
      (SELECT agc3.niche FROM public.admin_global_channels agc3 
       WHERE agc3.channel_id = NEW.channel_id 
       AND agc3.niche IS NOT NULL AND agc3.niche != '' AND agc3.niche != 'Uncategorized'
       LIMIT 1),
      'Uncategorized'
    ),
    NEW.channel_id,
    now()
  FROM public.tracked_channels tc
  LEFT JOIN public.user_activity ua ON ua.user_id = tc.user_id
  WHERE tc.channel_id = NEW.channel_id
    AND tc.is_active = true
    AND (
      ua.last_ideation_opened_at IS NULL 
      OR ua.last_ideation_opened_at > (now() - INTERVAL '72 hours')
    )
  ON CONFLICT (user_id, video_id) DO UPDATE SET
    view_count = GREATEST(user_videos.view_count, EXCLUDED.view_count),
    -- ALWAYS update upload_date to ensure correct timestamp
    upload_date = EXCLUDED.upload_date,
    channel_name = CASE 
      WHEN user_videos.channel_name IS NULL OR user_videos.channel_name = '' OR user_videos.channel_name = 'Unknown Channel'
      THEN EXCLUDED.channel_name 
      ELSE user_videos.channel_name 
    END,
    channel_subscribers = CASE
      WHEN user_videos.channel_subscribers IS NULL OR user_videos.channel_subscribers = 0
      THEN EXCLUDED.channel_subscribers
      ELSE user_videos.channel_subscribers
    END,
    niche = CASE
      WHEN user_videos.niche IS NULL OR user_videos.niche = '' OR user_videos.niche = 'Uncategorized'
      THEN EXCLUDED.niche
      ELSE user_videos.niche
    END;
    
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===============================
-- 4. Fix niche for all videos - get from admin_global_channels
-- ===============================
UPDATE public.user_videos uv
SET niche = agc.niche
FROM public.admin_global_channels agc
WHERE uv.channel_id = agc.channel_id
  AND agc.niche IS NOT NULL
  AND agc.niche != ''
  AND agc.niche != 'Uncategorized'
  AND (uv.niche IS NULL OR uv.niche = '' OR uv.niche = 'Uncategorized');

-- ===============================
-- 5. Create function to manually fix a specific channel's videos
-- ===============================
CREATE OR REPLACE FUNCTION public.fix_channel_niche(p_channel_id TEXT, p_niche TEXT)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE public.user_videos
  SET niche = p_niche
  WHERE channel_id = p_channel_id;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  -- Also update admin_global_channels if exists
  UPDATE public.admin_global_channels
  SET niche = p_niche
  WHERE channel_id = p_channel_id;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.fix_channel_niche TO authenticated;
GRANT EXECUTE ON FUNCTION public.fix_channel_niche TO service_role;

-- ===============================
-- 6. Update refresh_user_video_metadata to also fix timestamps
-- ===============================
CREATE OR REPLACE FUNCTION public.refresh_user_video_metadata(p_user_id UUID DEFAULT NULL)
RETURNS INTEGER AS $$
DECLARE
  v_updated_count INTEGER := 0;
BEGIN
  -- Fix upload_date from tracked_videos
  UPDATE public.user_videos uv
  SET upload_date = to_char(tv.published_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
  FROM public.tracked_videos tv
  WHERE uv.video_id = tv.video_id
    AND (p_user_id IS NULL OR uv.user_id = p_user_id)
    AND tv.published_at IS NOT NULL;
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  -- Update channel_subscribers
  UPDATE public.user_videos uv
  SET channel_subscribers = COALESCE(
    (SELECT agc.channel_subscribers FROM public.admin_global_channels agc WHERE agc.channel_id = uv.channel_id AND agc.channel_subscribers > 0 LIMIT 1),
    (SELECT tc.channel_subscribers FROM public.tracked_channels tc WHERE tc.channel_id = uv.channel_id AND tc.user_id = uv.user_id AND tc.channel_subscribers > 0 LIMIT 1),
    uv.channel_subscribers
  )
  WHERE (p_user_id IS NULL OR uv.user_id = p_user_id)
    AND (uv.channel_subscribers IS NULL OR uv.channel_subscribers = 0);
  
  -- Update niche
  UPDATE public.user_videos uv
  SET niche = COALESCE(
    (SELECT ucs.niche FROM public.user_channel_subscriptions ucs 
     WHERE ucs.channel_id = uv.channel_id AND ucs.user_id = uv.user_id 
     AND ucs.niche IS NOT NULL AND ucs.niche != '' AND ucs.niche != 'Uncategorized'
     LIMIT 1),
    (SELECT agc.niche FROM public.admin_global_channels agc 
     WHERE agc.channel_id = uv.channel_id 
     AND agc.niche IS NOT NULL AND agc.niche != '' AND agc.niche != 'Uncategorized'
     LIMIT 1),
    uv.niche
  )
  WHERE (p_user_id IS NULL OR uv.user_id = p_user_id)
    AND (uv.niche IS NULL OR uv.niche = '' OR uv.niche = 'Uncategorized');
  
  -- Update channel_name if missing
  UPDATE public.user_videos uv
  SET channel_name = COALESCE(
    (SELECT agc.channel_name FROM public.admin_global_channels agc 
     WHERE agc.channel_id = uv.channel_id AND agc.channel_name IS NOT NULL AND agc.channel_name != '' AND agc.channel_name != 'Unknown Channel'
     LIMIT 1),
    (SELECT tc.channel_name FROM public.tracked_channels tc 
     WHERE tc.channel_id = uv.channel_id AND tc.user_id = uv.user_id AND tc.channel_name IS NOT NULL AND tc.channel_name != '' AND tc.channel_name != 'Unknown Channel'
     LIMIT 1),
    uv.channel_name
  )
  WHERE (p_user_id IS NULL OR uv.user_id = p_user_id)
    AND (uv.channel_name IS NULL OR uv.channel_name = '' OR uv.channel_name = 'Unknown Channel');
  
  RETURN v_updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
