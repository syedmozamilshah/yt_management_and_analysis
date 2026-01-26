-- Migration: Ensure all global channels/videos are in USA tab, non-global in Ideation
-- This fixes any existing data where tab_type was incorrectly set

-- ===========================================
-- 1. FIX TRACKED_CHANNELS
-- ===========================================

-- All global channels should be in USA tab
UPDATE public.tracked_channels
SET tab_type = 'usa'
WHERE is_global = true;
x`
-- All non-global channels should be in Ideation tab
UPDATE public.tracked_channels
SET tab_type = 'ideation'
WHERE (is_global IS NULL OR is_global = false);

-- Log results
DO $$
DECLARE
  global_usa INT;
  personal_ideation INT;
BEGIN
  SELECT COUNT(*) INTO global_usa FROM public.tracked_channels WHERE is_global = true AND tab_type = 'usa';
  SELECT COUNT(*) INTO personal_ideation FROM public.tracked_channels WHERE (is_global IS NULL OR is_global = false) AND tab_type = 'ideation';
  RAISE NOTICE 'tracked_channels: % global channels in USA, % personal channels in Ideation', global_usa, personal_ideation;
END $$;

-- ===========================================
-- 2. FIX USER_VIDEOS
-- ===========================================

-- All global videos should be in USA tab
UPDATE public.user_videos
SET tab_type = 'usa'
WHERE is_global = true;

-- All non-global videos should be in Ideation tab
UPDATE public.user_videos
SET tab_type = 'ideation'
WHERE (is_global IS NULL OR is_global = false);

-- Log results
DO $$
DECLARE
  global_usa INT;
  personal_ideation INT;
BEGIN
  SELECT COUNT(*) INTO global_usa FROM public.user_videos WHERE is_global = true AND tab_type = 'usa';
  SELECT COUNT(*) INTO personal_ideation FROM public.user_videos WHERE (is_global IS NULL OR is_global = false) AND tab_type = 'ideation';
  RAISE NOTICE 'user_videos: % global videos in USA, % personal videos in Ideation', global_usa, personal_ideation;
END $$;

-- ===========================================
-- 3. FIX USER_CHANNEL_SUBSCRIPTIONS
-- ===========================================

-- All global subscriptions should be in USA tab
UPDATE public.user_channel_subscriptions
SET tab_type = 'usa'
WHERE is_global = true;

-- All non-global subscriptions should be in Ideation tab
UPDATE public.user_channel_subscriptions
SET tab_type = 'ideation'
WHERE (is_global IS NULL OR is_global = false);

-- Log results
DO $$
DECLARE
  global_usa INT;
  personal_ideation INT;
BEGIN
  SELECT COUNT(*) INTO global_usa FROM public.user_channel_subscriptions WHERE is_global = true AND tab_type = 'usa';
  SELECT COUNT(*) INTO personal_ideation FROM public.user_channel_subscriptions WHERE (is_global IS NULL OR is_global = false) AND tab_type = 'ideation';
  RAISE NOTICE 'user_channel_subscriptions: % global in USA, % personal in Ideation', global_usa, personal_ideation;
END $$;

-- ===========================================
-- 4. FIX ADMIN_GLOBAL_CHANNELS (if exists)
-- ===========================================
UPDATE public.admin_global_channels
SET tab_type = 'usa'
WHERE tab_type IS NULL OR tab_type = '' OR tab_type = 'ideation';

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Migration complete: All global content is now in USA tab, all personal content is in Ideation tab';
END $$;
