-- Migration: Improve auto-sync trigger for Ideation tab videos
-- Purpose: Ensure auto-discovered videos are synced to ideation tab even if user hasn't opened ideation recently
-- This allows the sync_missed_videos_for_user RPC to catch all videos

-- 1. Update auto_sync_video_to_users to be less restrictive for ideation tab
-- Instead of requiring 72-hour activity, we'll sync ideation videos from the trigger immediately
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

  -- Insert video for users who have this channel tracked
  -- For ideation tab (user personal content), sync immediately
  -- For other tabs (global content), require recent activity
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
    COALESCE(tc.tab_type, 'ideation'),
    -- Get is_global from tracked_channels
    COALESCE(tc.is_global, false)
  FROM public.tracked_channels tc
  LEFT JOIN public.user_activity ua ON ua.user_id = tc.user_id
  WHERE tc.channel_id = NEW.channel_id
    AND tc.is_active = true
    AND (
      -- For ideation tab (personal content): sync immediately without time restriction
      -- For usa/spanish tabs (global content): require recent activity only
      tc.tab_type = 'ideation'
      OR (
        tc.tab_type IN ('usa', 'spanish')
        AND ua.last_ideation_opened_at IS NOT NULL 
        AND ua.last_ideation_opened_at > (now() - INTERVAL '72 hours')
      )
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

-- 2. Recreate the trigger
DROP TRIGGER IF EXISTS trigger_auto_sync_video ON public.tracked_videos;
CREATE TRIGGER trigger_auto_sync_video
  AFTER INSERT ON public.tracked_videos
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_sync_video_to_users();

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Migration complete: auto_sync_video_to_users now syncs ideation videos immediately';
END $$;
