-- Migration: Force update all user_videos upload_date from tracked_videos
-- Run this to fix any remaining incorrect timestamps

-- Update ALL user_videos with the correct published_at from tracked_videos
-- Cast published_at to text since upload_date is a TEXT column
UPDATE public.user_videos uv
SET upload_date = tv.published_at::text
FROM public.tracked_videos tv
WHERE uv.video_id = tv.video_id
  AND tv.published_at IS NOT NULL;
