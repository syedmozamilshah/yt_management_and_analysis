-- Migration: Mark specific channels as global and move to USA tab
-- These are admin-added channels that should be visible to all users

-- List of channels to mark as global (match by channel_name)
-- From screenshots: F1/Formula channels and Basketball channels

-- ===========================================
-- 1. UPDATE TRACKED_CHANNELS - Mark as global and set to USA
-- ===========================================
UPDATE public.tracked_channels
SET is_global = true, tab_type = 'usa'
WHERE channel_name IN (
  'Formel 1 Aktuell',
  'Formula Vandals', 
  'Formula Maranello Today',
  'Mazz F1',
  'F1 SEEKERS',
  'F1 Sync',
  'Full Throttle',
  'Formula Action',
  'Formula News Today',
  'Formula Today',
  'SpillFame',
  'WhisperWire',
  'HOOP ZONE',
  'Rub My Hoops',
  'The Fifth Quarter',
  'BallStories',
  'Courtside TV'
);

-- Log how many were updated
DO $$
DECLARE
  updated_count INT;
BEGIN
  SELECT COUNT(*) INTO updated_count 
  FROM public.tracked_channels 
  WHERE is_global = true AND tab_type = 'usa' 
  AND channel_name IN (
    'Formel 1 Aktuell', 'Formula Vandals', 'Formula Maranello Today', 'Mazz F1',
    'F1 SEEKERS', 'F1 Sync', 'Full Throttle', 'Formula Action', 'Formula News Today',
    'Formula Today', 'SpillFame', 'WhisperWire', 'HOOP ZONE', 'Rub My Hoops',
    'The Fifth Quarter', 'BallStories', 'Courtside TV'
  );
  RAISE NOTICE 'tracked_channels: % records marked as global and moved to USA', updated_count;
END $$;

-- ===========================================
-- 2. UPDATE USER_VIDEOS - Mark as global and set to USA
-- ===========================================
UPDATE public.user_videos
SET is_global = true, tab_type = 'usa'
WHERE channel_name IN (
  'Formel 1 Aktuell',
  'Formula Vandals', 
  'Formula Maranello Today',
  'Mazz F1',
  'F1 SEEKERS',
  'F1 Sync',
  'Full Throttle',
  'Formula Action',
  'Formula News Today',
  'Formula Today',
  'SpillFame',
  'WhisperWire',
  'HOOP ZONE',
  'Rub My Hoops',
  'The Fifth Quarter',
  'BallStories',
  'Courtside TV'
);

-- Log how many were updated
DO $$
DECLARE
  updated_count INT;
BEGIN
  SELECT COUNT(*) INTO updated_count 
  FROM public.user_videos 
  WHERE is_global = true AND tab_type = 'usa'
  AND channel_name IN (
    'Formel 1 Aktuell', 'Formula Vandals', 'Formula Maranello Today', 'Mazz F1',
    'F1 SEEKERS', 'F1 Sync', 'Full Throttle', 'Formula Action', 'Formula News Today',
    'Formula Today', 'SpillFame', 'WhisperWire', 'HOOP ZONE', 'Rub My Hoops',
    'The Fifth Quarter', 'BallStories', 'Courtside TV'
  );
  RAISE NOTICE 'user_videos: % records marked as global and moved to USA', updated_count;
END $$;

-- ===========================================
-- 3. UPDATE USER_CHANNEL_SUBSCRIPTIONS - Mark as global and set to USA
-- ===========================================
UPDATE public.user_channel_subscriptions
SET is_global = true, tab_type = 'usa'
WHERE channel_id IN (
  SELECT DISTINCT channel_id FROM public.tracked_channels
  WHERE channel_name IN (
    'Formel 1 Aktuell', 'Formula Vandals', 'Formula Maranello Today', 'Mazz F1',
    'F1 SEEKERS', 'F1 Sync', 'Full Throttle', 'Formula Action', 'Formula News Today',
    'Formula Today', 'SpillFame', 'WhisperWire', 'HOOP ZONE', 'Rub My Hoops',
    'The Fifth Quarter', 'BallStories', 'Courtside TV'
  )
);

-- ===========================================
-- 4. UPDATE ADMIN_GLOBAL_CHANNELS - Ensure these are in the admin global list
-- ===========================================
INSERT INTO public.admin_global_channels (channel_id, channel_name, tab_type, is_active)
SELECT DISTINCT channel_id, channel_name, 'usa', true
FROM public.tracked_channels
WHERE channel_name IN (
  'Formel 1 Aktuell', 'Formula Vandals', 'Formula Maranello Today', 'Mazz F1',
  'F1 SEEKERS', 'F1 Sync', 'Full Throttle', 'Formula Action', 'Formula News Today',
  'Formula Today', 'SpillFame', 'WhisperWire', 'HOOP ZONE', 'Rub My Hoops',
  'The Fifth Quarter', 'BallStories', 'Courtside TV'
)
ON CONFLICT (channel_id) DO UPDATE SET
  tab_type = 'usa',
  is_active = true;

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Migration complete: Specified channels are now global and in USA tab';
END $$;
