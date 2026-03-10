-- ============================================
-- Comprehensive Fix: Sync All Videos to Ideation (v2)
-- ============================================
-- Problem: New videos are not being added to ideation immediately
-- Root causes identified:
--   1. The trigger_auto_sync_video fires AFTER INSERT on tracked_videos but may silently fail
--      (exception handler swallows errors and returns NEW anyway)
--   2. tracked_channels.tab_type may be NULL → videos end up with wrong tab
--   3. user_videos.upload_date is TEXT (not DATE) → casting published_at::date loses timezone info
--   4. No RLS bypass for service_role inserts into user_videos (trigger runs as SECURITY DEFINER 
--      but still needs to insert for OTHER users)
--   5. The ON CONFLICT SET updated_at=now() references a column that may not exist
--   6. No safety net cron running frequently enough
--
-- Solution: 
--   a) Fix all column type mismatches in trigger
--   b) Ensure tab_type defaults to 'ideation' for all personal channels
--   c) Add robust safety-net cron
--   d) Add subscription trigger for backfilling
-- ============================================

-- ==============================================
-- 0. Ensure required columns exist on user_videos
-- ==============================================
DO $$
BEGIN
  -- Ensure updated_at column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_videos' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.user_videos ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();
  END IF;

  -- Ensure tab_type column exists  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_videos' AND column_name = 'tab_type'
  ) THEN
    ALTER TABLE public.user_videos ADD COLUMN tab_type TEXT DEFAULT 'ideation';
  END IF;

  -- Ensure channel_id column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_videos' AND column_name = 'channel_id'
  ) THEN
    ALTER TABLE public.user_videos ADD COLUMN channel_id TEXT;
  END IF;

  -- Ensure is_global column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_videos' AND column_name = 'is_global'
  ) THEN
    ALTER TABLE public.user_videos ADD COLUMN is_global BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Fix any tracked_channels with NULL tab_type → default to 'ideation'
UPDATE public.tracked_channels
SET tab_type = 'ideation'
WHERE (tab_type IS NULL OR tab_type = '')
  AND (is_global IS NULL OR is_global = false);

-- ==============================================
-- 1. Improved auto_sync_video_to_users trigger function
--    Key fixes:
--    - upload_date is TEXT, so cast published_at to TEXT properly
--    - Always default tab_type to 'ideation' for non-global channels
--    - Proper error logging
-- ==============================================
CREATE OR REPLACE FUNCTION public.auto_sync_video_to_users()
RETURNS TRIGGER AS $$
DECLARE
  v_channel_name TEXT;
  v_user_count INT := 0;
BEGIN
  -- Get channel name from multiple sources
  v_channel_name := NULLIF(TRIM(COALESCE(NEW.channel_name, '')), '');
  
  IF v_channel_name IS NULL OR v_channel_name = 'Unknown Channel' THEN
    SELECT tc.channel_name INTO v_channel_name
    FROM public.tracked_channels tc 
    WHERE tc.channel_id = NEW.channel_id 
      AND tc.channel_name IS NOT NULL 
      AND tc.channel_name != ''
      AND tc.channel_name != 'Unknown Channel'
    LIMIT 1;
  END IF;
  
  IF v_channel_name IS NULL THEN
    SELECT agc.channel_name INTO v_channel_name
    FROM public.admin_global_channels agc 
    WHERE agc.channel_id = NEW.channel_id
      AND agc.channel_name IS NOT NULL 
      AND agc.channel_name != ''
    LIMIT 1;
  END IF;
  
  IF v_channel_name IS NULL THEN
    v_channel_name := 'Channel ' || SUBSTRING(NEW.channel_id FROM 1 FOR 8);
  END IF;

  -- Insert video for ALL ACTIVE users who have this channel tracked
  -- upload_date is TEXT in user_videos, so format as YYYY-MM-DD text
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
  SELECT
    tc.user_id,
    NEW.title,
    COALESCE(NEW.youtube_url, 'https://www.youtube.com/watch?v=' || NEW.video_id),
    NEW.video_id,
    COALESCE(NEW.thumbnail_url, 'https://i.ytimg.com/vi/' || NEW.video_id || '/hqdefault.jpg'),
    v_channel_name,
    -- upload_date is TEXT column, so convert properly
    COALESCE(to_char(NEW.published_at, 'YYYY-MM-DD'), to_char(now(), 'YYYY-MM-DD')),
    COALESCE(NEW.view_count, 0),
    COALESCE(
      (SELECT ucs.niche FROM public.user_channel_subscriptions ucs 
       WHERE ucs.user_id = tc.user_id AND ucs.channel_id = NEW.channel_id LIMIT 1),
      tc.niche,
      (SELECT agc.niche FROM public.admin_global_channels agc 
       WHERE agc.channel_id = NEW.channel_id LIMIT 1),
      'Uncategorized'
    ),
    NEW.channel_id,
    now(),
    COALESCE(NULLIF(tc.tab_type, ''), 'ideation'),
    COALESCE(tc.is_global, false)
  FROM public.tracked_channels tc
  WHERE tc.channel_id = NEW.channel_id
    AND tc.is_active = true
  ON CONFLICT (user_id, video_id) DO UPDATE SET
    view_count = GREATEST(EXCLUDED.view_count, public.user_videos.view_count),
    tab_type = COALESCE(NULLIF(EXCLUDED.tab_type, ''), public.user_videos.tab_type, 'ideation'),
    is_global = EXCLUDED.is_global,
    channel_name = CASE 
      WHEN EXCLUDED.channel_name IS NOT NULL 
           AND EXCLUDED.channel_name != '' 
           AND EXCLUDED.channel_name != 'Unknown Channel'
      THEN EXCLUDED.channel_name 
      ELSE COALESCE(NULLIF(public.user_videos.channel_name, ''), EXCLUDED.channel_name)
    END;

  GET DIAGNOSTICS v_user_count = ROW_COUNT;
  
  IF v_user_count = 0 THEN
    RAISE WARNING '[auto_sync] Video % from channel % matched 0 users — check tracked_channels', NEW.video_id, NEW.channel_id;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error with full detail so we can diagnose
  RAISE WARNING '[auto_sync] FAILED for video %: % (SQLSTATE %)', NEW.video_id, SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS trigger_auto_sync_video ON public.tracked_videos;
CREATE TRIGGER trigger_auto_sync_video
  AFTER INSERT ON public.tracked_videos
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_sync_video_to_users();

-- ==============================================
-- 2. Comprehensive sync function for missed videos
--    Key fix: upload_date is TEXT, not DATE
-- ============================================= 
CREATE OR REPLACE FUNCTION public.sync_all_tracked_videos_to_users()
RETURNS TABLE (
  total_tracked_videos BIGINT,
  total_users_affected BIGINT,
  videos_synced BIGINT,
  duration_seconds NUMERIC
) AS $$
DECLARE
  v_start_time TIMESTAMP;
  v_total_synced BIGINT;
  v_total_tracked BIGINT;
  v_total_users BIGINT;
BEGIN
  v_start_time := now();
  
  SELECT COUNT(*) INTO v_total_tracked FROM public.tracked_videos;
  SELECT COUNT(DISTINCT user_id) INTO v_total_users FROM public.tracked_channels WHERE is_active = true;
  
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
  SELECT
    tc.user_id,
    tv.title,
    COALESCE(tv.youtube_url, 'https://www.youtube.com/watch?v=' || tv.video_id),
    tv.video_id,
    COALESCE(tv.thumbnail_url, 'https://i.ytimg.com/vi/' || tv.video_id || '/hqdefault.jpg'),
    COALESCE(
      NULLIF(tv.channel_name, ''),
      (SELECT tc2.channel_name FROM public.tracked_channels tc2
       WHERE tc2.channel_id = tv.channel_id AND tc2.channel_name IS NOT NULL AND tc2.channel_name != '' LIMIT 1),
      (SELECT agc.channel_name FROM public.admin_global_channels agc
       WHERE agc.channel_id = tv.channel_id AND agc.channel_name IS NOT NULL AND agc.channel_name != '' LIMIT 1),
      'Unknown Channel'
    ),
    -- upload_date is TEXT column
    COALESCE(to_char(tv.published_at, 'YYYY-MM-DD'), to_char(now(), 'YYYY-MM-DD')),
    COALESCE(tv.view_count, 0),
    COALESCE(
      (SELECT ucs.niche FROM public.user_channel_subscriptions ucs
       WHERE ucs.user_id = tc.user_id AND ucs.channel_id = tv.channel_id LIMIT 1),
      tc.niche,
      (SELECT agc.niche FROM public.admin_global_channels agc
       WHERE agc.channel_id = tv.channel_id LIMIT 1),
      'Uncategorized'
    ),
    tv.channel_id,
    now(),
    COALESCE(NULLIF(tc.tab_type, ''), 'ideation'),
    COALESCE(tc.is_global, false)
  FROM public.tracked_videos tv
  INNER JOIN public.tracked_channels tc
    ON tc.channel_id = tv.channel_id
    AND tc.is_active = true
  WHERE NOT EXISTS (
    SELECT 1 FROM public.user_videos uv
    WHERE uv.user_id = tc.user_id AND uv.video_id = tv.video_id
  )
  ON CONFLICT (user_id, video_id) DO UPDATE SET
    view_count = GREATEST(EXCLUDED.view_count, public.user_videos.view_count),
    tab_type = COALESCE(NULLIF(EXCLUDED.tab_type, ''), public.user_videos.tab_type, 'ideation'),
    is_global = EXCLUDED.is_global;

  GET DIAGNOSTICS v_total_synced = ROW_COUNT;
  
  -- Also update view counts from tracked_videos → user_videos
  UPDATE public.user_videos uv
  SET view_count = tv.view_count
  FROM public.tracked_videos tv
  WHERE uv.video_id = tv.video_id
    AND tv.view_count IS NOT NULL
    AND tv.view_count > COALESCE(uv.view_count, 0);

  RETURN QUERY SELECT 
    v_total_tracked,
    v_total_users,
    v_total_synced,
    ROUND(extract(EPOCH FROM (now() - v_start_time))::NUMERIC, 2);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.sync_all_tracked_videos_to_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_all_tracked_videos_to_users() TO service_role;

-- ==============================================
-- 3. Run initial sync NOW
-- ==============================================
DO $$
DECLARE
  v_total_tracked BIGINT;
  v_total_users BIGINT;
  v_videos_synced BIGINT;
  v_duration NUMERIC;
BEGIN
  SELECT total_tracked_videos, total_users_affected, videos_synced, duration_seconds
  INTO v_total_tracked, v_total_users, v_videos_synced, v_duration
  FROM public.sync_all_tracked_videos_to_users();
  
  RAISE NOTICE '=== INITIAL SYNC COMPLETE ===';
  RAISE NOTICE 'Total tracked videos: %', v_total_tracked;
  RAISE NOTICE 'Total users affected: %', v_total_users;
  RAISE NOTICE 'Videos synced: %', v_videos_synced;
  RAISE NOTICE 'Duration: % seconds', v_duration;
END $$;

-- ==============================================
-- 4. Set up automatic sync every 10 minutes as safety net
-- ==============================================
DO $$
BEGIN
  PERFORM cron.unschedule('sync-missed-videos-safety-net');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'sync-missed-videos-safety-net',
  '*/10 * * * *',
  $$
    SELECT public.sync_all_tracked_videos_to_users();
  $$
);

-- ==============================================
-- 5. Add trigger to sync existing videos when channel is tracked/reactivated
-- ==============================================
CREATE OR REPLACE FUNCTION public.sync_channel_videos_on_subscription()
RETURNS TRIGGER AS $$
DECLARE
  v_niche TEXT;
BEGIN
  IF NEW.is_active = true THEN
    -- Resolve niche safely
    v_niche := COALESCE(
      (SELECT ucs.niche FROM public.user_channel_subscriptions ucs
       WHERE ucs.user_id = NEW.user_id AND ucs.channel_id = NEW.channel_id LIMIT 1),
      NEW.niche,
      (SELECT agc.niche FROM public.admin_global_channels agc
       WHERE agc.channel_id = NEW.channel_id LIMIT 1),
      'Uncategorized'
    );

    INSERT INTO public.user_videos (
      user_id, title, youtube_url, video_id, thumbnail_url, channel_name,
      upload_date, view_count, niche, channel_id, created_at, tab_type, is_global
    )
    SELECT
      NEW.user_id,
      tv.title,
      COALESCE(tv.youtube_url, 'https://www.youtube.com/watch?v=' || tv.video_id),
      tv.video_id,
      COALESCE(tv.thumbnail_url, 'https://i.ytimg.com/vi/' || tv.video_id || '/hqdefault.jpg'),
      COALESCE(NULLIF(tv.channel_name, ''), NEW.channel_name, 'Unknown Channel'),
      COALESCE(to_char(tv.published_at, 'YYYY-MM-DD'), to_char(now(), 'YYYY-MM-DD')),
      COALESCE(tv.view_count, 0),
      v_niche,
      NEW.channel_id,
      now(),
      COALESCE(NULLIF(NEW.tab_type, ''), 'ideation'),
      COALESCE(NEW.is_global, false)
    FROM public.tracked_videos tv
    WHERE tv.channel_id = NEW.channel_id
      AND NOT EXISTS (
        SELECT 1 FROM public.user_videos uv
        WHERE uv.user_id = NEW.user_id AND uv.video_id = tv.video_id
      )
    ON CONFLICT (user_id, video_id) DO NOTHING;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[subscription_sync] Error for channel %: %', NEW.channel_id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_sync_channel_videos_on_subscription ON public.tracked_channels;
CREATE TRIGGER trigger_sync_channel_videos_on_subscription
  AFTER INSERT OR UPDATE ON public.tracked_channels
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_channel_videos_on_subscription();

-- ==============================================
-- 6. Diagnostics — Run and check results
-- ==============================================
DO $$
DECLARE
  v_tracked_videos_total INT;
  v_tracked_channels_active INT;
  v_user_videos_ideation INT;
  v_user_videos_total INT;
  v_missing_per_user INT;
  v_channels_null_tab INT;
BEGIN
  SELECT COUNT(*) INTO v_tracked_videos_total FROM public.tracked_videos;
  SELECT COUNT(*) INTO v_tracked_channels_active FROM public.tracked_channels WHERE is_active = true;
  SELECT COUNT(*) INTO v_user_videos_ideation FROM public.user_videos WHERE tab_type = 'ideation';
  SELECT COUNT(*) INTO v_user_videos_total FROM public.user_videos;
  
  -- Count user+video pairs that SHOULD exist but DON'T
  SELECT COUNT(*) INTO v_missing_per_user
  FROM public.tracked_videos tv
  INNER JOIN public.tracked_channels tc ON tc.channel_id = tv.channel_id AND tc.is_active = true
  WHERE NOT EXISTS (
    SELECT 1 FROM public.user_videos uv
    WHERE uv.user_id = tc.user_id AND uv.video_id = tv.video_id
  );
  
  SELECT COUNT(*) INTO v_channels_null_tab
  FROM public.tracked_channels 
  WHERE is_active = true AND (tab_type IS NULL OR tab_type = '');
  
  RAISE NOTICE '';
  RAISE NOTICE '========== DIAGNOSTICS ==========';
  RAISE NOTICE 'Tracked videos (master):    %', v_tracked_videos_total;
  RAISE NOTICE 'Active tracked channels:    %', v_tracked_channels_active;
  RAISE NOTICE 'Channels with NULL tab:     %', v_channels_null_tab;
  RAISE NOTICE 'User videos (total):        %', v_user_videos_total;
  RAISE NOTICE 'User videos (ideation):     %', v_user_videos_ideation;
  RAISE NOTICE 'MISSING user-video pairs:   %', v_missing_per_user;
  RAISE NOTICE '=================================';
  RAISE NOTICE '';
  
  IF v_missing_per_user > 0 THEN
    RAISE WARNING '⚠ There are still % missing user-video pairs! Check tracked_channels JOIN.', v_missing_per_user;
  ELSE
    RAISE NOTICE '✓ All tracked videos are synced to all users. System is healthy.';
  END IF;
END $$;
