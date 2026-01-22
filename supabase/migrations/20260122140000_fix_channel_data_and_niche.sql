-- Migration: Fix channel_subscribers and niche for user_videos
-- This addresses:
-- 1. channel_subscribers showing 0
-- 2. niche showing "Uncategorized"
-- 3. Ensure upload_date is synced correctly

-- ===============================
-- 1. Update channel_subscribers from admin_global_channels
-- ===============================
UPDATE public.user_videos uv
SET channel_subscribers = agc.channel_subscribers
FROM public.admin_global_channels agc
WHERE uv.channel_id = agc.channel_id
  AND agc.channel_subscribers IS NOT NULL
  AND agc.channel_subscribers > 0
  AND (uv.channel_subscribers IS NULL OR uv.channel_subscribers = 0);

-- ===============================
-- 2. Update channel_subscribers from tracked_channels  
-- ===============================
UPDATE public.user_videos uv
SET channel_subscribers = tc.channel_subscribers
FROM public.tracked_channels tc
WHERE uv.channel_id = tc.channel_id
  AND uv.user_id = tc.user_id
  AND tc.channel_subscribers IS NOT NULL
  AND tc.channel_subscribers > 0
  AND (uv.channel_subscribers IS NULL OR uv.channel_subscribers = 0);

-- ===============================
-- 3. Update niche from user_channel_subscriptions (user preference)
-- ===============================
UPDATE public.user_videos uv
SET niche = ucs.niche
FROM public.user_channel_subscriptions ucs
WHERE uv.channel_id = ucs.channel_id
  AND uv.user_id = ucs.user_id
  AND ucs.niche IS NOT NULL
  AND ucs.niche != ''
  AND ucs.niche != 'Uncategorized'
  AND (uv.niche IS NULL OR uv.niche = '' OR uv.niche = 'Uncategorized');

-- ===============================
-- 4. Update niche from admin_global_channels (fallback)
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
-- 5. Update channel_name from tracked_channels if missing
-- ===============================
UPDATE public.user_videos uv
SET channel_name = tc.channel_name
FROM public.tracked_channels tc
WHERE uv.channel_id = tc.channel_id
  AND uv.user_id = tc.user_id
  AND tc.channel_name IS NOT NULL
  AND tc.channel_name != ''
  AND tc.channel_name != 'Unknown Channel'
  AND (uv.channel_name IS NULL OR uv.channel_name = '' OR uv.channel_name = 'Unknown Channel');

-- ===============================
-- 6. Update channel_name from admin_global_channels if still missing
-- ===============================
UPDATE public.user_videos uv
SET channel_name = agc.channel_name
FROM public.admin_global_channels agc
WHERE uv.channel_id = agc.channel_id
  AND agc.channel_name IS NOT NULL
  AND agc.channel_name != ''
  AND agc.channel_name != 'Unknown Channel'
  AND (uv.channel_name IS NULL OR uv.channel_name = '' OR uv.channel_name = 'Unknown Channel');

-- ===============================
-- 7. Update tracked_channels with correct subscriber counts from admin_global_channels
-- ===============================
UPDATE public.tracked_channels tc
SET channel_subscribers = agc.channel_subscribers
FROM public.admin_global_channels agc
WHERE tc.channel_id = agc.channel_id
  AND agc.channel_subscribers IS NOT NULL
  AND agc.channel_subscribers > 0
  AND (tc.channel_subscribers IS NULL OR tc.channel_subscribers = 0);

-- ===============================
-- 8. Improved auto_sync function to correctly get all channel metadata
-- ===============================
CREATE OR REPLACE FUNCTION public.auto_sync_video_to_users()
RETURNS TRIGGER AS $$
DECLARE
  v_channel_name TEXT;
  v_channel_subscribers INTEGER;
  v_niche TEXT;
BEGIN
  -- Get channel name
  v_channel_name := NEW.channel_name;
  
  -- Try to get channel info from admin_global_channels first (most reliable source)
  IF v_channel_name IS NULL OR v_channel_name = '' OR v_channel_name = 'Unknown Channel' OR v_channel_subscribers IS NULL OR v_channel_subscribers = 0 THEN
    SELECT agc.channel_name, agc.channel_subscribers 
    INTO v_channel_name, v_channel_subscribers
    FROM public.admin_global_channels agc 
    WHERE agc.channel_id = NEW.channel_id
      AND agc.channel_name IS NOT NULL 
      AND agc.channel_name != ''
    LIMIT 1;
  END IF;
  
  -- Fallback to tracked_channels
  IF v_channel_name IS NULL OR v_channel_name = '' OR v_channel_name = 'Unknown Channel' THEN
    SELECT tc.channel_name, tc.channel_subscribers 
    INTO v_channel_name, v_channel_subscribers
    FROM public.tracked_channels tc 
    WHERE tc.channel_id = NEW.channel_id 
      AND tc.channel_name IS NOT NULL 
      AND tc.channel_name != ''
    LIMIT 1;
  END IF;
  
  -- Last resort: Use what we have from tracked_videos
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
    -- Get subscribers: prefer agc, then tc, then 0
    COALESCE(
      v_channel_subscribers,
      (SELECT agc.channel_subscribers FROM public.admin_global_channels agc WHERE agc.channel_id = NEW.channel_id LIMIT 1),
      (SELECT tc2.channel_subscribers FROM public.tracked_channels tc2 WHERE tc2.channel_id = NEW.channel_id AND tc2.channel_subscribers > 0 LIMIT 1),
      0
    ),
    NEW.published_at::text,  -- Preserve exact timestamp as text
    COALESCE(NEW.view_count, 0),
    -- Get niche: prefer user subscription, then agc, then 'Uncategorized'
    COALESCE(
      (SELECT ucs.niche FROM public.user_channel_subscriptions ucs 
       WHERE ucs.user_id = tc.user_id AND ucs.channel_id = NEW.channel_id 
       AND ucs.niche IS NOT NULL AND ucs.niche != '' AND ucs.niche != 'Uncategorized'
       LIMIT 1),
      (SELECT agc.niche FROM public.admin_global_channels agc 
       WHERE agc.channel_id = NEW.channel_id 
       AND agc.niche IS NOT NULL AND agc.niche != '' AND agc.niche != 'Uncategorized'
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
    upload_date = COALESCE(EXCLUDED.upload_date, user_videos.upload_date),
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
-- 9. Create RPC function to manually refresh video metadata
-- ===============================
CREATE OR REPLACE FUNCTION public.refresh_user_video_metadata(p_user_id UUID DEFAULT NULL)
RETURNS INTEGER AS $$
DECLARE
  v_updated_count INTEGER := 0;
BEGIN
  -- Update channel_subscribers
  UPDATE public.user_videos uv
  SET channel_subscribers = COALESCE(
    (SELECT agc.channel_subscribers FROM public.admin_global_channels agc WHERE agc.channel_id = uv.channel_id AND agc.channel_subscribers > 0 LIMIT 1),
    (SELECT tc.channel_subscribers FROM public.tracked_channels tc WHERE tc.channel_id = uv.channel_id AND tc.user_id = uv.user_id AND tc.channel_subscribers > 0 LIMIT 1),
    uv.channel_subscribers
  )
  WHERE (p_user_id IS NULL OR uv.user_id = p_user_id)
    AND (uv.channel_subscribers IS NULL OR uv.channel_subscribers = 0);
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
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
  
  -- Update upload_date from tracked_videos if missing or incorrect
  UPDATE public.user_videos uv
  SET upload_date = tv.published_at::text
  FROM public.tracked_videos tv
  WHERE uv.video_id = tv.video_id
    AND (p_user_id IS NULL OR uv.user_id = p_user_id)
    AND tv.published_at IS NOT NULL;
  
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

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.refresh_user_video_metadata TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_user_video_metadata TO service_role;
