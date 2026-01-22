-- Migration: Fix duplicate videos and ensure data integrity
-- Issues being fixed:
-- 1. Duplicate videos with same video_id but different data
-- 2. Videos with 0 view counts when they should have actual counts
-- 3. Clean up any data inconsistencies

-- ===============================
-- 1. Check for and log duplicates before fixing
-- ===============================
DO $$
DECLARE
  dup_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO dup_count
  FROM (
    SELECT user_id, video_id, COUNT(*)
    FROM public.user_videos
    GROUP BY user_id, video_id
    HAVING COUNT(*) > 1
  ) dups;
  
  RAISE NOTICE 'Found % duplicate video entries', dup_count;
END $$;

-- ===============================
-- 2. Remove duplicates keeping the one with highest view_count
-- First, create a temp table with the IDs to keep
-- ===============================
CREATE TEMP TABLE videos_to_keep AS
SELECT DISTINCT ON (user_id, video_id) id
FROM public.user_videos
ORDER BY user_id, video_id, view_count DESC NULLS LAST, created_at DESC;

-- Delete duplicates (keep only the best version)
DELETE FROM public.user_videos
WHERE id NOT IN (SELECT id FROM videos_to_keep);

DROP TABLE videos_to_keep;

-- ===============================
-- 3. Update videos with 0 view counts from tracked_videos
-- ===============================
UPDATE public.user_videos uv
SET view_count = tv.view_count
FROM public.tracked_videos tv
WHERE uv.video_id = tv.video_id
  AND tv.view_count IS NOT NULL
  AND tv.view_count > 0
  AND (uv.view_count IS NULL OR uv.view_count = 0);

-- ===============================
-- 4. Ensure unique constraint exists on (user_id, video_id)
-- ===============================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'user_videos_user_id_video_id_key'
  ) THEN
    ALTER TABLE public.user_videos 
    ADD CONSTRAINT user_videos_user_id_video_id_key UNIQUE (user_id, video_id);
  END IF;
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Constraint already exists';
END $$;

-- ===============================
-- 5. Fix auto_sync function to always use UPSERT properly
-- with better view count handling
-- ===============================
CREATE OR REPLACE FUNCTION public.auto_sync_video_to_users()
RETURNS TRIGGER AS $$
DECLARE
  v_channel_name TEXT;
  v_channel_subscribers INTEGER;
  v_upload_date TEXT;
BEGIN
  -- CRITICAL: Convert published_at to ISO 8601 string immediately
  v_upload_date := to_char(NEW.published_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
  
  -- Get channel info from admin_global_channels first
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
  -- CRITICAL: Use INSERT ... ON CONFLICT to prevent duplicates
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
      0
    ),
    v_upload_date,
    COALESCE(NEW.view_count, 0),
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
    -- Only update view_count if new value is higher (videos get more views over time)
    view_count = GREATEST(COALESCE(user_videos.view_count, 0), COALESCE(EXCLUDED.view_count, 0)),
    -- Always keep the correct upload_date from RSS
    upload_date = EXCLUDED.upload_date,
    -- Update channel info if missing
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
-- 6. Update sync_missed_videos_for_user to also prevent duplicates
-- ===============================
CREATE OR REPLACE FUNCTION public.sync_missed_videos_for_user(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_synced_count INTEGER := 0;
  v_channel RECORD;
  v_video RECORD;
BEGIN
  -- Loop through user's tracked channels
  FOR v_channel IN
    SELECT tc.channel_id, tc.channel_name, tc.channel_subscribers,
           COALESCE(
             (SELECT ucs.niche FROM public.user_channel_subscriptions ucs 
              WHERE ucs.user_id = p_user_id AND ucs.channel_id = tc.channel_id 
              AND ucs.niche IS NOT NULL AND ucs.niche != '' LIMIT 1),
             (SELECT agc.niche FROM public.admin_global_channels agc 
              WHERE agc.channel_id = tc.channel_id 
              AND agc.niche IS NOT NULL AND agc.niche != '' LIMIT 1),
             'Uncategorized'
           ) as niche
    FROM public.tracked_channels tc
    WHERE tc.user_id = p_user_id AND tc.is_active = true
  LOOP
    -- Sync recent videos (last 7 days) that user doesn't have
    FOR v_video IN
      SELECT tv.*
      FROM public.tracked_videos tv
      WHERE tv.channel_id = v_channel.channel_id
        AND tv.created_at > (now() - INTERVAL '7 days')
        AND NOT EXISTS (
          SELECT 1 FROM public.user_videos uv 
          WHERE uv.user_id = p_user_id AND uv.video_id = tv.video_id
        )
    LOOP
      INSERT INTO public.user_videos (
        user_id, title, youtube_url, video_id, thumbnail_url,
        channel_name, channel_subscribers, upload_date, view_count,
        niche, channel_id, created_at
      ) VALUES (
        p_user_id,
        v_video.title,
        COALESCE(v_video.youtube_url, 'https://www.youtube.com/watch?v=' || v_video.video_id),
        v_video.video_id,
        COALESCE(v_video.thumbnail_url, 'https://i.ytimg.com/vi/' || v_video.video_id || '/hqdefault.jpg'),
        v_channel.channel_name,
        v_channel.channel_subscribers,
        to_char(v_video.published_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        COALESCE(v_video.view_count, 0),
        v_channel.niche,
        v_channel.channel_id,
        now()
      )
      ON CONFLICT (user_id, video_id) DO UPDATE SET
        view_count = GREATEST(COALESCE(user_videos.view_count, 0), COALESCE(EXCLUDED.view_count, 0)),
        upload_date = EXCLUDED.upload_date;
      
      v_synced_count := v_synced_count + 1;
    END LOOP;
  END LOOP;
  
  RETURN v_synced_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===============================
-- 7. Ensure tracked_videos also has unique constraint
-- ===============================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'tracked_videos_video_id_key'
  ) THEN
    -- First remove any duplicates in tracked_videos
    DELETE FROM public.tracked_videos a USING public.tracked_videos b
    WHERE a.id > b.id AND a.video_id = b.video_id;
    
    -- Then add the constraint
    ALTER TABLE public.tracked_videos 
    ADD CONSTRAINT tracked_videos_video_id_key UNIQUE (video_id);
  END IF;
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'tracked_videos constraint already exists';
END $$;

-- ===============================
-- 8. Log the cleanup results
-- ===============================
DO $$
DECLARE
  remaining_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO remaining_count FROM public.user_videos;
  RAISE NOTICE 'Cleanup complete. Total user_videos: %', remaining_count;
END $$;
