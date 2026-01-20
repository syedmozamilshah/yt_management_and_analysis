-- ============================================
-- Add Channel ID to User Videos for Auto-Sync
-- ============================================
-- This allows us to track channels and auto-sync new videos

-- ============================================
-- 1. Add channel_id column to user_videos
-- ============================================
ALTER TABLE public.user_videos 
ADD COLUMN IF NOT EXISTS channel_id TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_videos_channel_id 
  ON public.user_videos(channel_id);

-- ============================================
-- 2. Update user_videos with channel_id from tracked_videos
-- ============================================
-- For videos that already exist in tracked_videos, copy the channel_id
UPDATE public.user_videos uv
SET channel_id = tv.channel_id
FROM public.tracked_videos tv
WHERE uv.video_id = tv.video_id
  AND uv.channel_id IS NULL
  AND tv.channel_id IS NOT NULL;

-- ============================================
-- 3. Create tracked_channels for channels we have channel_id for
-- ============================================
-- Insert channels that have channel_id but aren't in tracked_channels yet
INSERT INTO public.tracked_channels (channel_id, channel_name, rss_feed_url, is_active, user_id)
SELECT DISTINCT ON (uv.channel_id)
  uv.channel_id,
  uv.channel_name,
  'https://www.youtube.com/feeds/videos.xml?channel_id=' || uv.channel_id,
  true,
  uv.user_id
FROM public.user_videos uv
WHERE uv.channel_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.tracked_channels tc WHERE tc.channel_id = uv.channel_id
  )
ORDER BY uv.channel_id, uv.created_at DESC
ON CONFLICT DO NOTHING;

-- ============================================
-- 4. Create subscriptions for channels we now have
-- ============================================
INSERT INTO public.user_channel_subscriptions (user_id, channel_id, niche, is_active)
SELECT DISTINCT
  uv.user_id,
  uv.channel_id,
  COALESCE(uv.niche, 'General'),
  true
FROM public.user_videos uv
WHERE uv.channel_id IS NOT NULL
ON CONFLICT (user_id, channel_id) DO UPDATE SET
  is_active = true,
  updated_at = now();

-- ============================================
-- 5. Log progress
-- ============================================
DO $$
DECLARE
  v_with_channel_id INT;
  v_without_channel_id INT;
  v_subscriptions INT;
BEGIN
  SELECT COUNT(*) INTO v_with_channel_id FROM public.user_videos WHERE channel_id IS NOT NULL;
  SELECT COUNT(*) INTO v_without_channel_id FROM public.user_videos WHERE channel_id IS NULL;
  SELECT COUNT(*) INTO v_subscriptions FROM public.user_channel_subscriptions WHERE is_active = true;
  
  RAISE NOTICE 'User videos with channel_id: %, without: %, Active subscriptions: %', 
    v_with_channel_id, v_without_channel_id, v_subscriptions;
END $$;
