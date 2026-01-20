-- ============================================
-- Auto-subscribe ALL channels from user_videos
-- ============================================
-- This ensures every channel that has videos in ideation will auto-sync new videos

-- ============================================
-- 1. Create subscriptions for ALL existing channels in user_videos
-- ============================================
-- This populates user_channel_subscriptions from existing user_videos
INSERT INTO public.user_channel_subscriptions (user_id, channel_id, niche, is_active, created_at, updated_at)
SELECT DISTINCT
  uv.user_id,
  tv.channel_id,
  COALESCE(uv.niche, 'General'),
  true,
  now(),
  now()
FROM public.user_videos uv
JOIN public.tracked_videos tv ON tv.video_id = uv.video_id
WHERE tv.channel_id IS NOT NULL
ON CONFLICT (user_id, channel_id) DO UPDATE SET
  is_active = true,
  updated_at = now();

-- Also try to get channel_id directly from youtube_url if tracked_videos doesn't have it
-- This handles manually added videos
INSERT INTO public.user_channel_subscriptions (user_id, channel_id, niche, is_active, created_at, updated_at)
SELECT DISTINCT
  uv.user_id,
  tc.channel_id,
  COALESCE(uv.niche, 'General'),
  true,
  now(),
  now()
FROM public.user_videos uv
JOIN public.tracked_channels tc ON tc.channel_name = uv.channel_name
WHERE tc.channel_id IS NOT NULL
ON CONFLICT (user_id, channel_id) DO UPDATE SET
  is_active = true,
  updated_at = now();

-- ============================================
-- 2. Create function to auto-subscribe when video is added to user_videos
-- ============================================
CREATE OR REPLACE FUNCTION public.auto_subscribe_channel_from_video()
RETURNS TRIGGER AS $$
DECLARE
  v_channel_id TEXT;
BEGIN
  -- Try to find channel_id from tracked_videos
  SELECT tv.channel_id INTO v_channel_id
  FROM public.tracked_videos tv
  WHERE tv.video_id = NEW.video_id
  LIMIT 1;

  -- If not found, try from tracked_channels by channel_name
  IF v_channel_id IS NULL AND NEW.channel_name IS NOT NULL THEN
    SELECT tc.channel_id INTO v_channel_id
    FROM public.tracked_channels tc
    WHERE tc.channel_name = NEW.channel_name
    LIMIT 1;
  END IF;

  -- If we found a channel_id, create/update the subscription
  IF v_channel_id IS NOT NULL THEN
    INSERT INTO public.user_channel_subscriptions (user_id, channel_id, niche, is_active, created_at, updated_at)
    VALUES (NEW.user_id, v_channel_id, COALESCE(NEW.niche, 'General'), true, now(), now())
    ON CONFLICT (user_id, channel_id) DO UPDATE SET
      is_active = true,
      updated_at = now();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for auto-subscribing when videos are added
DROP TRIGGER IF EXISTS trigger_auto_subscribe_channel ON public.user_videos;
CREATE TRIGGER trigger_auto_subscribe_channel
  AFTER INSERT ON public.user_videos
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_subscribe_channel_from_video();

-- ============================================
-- 3. Ensure user_activity exists for all users with videos
-- ============================================
INSERT INTO public.user_activity (user_id, last_ideation_opened_at, is_active, created_at, updated_at)
SELECT DISTINCT
  user_id,
  now(),
  true,
  now(),
  now()
FROM public.user_videos
ON CONFLICT (user_id) DO UPDATE SET
  last_ideation_opened_at = now(),
  is_active = true,
  updated_at = now();

-- ============================================
-- 4. Show summary
-- ============================================
DO $$
DECLARE
  sub_count INTEGER;
  channel_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO sub_count FROM public.user_channel_subscriptions WHERE is_active = true;
  SELECT COUNT(DISTINCT channel_id) INTO channel_count FROM public.user_channel_subscriptions WHERE is_active = true;
  RAISE NOTICE 'Created % active subscriptions for % unique channels', sub_count, channel_count;
END $$;
