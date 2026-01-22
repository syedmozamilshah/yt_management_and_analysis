-- Migration: Cleanup duplicate tracked_channels entries
-- This removes duplicate tracked_channels keeping only the most recent entry per user_id + channel_id

-- First, identify and delete duplicates (keep the one with the latest created_at)
WITH duplicates AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY user_id, channel_id ORDER BY created_at DESC) as rn
  FROM public.tracked_channels
)
DELETE FROM public.tracked_channels
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Verify no duplicates remain
DO $$
DECLARE
  dup_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO dup_count
  FROM (
    SELECT user_id, channel_id, COUNT(*)
    FROM public.tracked_channels
    GROUP BY user_id, channel_id
    HAVING COUNT(*) > 1
  ) dups;
  
  RAISE NOTICE 'Remaining duplicates after cleanup: %', dup_count;
END $$;

-- Add a unique constraint if it doesn't exist to prevent future duplicates
-- Note: The original table already has UNIQUE(user_id, channel_id) but we ensure it exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'tracked_channels_user_id_channel_id_key'
  ) THEN
    BEGIN
      ALTER TABLE public.tracked_channels
      ADD CONSTRAINT tracked_channels_user_id_channel_id_key UNIQUE (user_id, channel_id);
    EXCEPTION WHEN duplicate_table THEN
      RAISE NOTICE 'Unique constraint already exists';
    END;
  END IF;
END $$;
