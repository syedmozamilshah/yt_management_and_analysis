-- Migration: Fix upload_date to use full timestamp instead of date only
-- This fixes the "13 hours ago" issue where videos show incorrect relative time
-- Also fixes channel deletion to properly handle global channels

-- 1. Update auto_sync_video_to_users to use full timestamp
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
  -- FIX: Use full timestamp instead of ::date for proper relative time display
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
    NEW.published_at::text,  -- Use full timestamp as text
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
      WHEN user_videos.channel_name IS NULL OR user_videos.channel_name = '' OR user_videos.channel_name = 'Unknown Channel'
      THEN EXCLUDED.channel_name 
      ELSE user_videos.channel_name 
    END;
    
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Update sync_global_content_to_new_user to use full timestamp
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
      user_id, channel_id, channel_name, channel_thumbnail, is_global
    ) VALUES (
      NEW.id, v_channel.channel_id, v_channel.channel_name, v_channel.channel_thumbnail, true
    ) ON CONFLICT (user_id, channel_id) DO NOTHING;
    
    -- Add all videos from this channel
    FOR v_video IN 
      SELECT * FROM public.tracked_videos 
      WHERE channel_id = v_channel.channel_id
    LOOP
      INSERT INTO public.user_videos (
        user_id, video_id, title, youtube_url, thumbnail_url, channel_name,
        channel_subscribers, upload_date, view_count, niche, channel_id, is_global
      ) VALUES (
        NEW.id,
        v_video.video_id,
        v_video.title,
        'https://www.youtube.com/watch?v=' || v_video.video_id,
        v_video.thumbnail_url,
        v_video.channel_name,
        v_channel.channel_subscribers,
        v_video.published_at::text,  -- Use full timestamp as text
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

-- 3. Update sync_global_channel_to_all_users to use full timestamp
CREATE OR REPLACE FUNCTION public.sync_global_channel_to_all_users()
RETURNS TRIGGER AS $$
DECLARE
  v_user RECORD;
  v_video RECORD;
BEGIN
  -- Only proceed for active channels (handles both INSERT and UPDATE)
  IF NEW.is_active = false THEN
    RETURN NEW;
  END IF;
  
  -- Sync to all existing users
  FOR v_user IN SELECT id FROM public.profiles LOOP
    -- Add tracked channel for user
    INSERT INTO public.tracked_channels (
      user_id, channel_id, channel_name, channel_thumbnail, is_global
    ) VALUES (
      v_user.id, NEW.channel_id, NEW.channel_name, NEW.channel_thumbnail, true
    ) ON CONFLICT (user_id, channel_id) DO NOTHING;
    
    -- Add niche for user
    IF NEW.niche IS NOT NULL THEN
      INSERT INTO public.user_niches (user_id, niche, is_global)
      VALUES (v_user.id, NEW.niche, true)
      ON CONFLICT (user_id, niche) DO NOTHING;
    END IF;
    
    -- Sync existing videos from this channel
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
        'https://www.youtube.com/watch?v=' || v_video.video_id,
        v_video.thumbnail_url,
        COALESCE(v_video.channel_name, NEW.channel_name),
        NEW.channel_subscribers,
        v_video.published_at::text,  -- Use full timestamp as text
        COALESCE(v_video.view_count, 0),
        NEW.niche,
        v_video.channel_id,
        true
      ) ON CONFLICT (user_id, video_id) DO NOTHING;
    END LOOP;
    
    -- Add user channel subscription
    INSERT INTO public.user_channel_subscriptions (
      user_id, channel_id, niche, is_active, is_global
    ) VALUES (
      v_user.id, NEW.channel_id, NEW.niche, true, true
    ) ON CONFLICT (user_id, channel_id) DO UPDATE SET
      niche = EXCLUDED.niche,
      is_active = true,
      is_global = true;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Function to properly delete a global channel (admin only)
-- This will remove the channel from admin_global_channels and all user data
CREATE OR REPLACE FUNCTION public.delete_global_channel(p_channel_id TEXT)
RETURNS JSON AS $$
DECLARE
  v_deleted_videos INTEGER;
  v_deleted_channels INTEGER;
  v_deleted_subscriptions INTEGER;
BEGIN
  -- Delete from user_channel_subscriptions where is_global = true
  DELETE FROM public.user_channel_subscriptions 
  WHERE channel_id = p_channel_id AND is_global = true;
  GET DIAGNOSTICS v_deleted_subscriptions = ROW_COUNT;
  
  -- Delete from user_videos where is_global = true and channel_id matches
  DELETE FROM public.user_videos 
  WHERE channel_id = p_channel_id AND is_global = true;
  GET DIAGNOSTICS v_deleted_videos = ROW_COUNT;
  
  -- Delete from tracked_channels where is_global = true
  DELETE FROM public.tracked_channels 
  WHERE channel_id = p_channel_id AND is_global = true;
  GET DIAGNOSTICS v_deleted_channels = ROW_COUNT;
  
  -- Delete from tracked_videos
  DELETE FROM public.tracked_videos 
  WHERE channel_id = p_channel_id;
  
  -- Delete from admin_global_channels
  DELETE FROM public.admin_global_channels 
  WHERE channel_id = p_channel_id;
  
  RETURN json_build_object(
    'success', true,
    'deleted_videos', v_deleted_videos,
    'deleted_channels', v_deleted_channels,
    'deleted_subscriptions', v_deleted_subscriptions
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Grant execute permission to authenticated users (will be RLS checked)
GRANT EXECUTE ON FUNCTION public.delete_global_channel(TEXT) TO authenticated;

-- 6. Update existing user_videos with incorrect upload_date format
-- Convert date-only values to include a time component for proper relative display
-- This updates records where upload_date looks like '2026-01-22' (date only)
UPDATE public.user_videos
SET upload_date = upload_date || 'T00:00:00Z'
WHERE upload_date IS NOT NULL 
  AND upload_date ~ '^\d{4}-\d{2}-\d{2}$';

-- 7. Add index for better query performance on upload_date
CREATE INDEX IF NOT EXISTS idx_user_videos_upload_date ON public.user_videos(upload_date DESC NULLS LAST);
