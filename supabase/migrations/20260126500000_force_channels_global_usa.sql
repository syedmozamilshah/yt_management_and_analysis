-- Migration: Force ALL entries for specific channels to be global and in USA tab
-- This handles the case where there are duplicate entries with different is_global values

-- ===========================================
-- 1. UPDATE ALL TRACKED_CHANNELS entries for these channels
-- ===========================================
UPDATE public.tracked_channels
SET is_global = true, tab_type = 'usa'
WHERE channel_name ILIKE '%Formel 1 Aktuell%'
   OR channel_name ILIKE '%Formula Vandals%'
   OR channel_name ILIKE '%Formula Maranello Today%'
   OR channel_name ILIKE '%Mazz F1%'
   OR channel_name ILIKE '%F1 SEEKERS%'
   OR channel_name ILIKE '%F1 Sync%'
   OR channel_name ILIKE '%Full Throttle%'
   OR channel_name ILIKE '%Formula Action%'
   OR channel_name ILIKE '%Formula News Today%'
   OR channel_name ILIKE '%Formula Today%'
   OR channel_name ILIKE '%SpillFame%'
   OR channel_name ILIKE '%WhisperWire%'
   OR channel_name ILIKE '%HOOP ZONE%'
   OR channel_name ILIKE '%Rub My Hoops%'
   OR channel_name ILIKE '%The Fifth Quarter%'
   OR channel_name ILIKE '%BallStories%'
   OR channel_name ILIKE '%Courtside TV%';

-- Log results
DO $$
DECLARE
  updated_count INT;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'tracked_channels: Updated % records to global/USA', updated_count;
END $$;

-- ===========================================
-- 2. UPDATE ALL USER_VIDEOS entries for these channels
-- ===========================================
UPDATE public.user_videos
SET is_global = true, tab_type = 'usa'
WHERE channel_name ILIKE '%Formel 1 Aktuell%'
   OR channel_name ILIKE '%Formula Vandals%'
   OR channel_name ILIKE '%Formula Maranello Today%'
   OR channel_name ILIKE '%Mazz F1%'
   OR channel_name ILIKE '%F1 SEEKERS%'
   OR channel_name ILIKE '%F1 Sync%'
   OR channel_name ILIKE '%Full Throttle%'
   OR channel_name ILIKE '%Formula Action%'
   OR channel_name ILIKE '%Formula News Today%'
   OR channel_name ILIKE '%Formula Today%'
   OR channel_name ILIKE '%SpillFame%'
   OR channel_name ILIKE '%WhisperWire%'
   OR channel_name ILIKE '%HOOP ZONE%'
   OR channel_name ILIKE '%Rub My Hoops%'
   OR channel_name ILIKE '%The Fifth Quarter%'
   OR channel_name ILIKE '%BallStories%'
   OR channel_name ILIKE '%Courtside TV%';

-- ===========================================
-- 3. UPDATE ALL USER_CHANNEL_SUBSCRIPTIONS
-- ===========================================
UPDATE public.user_channel_subscriptions ucs
SET is_global = true, tab_type = 'usa'
FROM public.tracked_channels tc
WHERE ucs.channel_id = tc.channel_id
  AND (tc.channel_name ILIKE '%Formel 1 Aktuell%'
    OR tc.channel_name ILIKE '%Formula Vandals%'
    OR tc.channel_name ILIKE '%Formula Maranello Today%'
    OR tc.channel_name ILIKE '%Mazz F1%'
    OR tc.channel_name ILIKE '%F1 SEEKERS%'
    OR tc.channel_name ILIKE '%F1 Sync%'
    OR tc.channel_name ILIKE '%Full Throttle%'
    OR tc.channel_name ILIKE '%Formula Action%'
    OR tc.channel_name ILIKE '%Formula News Today%'
    OR tc.channel_name ILIKE '%Formula Today%'
    OR tc.channel_name ILIKE '%SpillFame%'
    OR tc.channel_name ILIKE '%WhisperWire%'
    OR tc.channel_name ILIKE '%HOOP ZONE%'
    OR tc.channel_name ILIKE '%Rub My Hoops%'
    OR tc.channel_name ILIKE '%The Fifth Quarter%'
    OR tc.channel_name ILIKE '%BallStories%'
    OR tc.channel_name ILIKE '%Courtside TV%');

-- ===========================================
-- 4. Verify there are no non-global entries left for these channels
-- ===========================================
DO $$
DECLARE
  ideation_count INT;
  usa_count INT;
BEGIN
  SELECT COUNT(*) INTO ideation_count 
  FROM public.tracked_channels 
  WHERE tab_type = 'ideation' 
    AND (channel_name ILIKE '%Formel%' OR channel_name ILIKE '%F1%' OR channel_name ILIKE '%Formula%'
         OR channel_name ILIKE '%SpillFame%' OR channel_name ILIKE '%WhisperWire%' OR channel_name ILIKE '%HOOP%'
         OR channel_name ILIKE '%Hoops%' OR channel_name ILIKE '%Quarter%' OR channel_name ILIKE '%Ball%'
         OR channel_name ILIKE '%Courtside%' OR channel_name ILIKE '%Throttle%');
  
  SELECT COUNT(*) INTO usa_count 
  FROM public.tracked_channels 
  WHERE tab_type = 'usa' AND is_global = true
    AND (channel_name ILIKE '%Formel%' OR channel_name ILIKE '%F1%' OR channel_name ILIKE '%Formula%'
         OR channel_name ILIKE '%SpillFame%' OR channel_name ILIKE '%WhisperWire%' OR channel_name ILIKE '%HOOP%'
         OR channel_name ILIKE '%Hoops%' OR channel_name ILIKE '%Quarter%' OR channel_name ILIKE '%Ball%'
         OR channel_name ILIKE '%Courtside%' OR channel_name ILIKE '%Throttle%');
  
  RAISE NOTICE 'After migration: % entries still in ideation (should be 0), % entries in USA (should be all)', ideation_count, usa_count;
END $$;

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Migration complete: All specified channels forced to global + USA tab';
END $$;
