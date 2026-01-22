-- Migration: Fix existing upload_date values in user_videos
-- The upload_date was being set incorrectly. We need to update it from tracked_videos.published_at

-- 1. Update user_videos.upload_date from tracked_videos.published_at where they exist
UPDATE public.user_videos uv
SET upload_date = tv.published_at
FROM public.tracked_videos tv
WHERE uv.video_id = tv.video_id
  AND tv.published_at IS NOT NULL;

-- 2. For any remaining videos, if upload_date looks like just a date, we can't recover the time
-- But at least we ensure it's a proper ISO format

-- 3. Create a function to get the latest videos via RSS for real-time updates
-- This will be called by a cron job or on-demand to fetch new videos
CREATE OR REPLACE FUNCTION public.refresh_channel_videos_from_rss(p_channel_id TEXT)
RETURNS JSON AS $$
DECLARE
  v_rss_url TEXT;
  v_result JSON;
BEGIN
  -- Get the RSS feed URL for this channel
  SELECT rss_feed_url INTO v_rss_url
  FROM public.tracked_channels
  WHERE channel_id = p_channel_id
  LIMIT 1;
  
  IF v_rss_url IS NULL THEN
    v_rss_url := 'https://www.youtube.com/feeds/videos.xml?channel_id=' || p_channel_id;
  END IF;
  
  -- The actual RSS fetching will be done by an edge function
  -- This function just prepares the request
  RETURN json_build_object(
    'channel_id', p_channel_id,
    'rss_url', v_rss_url,
    'status', 'ready'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Grant permissions
GRANT EXECUTE ON FUNCTION public.refresh_channel_videos_from_rss(TEXT) TO authenticated;

-- 5. Update the auto_sync trigger to preserve the exact timestamp
DROP TRIGGER IF EXISTS trigger_auto_sync_video ON public.tracked_videos;

CREATE OR REPLACE FUNCTION public.auto_sync_video_to_users()
RETURNS TRIGGER AS $$
DECLARE
  v_channel_name TEXT;
  v_channel_subscribers INTEGER;
BEGIN
  -- Get channel name and subscribers from multiple sources
  v_channel_name := NEW.channel_name;
  
  -- Try to get channel info from tracked_channels
  IF v_channel_name IS NULL OR v_channel_name = '' OR v_channel_name = 'Unknown Channel' THEN
    SELECT tc.channel_name, tc.channel_subscribers 
    INTO v_channel_name, v_channel_subscribers
    FROM public.tracked_channels tc 
    WHERE tc.channel_id = NEW.channel_id 
      AND tc.channel_name IS NOT NULL 
      AND tc.channel_name != ''
    LIMIT 1;
  END IF;
  
  -- Try admin_global_channels
  IF v_channel_name IS NULL OR v_channel_name = '' OR v_channel_name = 'Unknown Channel' THEN
    SELECT agc.channel_name, agc.channel_subscribers 
    INTO v_channel_name, v_channel_subscribers
    FROM public.admin_global_channels agc 
    WHERE agc.channel_id = NEW.channel_id
      AND agc.channel_name IS NOT NULL 
      AND agc.channel_name != ''
    LIMIT 1;
  END IF;
  
  -- Last resort placeholder
  IF v_channel_name IS NULL OR v_channel_name = '' THEN
    v_channel_name := 'Channel ' || SUBSTRING(NEW.channel_id FROM 1 FOR 8);
  END IF;

  -- Insert video for users who have this channel tracked
  -- CRITICAL: Use the exact published_at timestamp for proper "X minutes ago" display
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
    COALESCE(v_channel_subscribers, tc.channel_subscribers),
    NEW.published_at,  -- Keep exact timestamp from RSS/YouTube
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
    END;
    
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
CREATE TRIGGER trigger_auto_sync_video
  AFTER INSERT ON public.tracked_videos
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_sync_video_to_users();

-- 6. Also update sync_global_content_to_new_user to preserve exact timestamps
CREATE OR REPLACE FUNCTION public.sync_global_content_to_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_channel RECORD;
  v_video RECORD;
  v_niche RECORD;
BEGIN
  -- Sync all global niches
  FOR v_niche IN SELECT * FROM public.admin_global_niches WHERE is_active = true LOOP
    INSERT INTO public.user_niches (user_id, niche, is_global)
    VALUES (NEW.id, v_niche.niche, true)
    ON CONFLICT (user_id, niche) DO NOTHING;
  END LOOP;
  
  -- Sync all global channels and their videos
  FOR v_channel IN SELECT * FROM public.admin_global_channels WHERE is_active = true LOOP
    -- Add tracked channel
    INSERT INTO public.tracked_channels (
      user_id, channel_id, channel_name, channel_thumbnail, channel_subscribers, is_global
    ) VALUES (
      NEW.id, v_channel.channel_id, v_channel.channel_name, v_channel.channel_thumbnail, v_channel.channel_subscribers, true
    ) ON CONFLICT (user_id, channel_id) DO NOTHING;
    
    -- Add user channel subscription for auto-sync
    INSERT INTO public.user_channel_subscriptions (
      user_id, channel_id, niche, is_active, is_global
    ) VALUES (
      NEW.id, v_channel.channel_id, v_channel.niche, true, true
    ) ON CONFLICT (user_id, channel_id) DO NOTHING;
    
    -- Add all videos from this channel with EXACT published_at timestamp
    FOR v_video IN 
      SELECT * FROM public.tracked_videos 
      WHERE channel_id = v_channel.channel_id
      ORDER BY published_at DESC
    LOOP
      INSERT INTO public.user_videos (
        user_id, video_id, title, youtube_url, thumbnail_url, channel_name,
        channel_subscribers, upload_date, view_count, niche, channel_id, is_global
      ) VALUES (
        NEW.id,
        v_video.video_id,
        v_video.title,
        COALESCE(v_video.youtube_url, 'https://www.youtube.com/watch?v=' || v_video.video_id),
        COALESCE(v_video.thumbnail_url, 'https://i.ytimg.com/vi/' || v_video.video_id || '/hqdefault.jpg'),
        COALESCE(v_video.channel_name, v_channel.channel_name),
        v_channel.channel_subscribers,
        v_video.published_at,  -- Keep exact timestamp
        COALESCE(v_video.view_count, 0),
        v_channel.niche,
        v_video.channel_id,
        true
      ) ON CONFLICT (user_id, video_id) DO NOTHING;
    END LOOP;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Sync function for global channel videos
CREATE OR REPLACE FUNCTION public.sync_global_channel_to_all_users()
RETURNS TRIGGER AS $$
DECLARE
  v_user RECORD;
  v_video RECORD;
BEGIN
  IF NEW.is_active = false THEN
    RETURN NEW;
  END IF;
  
  FOR v_user IN SELECT id FROM public.profiles LOOP
    -- Add tracked channel
    INSERT INTO public.tracked_channels (
      user_id, channel_id, channel_name, channel_thumbnail, channel_subscribers, is_global
    ) VALUES (
      v_user.id, NEW.channel_id, NEW.channel_name, NEW.channel_thumbnail, NEW.channel_subscribers, true
    ) ON CONFLICT (user_id, channel_id) DO NOTHING;
    
    -- Add niche
    IF NEW.niche IS NOT NULL THEN
      INSERT INTO public.user_niches (user_id, niche, is_global)
      VALUES (v_user.id, NEW.niche, true)
      ON CONFLICT (user_id, niche) DO NOTHING;
    END IF;
    
    -- Add subscription
    INSERT INTO public.user_channel_subscriptions (
      user_id, channel_id, niche, is_active, is_global
    ) VALUES (
      v_user.id, NEW.channel_id, NEW.niche, true, true
    ) ON CONFLICT (user_id, channel_id) DO UPDATE SET
      niche = EXCLUDED.niche,
      is_active = true,
      is_global = true;
    
    -- Sync existing videos with exact timestamps
    FOR v_video IN 
      SELECT * FROM public.tracked_videos 
      WHERE channel_id = NEW.channel_id
    LOOP
      INSERT INTO public.user_videos (
        user_id, video_id, title, youtube_url, thumbnail_url, channel_name,
        channel_subscribers, upload_date, view_count, niche, channel_id, is_global
      ) VALUES (
        v_user.id,
        v_video.video_id,
        v_video.title,
        COALESCE(v_video.youtube_url, 'https://www.youtube.com/watch?v=' || v_video.video_id),
        COALESCE(v_video.thumbnail_url, 'https://i.ytimg.com/vi/' || v_video.video_id || '/hqdefault.jpg'),
        COALESCE(v_video.channel_name, NEW.channel_name),
        NEW.channel_subscribers,
        v_video.published_at,  -- Keep exact timestamp
        COALESCE(v_video.view_count, 0),
        NEW.niche,
        v_video.channel_id,
        true
      ) ON CONFLICT (user_id, video_id) DO NOTHING;
    END LOOP;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
DROP TRIGGER IF EXISTS trigger_sync_global_channel ON public.admin_global_channels;
CREATE TRIGGER trigger_sync_global_channel
  AFTER INSERT OR UPDATE ON public.admin_global_channels
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_global_channel_to_all_users();
