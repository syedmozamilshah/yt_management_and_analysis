-- Migration: Final cleanup of duplicate videos
-- This ensures all duplicate videos are removed from user_videos table
-- Keeping the entry with the highest view_count for each (user_id, video_id) pair

-- ===============================
-- 1. Log current state
-- ===============================
DO $$
DECLARE
  total_count INTEGER;
  dup_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_count FROM public.user_videos;
  
  SELECT COUNT(*) INTO dup_count
  FROM (
    SELECT user_id, video_id, COUNT(*)
    FROM public.user_videos
    GROUP BY user_id, video_id
    HAVING COUNT(*) > 1
  ) dups;
  
  RAISE NOTICE 'Before cleanup: % total videos, % duplicate groups', total_count, dup_count;
END $$;

-- ===============================
-- 2. Remove duplicates - keep the one with highest view_count
-- Using a CTE to identify rows to keep
-- ===============================
WITH ranked_videos AS (
  SELECT 
    id,
    user_id,
    video_id,
    view_count,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, video_id 
      ORDER BY COALESCE(view_count, 0) DESC, created_at DESC
    ) as rn
  FROM public.user_videos
),
videos_to_delete AS (
  SELECT id 
  FROM ranked_videos 
  WHERE rn > 1
)
DELETE FROM public.user_videos
WHERE id IN (SELECT id FROM videos_to_delete);

-- ===============================
-- 3. Ensure the unique constraint exists
-- ===============================
DO $$
BEGIN
  -- First check if constraint exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'user_videos_user_id_video_id_key'
    AND conrelid = 'public.user_videos'::regclass
  ) THEN
    -- Add the unique constraint
    ALTER TABLE public.user_videos 
    ADD CONSTRAINT user_videos_user_id_video_id_key UNIQUE (user_id, video_id);
    RAISE NOTICE 'Added unique constraint on (user_id, video_id)';
  ELSE
    RAISE NOTICE 'Unique constraint already exists';
  END IF;
EXCEPTION 
  WHEN duplicate_object THEN
    RAISE NOTICE 'Constraint already exists (caught exception)';
  WHEN unique_violation THEN
    RAISE NOTICE 'Cannot add constraint - duplicates still exist. Running additional cleanup...';
    -- Force delete remaining duplicates
    DELETE FROM public.user_videos a
    USING public.user_videos b
    WHERE a.id > b.id 
      AND a.user_id = b.user_id 
      AND a.video_id = b.video_id;
    -- Try again
    ALTER TABLE public.user_videos 
    ADD CONSTRAINT user_videos_user_id_video_id_key UNIQUE (user_id, video_id);
END $$;

-- ===============================
-- 4. Log final state
-- ===============================
DO $$
DECLARE
  total_count INTEGER;
  dup_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_count FROM public.user_videos;
  
  SELECT COUNT(*) INTO dup_count
  FROM (
    SELECT user_id, video_id, COUNT(*)
    FROM public.user_videos
    GROUP BY user_id, video_id
    HAVING COUNT(*) > 1
  ) dups;
  
  RAISE NOTICE 'After cleanup: % total videos, % duplicate groups remaining', total_count, dup_count;
END $$;
