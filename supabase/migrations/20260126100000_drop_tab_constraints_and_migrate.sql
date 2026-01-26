-- Migration: Drop old constraints and move existing channels/videos to appropriate tabs
-- User-added (non-global) channels/videos -> Ideation tab
-- Admin-added (global) channels/videos -> USA tab

-- ===========================================
-- 1. DROP OLD CHECK CONSTRAINTS (they only allowed usa/spanish)
-- ===========================================
ALTER TABLE public.tracked_channels DROP CONSTRAINT IF EXISTS tracked_channels_tab_type_check;
ALTER TABLE public.user_videos DROP CONSTRAINT IF EXISTS user_videos_tab_type_check;
ALTER TABLE public.user_channel_subscriptions DROP CONSTRAINT IF EXISTS user_channel_subscriptions_tab_type_check;
ALTER TABLE public.admin_global_channels DROP CONSTRAINT IF EXISTS admin_global_channels_tab_type_check;

-- ===========================================
-- 2. UPDATE TRACKED_CHANNELS
-- ===========================================

-- Move all user-added (non-global) channels to ideation tab
UPDATE public.tracked_channels
SET tab_type = 'ideation'
WHERE (is_global IS NULL OR is_global = false)
  AND (tab_type IS NULL OR tab_type = 'usa' OR tab_type = '');

-- Ensure all admin-added (global) channels are in usa tab
UPDATE public.tracked_channels
SET tab_type = 'usa'
WHERE is_global = true
  AND (tab_type IS NULL OR tab_type = '');

-- ===========================================
-- 3. UPDATE USER_VIDEOS
-- ===========================================

-- Move all user-added (non-global) videos to ideation tab
UPDATE public.user_videos
SET tab_type = 'ideation'
WHERE (is_global IS NULL OR is_global = false)
  AND (tab_type IS NULL OR tab_type = 'usa' OR tab_type = '');

-- Ensure all admin-added (global) videos are in usa tab
UPDATE public.user_videos
SET tab_type = 'usa'
WHERE is_global = true
  AND (tab_type IS NULL OR tab_type = '');

-- ===========================================
-- 4. UPDATE USER_CHANNEL_SUBSCRIPTIONS
-- ===========================================

-- Move all user-added (non-global) subscriptions to ideation tab
UPDATE public.user_channel_subscriptions
SET tab_type = 'ideation'
WHERE (is_global IS NULL OR is_global = false)
  AND (tab_type IS NULL OR tab_type = 'usa' OR tab_type = '');

-- Ensure all admin-added (global) subscriptions are in usa tab
UPDATE public.user_channel_subscriptions
SET tab_type = 'usa'
WHERE is_global = true
  AND (tab_type IS NULL OR tab_type = '');

-- ===========================================
-- 5. ADD NEW CHECK CONSTRAINTS (allowing usa/spanish/ideation)
-- ===========================================
ALTER TABLE public.tracked_channels 
  ADD CONSTRAINT tracked_channels_tab_type_check 
  CHECK (tab_type IN ('usa', 'spanish', 'ideation'));

ALTER TABLE public.user_videos 
  ADD CONSTRAINT user_videos_tab_type_check 
  CHECK (tab_type IN ('usa', 'spanish', 'ideation'));

ALTER TABLE public.user_channel_subscriptions 
  ADD CONSTRAINT user_channel_subscriptions_tab_type_check 
  CHECK (tab_type IN ('usa', 'spanish', 'ideation'));
