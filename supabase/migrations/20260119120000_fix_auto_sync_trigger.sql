-- ============================================
-- Fix Auto-sync Trigger - Remove tracked_channels dependency
-- ============================================
-- The previous trigger required a JOIN with tracked_channels which was too restrictive.
-- This updated trigger only needs user_channel_subscriptions to work.

-- ============================================
-- 1. Updated function to auto-add new videos to user_videos
-- ============================================
CREATE OR REPLACE FUNCTION public.auto_sync_video_to_users()
RETURNS TRIGGER AS $$
DECLARE
  channel_name_var TEXT;
BEGIN
  -- Get channel name from tracked_channels (any user's entry is fine)
  SELECT tc.channel_name INTO channel_name_var
  FROM public.tracked_channels tc
  WHERE tc.channel_id = NEW.channel_id
  LIMIT 1;

  -- Insert video for all users who are subscribed to this channel
  -- and have been active in the last 3 days
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
    created_at
  )
  SELECT 
    ucs.user_id,
    NEW.title,
    COALESCE(NEW.youtube_url, 'https://www.youtube.com/watch?v=' || NEW.video_id),
    NEW.video_id,
    COALESCE(NEW.thumbnail_url, 'https://i.ytimg.com/vi/' || NEW.video_id || '/hqdefault.jpg'),
    COALESCE(channel_name_var, 'Unknown Channel'),
    NEW.published_at,
    NEW.view_count,
    ucs.niche,
    now()
  FROM public.user_channel_subscriptions ucs
  LEFT JOIN public.user_activity ua ON ua.user_id = ucs.user_id
  WHERE ucs.channel_id = NEW.channel_id
    AND ucs.is_active = true
    -- Only sync for users who have been active in the last 3 days
    -- If no activity record, still sync (new users)
    AND (
      ua.last_ideation_opened_at IS NULL 
      OR ua.last_ideation_opened_at > now() - INTERVAL '3 days'
      OR ua.user_id IS NULL
    )
  ON CONFLICT (user_id, video_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
DROP TRIGGER IF EXISTS trigger_auto_sync_video ON public.tracked_videos;
CREATE TRIGGER trigger_auto_sync_video
  AFTER INSERT ON public.tracked_videos
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_sync_video_to_users();

-- ============================================
-- 2. Also add service role policy for user_channel_subscriptions
-- ============================================
-- This allows the trigger (which runs as SECURITY DEFINER) to read subscriptions
DROP POLICY IF EXISTS "Service role can read all subscriptions" ON public.user_channel_subscriptions;
CREATE POLICY "Service role can read all subscriptions"
  ON public.user_channel_subscriptions FOR SELECT
  USING (true);

-- ============================================
-- 3. Add service role policy for user_activity
-- ============================================
DROP POLICY IF EXISTS "Service role can read all activity" ON public.user_activity;
CREATE POLICY "Service role can read all activity"
  ON public.user_activity FOR SELECT
  USING (true);

-- ============================================
-- 4. Add service role policy for user_videos insert
-- ============================================
DROP POLICY IF EXISTS "Service role can insert videos" ON public.user_videos;
CREATE POLICY "Service role can insert videos"
  ON public.user_videos FOR INSERT
  WITH CHECK (true);
