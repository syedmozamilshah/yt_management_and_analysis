-- Migration: Check and fix corrupted titles
-- Some titles may have been corrupted with "0" prefix

-- ===============================
-- 1. Find any titles that start with "0" followed by a letter (suspicious)
-- ===============================
DO $$
DECLARE
  suspicious_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO suspicious_count
  FROM public.user_videos
  WHERE title ~ '^0[A-Za-z]';
  
  RAISE NOTICE 'Found % videos with suspicious "0" prefix in title', suspicious_count;
  
  -- Also check tracked_videos
  SELECT COUNT(*) INTO suspicious_count
  FROM public.tracked_videos
  WHERE title ~ '^0[A-Za-z]';
  
  RAISE NOTICE 'Found % tracked_videos with suspicious "0" prefix in title', suspicious_count;
END $$;

-- ===============================
-- 2. If titles were corrupted, try to fix them by removing leading "0"
-- Only if it looks like a corruption (0 followed by uppercase letter)
-- ===============================
UPDATE public.user_videos
SET title = SUBSTRING(title FROM 2)
WHERE title ~ '^0[A-Z]';

UPDATE public.tracked_videos
SET title = SUBSTRING(title FROM 2)
WHERE title ~ '^0[A-Z]';

-- ===============================
-- 3. Verify the fix
-- ===============================
DO $$
DECLARE
  remaining_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO remaining_count
  FROM public.user_videos
  WHERE title ~ '^0[A-Za-z]';
  
  RAISE NOTICE 'After fix: % videos with "0" prefix remaining', remaining_count;
END $$;
