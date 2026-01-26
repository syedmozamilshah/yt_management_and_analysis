-- Migration: Fix tab_type syncing for new videos
-- When videos are auto-synced from tracked_videos to user_videos,
-- they should inherit the tab_type from tracked_channels or user_channel_subscriptions

-- 1. Update auto_sync_video_to_users to include tab_type
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
  -- CRITICAL: Include tab_type and is_global from tracked_channels
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
    -- Get tab_type from tracked_channels (inherits from where channel was added)
    COALESCE(tc.tab_type, 'usa'),
    -- Get is_global from tracked_channels
    COALESCE(tc.is_global, false)
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

-- 2. Update sync_missed_videos_for_user to include tab_type
CREATE OR REPLACE FUNCTION public.sync_missed_videos_for_user(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_synced_count INTEGER := 0;
BEGIN
  -- Update user activity first
  INSERT INTO public.user_activity (user_id, last_ideation_opened_at)
  VALUES (p_user_id, now())
  ON CONFLICT (user_id) DO UPDATE SET last_ideation_opened_at = now();

  -- Sync all videos from channels this user has tracked
  -- CRITICAL: Include tab_type and is_global from tracked_channels
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
  SELECT DISTINCT ON (p_user_id, tv.video_id)
    p_user_id,
    tv.title,
    COALESCE(tv.youtube_url, 'https://www.youtube.com/watch?v=' || tv.video_id),
    tv.video_id,
    COALESCE(tv.thumbnail_url, 'https://i.ytimg.com/vi/' || tv.video_id || '/hqdefault.jpg'),
    COALESCE(
      NULLIF(tv.channel_name, ''),
      (SELECT tc.channel_name FROM public.tracked_channels tc 
       WHERE tc.channel_id = tv.channel_id AND tc.channel_name IS NOT NULL LIMIT 1),
      (SELECT agc.channel_name FROM public.admin_global_channels agc 
       WHERE agc.channel_id = tv.channel_id AND agc.channel_name IS NOT NULL LIMIT 1),
      'Unknown Channel'
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
    now(),
    -- Get tab_type from tracked_channels for this user
    COALESCE(
      (SELECT tc.tab_type FROM public.tracked_channels tc 
       WHERE tc.user_id = p_user_id AND tc.channel_id = tv.channel_id LIMIT 1),
      'usa'
    ),
    -- Get is_global from tracked_channels for this user
    COALESCE(
      (SELECT tc.is_global FROM public.tracked_channels tc 
       WHERE tc.user_id = p_user_id AND tc.channel_id = tv.channel_id LIMIT 1),
      false
    )
  FROM public.tracked_videos tv
  INNER JOIN public.tracked_channels tc ON tc.channel_id = tv.channel_id AND tc.user_id = p_user_id
  WHERE tc.is_active = true
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
    END,
    tab_type = EXCLUDED.tab_type,
    is_global = EXCLUDED.is_global;

  GET DIAGNOSTICS v_synced_count = ROW_COUNT;
  
  RETURN v_synced_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Grant permissions
GRANT EXECUTE ON FUNCTION public.auto_sync_video_to_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.auto_sync_video_to_users() TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_missed_videos_for_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_missed_videos_for_user(UUID) TO service_role;

-- 4. Recreate the trigger
DROP TRIGGER IF EXISTS trigger_auto_sync_video ON public.tracked_videos;
CREATE TRIGGER trigger_auto_sync_video
  AFTER INSERT ON public.tracked_videos
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_sync_video_to_users();

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Migration complete: auto_sync_video_to_users and sync_missed_videos_for_user now include tab_type and is_global';
END $$;
