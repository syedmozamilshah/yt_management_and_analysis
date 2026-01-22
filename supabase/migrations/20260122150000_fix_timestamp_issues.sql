-- Migration: Identify and fix videos with incorrect published_at timestamps
-- Videos where published_at was incorrectly set to insertion time instead of YouTube upload time
-- will have published_at very close to created_at (within 1 minute)

-- First, let's add a column to track videos that need re-fetching
ALTER TABLE public.tracked_videos ADD COLUMN IF NOT EXISTS needs_date_fix BOOLEAN DEFAULT false;

-- Mark videos where published_at is suspiciously close to created_at
-- These are likely videos where we set published_at = now() instead of the YouTube date
UPDATE public.tracked_videos
SET needs_date_fix = true
WHERE ABS(EXTRACT(EPOCH FROM (published_at - created_at))) < 60;  -- Within 60 seconds

-- Also mark videos that appear to be from the future (timezone issues)
UPDATE public.tracked_videos
SET needs_date_fix = true
WHERE published_at > now();

-- Mark videos from today that show as being uploaded "X hours ago" 
-- when they should be older based on video ID pattern
-- Actually, we can't determine this without the actual YouTube data

-- For now, let's just ensure newly inserted videos from RSS get correct timestamps
-- and mark all existing videos for potential refresh

-- Create a function to refresh video timestamps from RSS
CREATE OR REPLACE FUNCTION public.mark_videos_for_date_refresh()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Mark videos where the time component seems wrong
  -- (published_at is within a few hours of created_at)
  UPDATE public.tracked_videos
  SET needs_date_fix = true
  WHERE ABS(EXTRACT(EPOCH FROM (published_at - created_at))) < 3600  -- Within 1 hour
    AND needs_date_fix = false;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Also ensure the poll-rss-feeds function correctly parses timestamps
-- by checking that we preserve the full ISO 8601 timestamp

-- Update the formatDate interpretation by ensuring upload_date contains valid ISO strings
-- Let's also update user_videos to have a proper timestamp column for upload_date
-- instead of TEXT, but that's a bigger change. For now, ensure TEXT contains ISO 8601.

-- Ensure all user_videos.upload_date values are valid ISO 8601 strings
-- by updating them from tracked_videos.published_at
UPDATE public.user_videos uv
SET upload_date = to_char(tv.published_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
FROM public.tracked_videos tv
WHERE uv.video_id = tv.video_id
  AND tv.published_at IS NOT NULL;

-- Create a view to easily see videos with suspicious timestamps
CREATE OR REPLACE VIEW public.videos_with_timestamp_issues AS
SELECT 
  tv.id,
  tv.video_id,
  tv.title,
  tv.channel_id,
  tv.published_at,
  tv.created_at,
  EXTRACT(EPOCH FROM (tv.published_at - tv.created_at)) as time_diff_seconds,
  tv.needs_date_fix
FROM public.tracked_videos tv
WHERE ABS(EXTRACT(EPOCH FROM (tv.published_at - tv.created_at))) < 3600
ORDER BY tv.created_at DESC;

GRANT SELECT ON public.videos_with_timestamp_issues TO authenticated;
GRANT SELECT ON public.videos_with_timestamp_issues TO service_role;
