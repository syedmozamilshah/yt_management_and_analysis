-- Migration: Add tab_type column to support USA and Spanish tabs
-- This allows users to have separate video collections for each tab

-- Add tab_type column to user_videos table
ALTER TABLE public.user_videos 
ADD COLUMN IF NOT EXISTS tab_type TEXT NOT NULL DEFAULT 'usa';

-- Add tab_type column to tracked_channels table  
ALTER TABLE public.tracked_channels 
ADD COLUMN IF NOT EXISTS tab_type TEXT NOT NULL DEFAULT 'usa';

-- Add tab_type column to user_channel_subscriptions table
ALTER TABLE public.user_channel_subscriptions 
ADD COLUMN IF NOT EXISTS tab_type TEXT NOT NULL DEFAULT 'usa';

-- Add tab_type column to admin_global_channels table
ALTER TABLE public.admin_global_channels 
ADD COLUMN IF NOT EXISTS tab_type TEXT NOT NULL DEFAULT 'usa';

-- Create indexes for better query performance on tab_type
CREATE INDEX IF NOT EXISTS idx_user_videos_tab_type ON public.user_videos(tab_type);
CREATE INDEX IF NOT EXISTS idx_tracked_channels_tab_type ON public.tracked_channels(tab_type);
CREATE INDEX IF NOT EXISTS idx_user_channel_subscriptions_tab_type ON public.user_channel_subscriptions(tab_type);
CREATE INDEX IF NOT EXISTS idx_admin_global_channels_tab_type ON public.admin_global_channels(tab_type);

-- Create composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_user_videos_user_tab ON public.user_videos(user_id, tab_type);
CREATE INDEX IF NOT EXISTS idx_tracked_channels_user_tab ON public.tracked_channels(user_id, tab_type);
CREATE INDEX IF NOT EXISTS idx_user_channel_subscriptions_user_tab ON public.user_channel_subscriptions(user_id, tab_type);

-- Update existing videos to use 'usa' tab (this sets all existing ideation videos to USA tab)
-- They already default to 'usa' but let's be explicit
UPDATE public.user_videos SET tab_type = 'usa' WHERE tab_type IS NULL OR tab_type = '';
UPDATE public.tracked_channels SET tab_type = 'usa' WHERE tab_type IS NULL OR tab_type = '';
UPDATE public.user_channel_subscriptions SET tab_type = 'usa' WHERE tab_type IS NULL OR tab_type = '';
UPDATE public.admin_global_channels SET tab_type = 'usa' WHERE tab_type IS NULL OR tab_type = '';

-- Add constraint to ensure only valid tab types are used
ALTER TABLE public.user_videos 
DROP CONSTRAINT IF EXISTS user_videos_tab_type_check;
ALTER TABLE public.user_videos 
ADD CONSTRAINT user_videos_tab_type_check CHECK (tab_type IN ('usa', 'spanish'));

ALTER TABLE public.tracked_channels 
DROP CONSTRAINT IF EXISTS tracked_channels_tab_type_check;
ALTER TABLE public.tracked_channels 
ADD CONSTRAINT tracked_channels_tab_type_check CHECK (tab_type IN ('usa', 'spanish'));

ALTER TABLE public.user_channel_subscriptions 
DROP CONSTRAINT IF EXISTS user_channel_subscriptions_tab_type_check;
ALTER TABLE public.user_channel_subscriptions 
ADD CONSTRAINT user_channel_subscriptions_tab_type_check CHECK (tab_type IN ('usa', 'spanish'));

ALTER TABLE public.admin_global_channels 
DROP CONSTRAINT IF EXISTS admin_global_channels_tab_type_check;
ALTER TABLE public.admin_global_channels 
ADD CONSTRAINT admin_global_channels_tab_type_check CHECK (tab_type IN ('usa', 'spanish'));

-- Update unique constraints to include tab_type for tracked_channels
-- This allows the same channel to be tracked in different tabs
ALTER TABLE public.tracked_channels
DROP CONSTRAINT IF EXISTS tracked_channels_user_id_channel_id_key;

ALTER TABLE public.tracked_channels
ADD CONSTRAINT tracked_channels_user_id_channel_id_tab_key UNIQUE (user_id, channel_id, tab_type);

-- Update unique constraints for user_channel_subscriptions
ALTER TABLE public.user_channel_subscriptions
DROP CONSTRAINT IF EXISTS user_channel_subscriptions_user_id_channel_id_key;

ALTER TABLE public.user_channel_subscriptions
ADD CONSTRAINT user_channel_subscriptions_user_id_channel_id_tab_key UNIQUE (user_id, channel_id, tab_type);

-- Log the migration
DO $$
DECLARE
  videos_count INTEGER;
  channels_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO videos_count FROM public.user_videos;
  SELECT COUNT(*) INTO channels_count FROM public.tracked_channels;
  RAISE NOTICE 'Migration completed: % videos and % tracked channels updated with tab_type column', videos_count, channels_count;
END $$;
