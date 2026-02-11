-- ============================================
-- Fix Ideation Video Sync
-- ============================================
-- Problem 1: Videos exist in tracked_videos but not appearing in user_videos
-- Problem 2: auto_subscribe_channel_from_video trigger uses ON CONFLICT (user_id, channel_id)
--   but the unique constraint is (user_id, channel_id, tab_type) → causes constraint error
-- 
-- IMPORTANT: For Ideation tab, ALL new videos from tracked channels should appear
-- The "views > subscribers" filter is ONLY for Title Generator's outlier search
-- Ideation = ALL videos from your tracked channels
-- Outliers = Videos where views > subscribers (used for Title Generator research)

-- ==============================================
-- 0. FIX the broken auto_subscribe trigger FIRST
-- ==============================================
-- The trigger was doing ON CONFLICT (user_id, channel_id) but unique constraint is (user_id, channel_id, tab_type)
CREATE OR REPLACE FUNCTION public.auto_subscribe_channel_from_video()
RETURNS TRIGGER AS $$
DECLARE
  v_channel_id TEXT;
  v_tab_type TEXT;
BEGIN
  -- Get channel_id from the inserted video row directly if available
  v_channel_id := NEW.channel_id;

  -- If channel_id is null, try to find it from tracked_videos
  IF v_channel_id IS NULL OR v_channel_id = '' THEN
    SELECT tv.channel_id INTO v_channel_id
    FROM public.tracked_videos tv
    WHERE tv.video_id = NEW.video_id
    LIMIT 1;
  END IF;

  -- If still not found, try from tracked_channels by channel_name
  IF v_channel_id IS NULL AND NEW.channel_name IS NOT NULL THEN
    SELECT tc.channel_id INTO v_channel_id
    FROM public.tracked_channels tc
    WHERE tc.channel_name = NEW.channel_name
    LIMIT 1;
  END IF;

  -- Determine tab_type from the video being inserted
  v_tab_type := COALESCE(NEW.tab_type, 'ideation');

  -- If we found a channel_id, create/update the subscription
  -- Use the correct unique constraint: (user_id, channel_id, tab_type)
  IF v_channel_id IS NOT NULL THEN
    INSERT INTO public.user_channel_subscriptions (user_id, channel_id, tab_type, niche, is_active, created_at, updated_at)
    VALUES (NEW.user_id, v_channel_id, v_tab_type, COALESCE(NEW.niche, 'General'), true, now(), now())
    ON CONFLICT (user_id, channel_id, tab_type) DO UPDATE SET
      is_active = true,
      updated_at = now();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
DROP TRIGGER IF EXISTS trigger_auto_subscribe_channel ON public.user_videos;
CREATE TRIGGER trigger_auto_subscribe_channel
  AFTER INSERT ON public.user_videos
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_subscribe_channel_from_video();

-- ==============================================
-- 1. Create force_sync_all_videos_for_user
-- ==============================================
CREATE OR REPLACE FUNCTION public.force_sync_all_videos_for_user(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_synced_count INTEGER := 0;
  v_channel_count INTEGER := 0;
  v_video_count INTEGER := 0;
BEGIN
  -- Update user activity first
  INSERT INTO public.user_activity (user_id, last_ideation_opened_at)
  VALUES (p_user_id, now())
  ON CONFLICT (user_id) DO UPDATE SET last_ideation_opened_at = now();

  -- Count channels for debugging
  SELECT COUNT(*) INTO v_channel_count
  FROM public.tracked_channels tc 
  WHERE tc.user_id = p_user_id AND tc.is_active = true;
  
  RAISE NOTICE 'User % has % active tracked channels', p_user_id, v_channel_count;

  -- Count videos available for sync
  SELECT COUNT(*) INTO v_video_count
  FROM public.tracked_videos tv
  INNER JOIN public.tracked_channels tc ON tc.channel_id = tv.channel_id AND tc.user_id = p_user_id
  WHERE tc.is_active = true;
  
  RAISE NOTICE 'Found % tracked videos to potentially sync for user %', v_video_count, p_user_id;

  -- Insert only videos that don't exist yet in user_videos
  INSERT INTO public.user_videos (
    user_id, title, youtube_url, video_id, thumbnail_url, channel_name,
    upload_date, view_count, niche, channel_id, created_at, tab_type, is_global
  )
  SELECT 
    p_user_id,
    tv.title,
    COALESCE(tv.youtube_url, 'https://www.youtube.com/watch?v=' || tv.video_id),
    tv.video_id,
    COALESCE(tv.thumbnail_url, 'https://i.ytimg.com/vi/' || tv.video_id || '/hqdefault.jpg'),
    COALESCE(
      NULLIF(tv.channel_name, ''),
      (SELECT tc2.channel_name FROM public.tracked_channels tc2 
       WHERE tc2.channel_id = tv.channel_id AND tc2.channel_name IS NOT NULL 
       AND tc2.channel_name != '' AND tc2.channel_name != 'Unknown Channel' LIMIT 1),
      (SELECT agc.channel_name FROM public.admin_global_channels agc 
       WHERE agc.channel_id = tv.channel_id AND agc.channel_name IS NOT NULL LIMIT 1),
      'Unknown Channel'
    ),
    COALESCE(tv.published_at::date, CURRENT_DATE),
    COALESCE(tv.view_count, 0),
    COALESCE(
      (SELECT ucs.niche FROM public.user_channel_subscriptions ucs 
       WHERE ucs.user_id = p_user_id AND ucs.channel_id = tv.channel_id LIMIT 1),
      (SELECT agc.niche FROM public.admin_global_channels agc 
       WHERE agc.channel_id = tv.channel_id LIMIT 1),
      'Uncategorized'
    ),
    tv.channel_id,
    COALESCE(tv.created_at, now()),
    COALESCE(
      (SELECT tc3.tab_type FROM public.tracked_channels tc3 
       WHERE tc3.user_id = p_user_id AND tc3.channel_id = tv.channel_id LIMIT 1),
      'ideation'
    ),
    COALESCE(
      (SELECT tc4.is_global FROM public.tracked_channels tc4 
       WHERE tc4.user_id = p_user_id AND tc4.channel_id = tv.channel_id LIMIT 1),
      false
    )
  FROM public.tracked_videos tv
  INNER JOIN public.tracked_channels tc ON tc.channel_id = tv.channel_id AND tc.user_id = p_user_id
  WHERE tc.is_active = true
    AND NOT EXISTS (
      SELECT 1 FROM public.user_videos uv 
      WHERE uv.user_id = p_user_id AND uv.video_id = tv.video_id
    );

  GET DIAGNOSTICS v_synced_count = ROW_COUNT;
  
  RAISE NOTICE 'Force sync completed for user %. New videos inserted: %', p_user_id, v_synced_count;
  
  RETURN v_synced_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.force_sync_all_videos_for_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.force_sync_all_videos_for_user(UUID) TO service_role;

-- ==============================================
-- 2. Update sync_missed_videos_for_user
-- ==============================================
CREATE OR REPLACE FUNCTION public.sync_missed_videos_for_user(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_synced_count INTEGER := 0;
  v_new_count INTEGER := 0;
  v_updated_count INTEGER := 0;
BEGIN
  -- Update user activity first
  INSERT INTO public.user_activity (user_id, last_ideation_opened_at)
  VALUES (p_user_id, now())
  ON CONFLICT (user_id) DO UPDATE SET last_ideation_opened_at = now();

  -- Insert NEW videos that don't exist yet
  INSERT INTO public.user_videos (
    user_id, title, youtube_url, video_id, thumbnail_url, channel_name,
    upload_date, view_count, niche, channel_id, created_at, tab_type, is_global
  )
  SELECT 
    p_user_id,
    tv.title,
    COALESCE(tv.youtube_url, 'https://www.youtube.com/watch?v=' || tv.video_id),
    tv.video_id,
    COALESCE(tv.thumbnail_url, 'https://i.ytimg.com/vi/' || tv.video_id || '/hqdefault.jpg'),
    COALESCE(
      NULLIF(tv.channel_name, ''),
      (SELECT tc2.channel_name FROM public.tracked_channels tc2 
       WHERE tc2.channel_id = tv.channel_id AND tc2.channel_name IS NOT NULL LIMIT 1),
      (SELECT agc.channel_name FROM public.admin_global_channels agc 
       WHERE agc.channel_id = tv.channel_id AND agc.channel_name IS NOT NULL LIMIT 1),
      'Unknown Channel'
    ),
    COALESCE(tv.published_at::date, CURRENT_DATE),
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
    COALESCE(
      (SELECT tc3.tab_type FROM public.tracked_channels tc3 
       WHERE tc3.user_id = p_user_id AND tc3.channel_id = tv.channel_id LIMIT 1),
      'ideation'
    ),
    COALESCE(
      (SELECT tc4.is_global FROM public.tracked_channels tc4 
       WHERE tc4.user_id = p_user_id AND tc4.channel_id = tv.channel_id LIMIT 1),
      false
    )
  FROM public.tracked_videos tv
  INNER JOIN public.tracked_channels tc ON tc.channel_id = tv.channel_id AND tc.user_id = p_user_id
  WHERE tc.is_active = true
    AND NOT EXISTS (
      SELECT 1 FROM public.user_videos uv 
      WHERE uv.user_id = p_user_id AND uv.video_id = tv.video_id
    );

  GET DIAGNOSTICS v_new_count = ROW_COUNT;
  
  -- Also fix existing videos that have wrong tab_type
  -- Note: Cannot reference UPDATE target 'uv' in FROM clause JOIN ON in PostgreSQL
  -- So we use separate FROM tables and move join conditions to WHERE
  UPDATE public.user_videos uv
  SET 
    tab_type = tc.tab_type,
    is_global = tc.is_global
  FROM public.tracked_channels tc
  WHERE uv.user_id = p_user_id
    AND tc.user_id = p_user_id
    AND tc.channel_id = uv.channel_id
    AND tc.is_active = true
    AND (
      uv.tab_type IS NULL 
      OR uv.tab_type = '' 
      OR uv.tab_type != tc.tab_type
    );
    
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  v_synced_count := v_new_count + v_updated_count;
  
  RETURN v_synced_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.sync_missed_videos_for_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_missed_videos_for_user(UUID) TO service_role;

-- ==============================================
-- 3. Backfill ALL tracked_videos → user_videos
-- ==============================================
-- Now that the trigger is fixed, inserts will work without constraint errors
DO $$
DECLARE
  v_user RECORD;
  v_synced INT;
  v_total_synced INT := 0;
BEGIN
  RAISE NOTICE 'Starting backfill of tracked_videos to user_videos for all users...';
  
  FOR v_user IN 
    SELECT DISTINCT tc.user_id 
    FROM public.tracked_channels tc 
    WHERE tc.is_active = true
  LOOP
    INSERT INTO public.user_videos (
      user_id, title, youtube_url, video_id, thumbnail_url, channel_name,
      upload_date, view_count, niche, channel_id, created_at, tab_type, is_global
    )
    SELECT 
      v_user.user_id,
      tv.title,
      COALESCE(tv.youtube_url, 'https://www.youtube.com/watch?v=' || tv.video_id),
      tv.video_id,
      COALESCE(tv.thumbnail_url, 'https://i.ytimg.com/vi/' || tv.video_id || '/hqdefault.jpg'),
      COALESCE(
        NULLIF(tv.channel_name, ''),
        (SELECT tc2.channel_name FROM public.tracked_channels tc2 
         WHERE tc2.channel_id = tv.channel_id AND tc2.channel_name IS NOT NULL LIMIT 1),
        'Unknown Channel'
      ),
      COALESCE(tv.published_at::date, CURRENT_DATE),
      COALESCE(tv.view_count, 0),
      COALESCE(
        (SELECT ucs.niche FROM public.user_channel_subscriptions ucs 
         WHERE ucs.user_id = v_user.user_id AND ucs.channel_id = tv.channel_id LIMIT 1),
        'Uncategorized'
      ),
      tv.channel_id,
      COALESCE(tv.created_at, now()),
      COALESCE(tc.tab_type, 'ideation'),
      COALESCE(tc.is_global, false)
    FROM public.tracked_videos tv
    INNER JOIN public.tracked_channels tc ON tc.channel_id = tv.channel_id AND tc.user_id = v_user.user_id
    WHERE tc.is_active = true
      AND NOT EXISTS (
        SELECT 1 FROM public.user_videos uv 
        WHERE uv.user_id = v_user.user_id AND uv.video_id = tv.video_id
      );
    
    GET DIAGNOSTICS v_synced = ROW_COUNT;
    v_total_synced := v_total_synced + v_synced;
    
    IF v_synced > 0 THEN
      RAISE NOTICE 'Synced % videos for user %', v_synced, v_user.user_id;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Backfill complete: Total % video-user pairs synced', v_total_synced;
END $$;

-- ==============================================
-- 4. Log migration info
-- ==============================================
DO $$
DECLARE
  v_tracked_videos INT;
  v_tracked_channels INT;
  v_user_videos INT;
BEGIN
  SELECT COUNT(*) INTO v_tracked_videos FROM public.tracked_videos;
  SELECT COUNT(DISTINCT channel_id) INTO v_tracked_channels FROM public.tracked_channels WHERE is_active = true;
  SELECT COUNT(*) INTO v_user_videos FROM public.user_videos;
  RAISE NOTICE 'Migration complete: % tracked videos across % channels, % total user_video entries', v_tracked_videos, v_tracked_channels, v_user_videos;
END $$;
