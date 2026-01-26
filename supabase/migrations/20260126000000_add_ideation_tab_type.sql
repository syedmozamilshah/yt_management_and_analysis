-- Migration: Add ideation tab_type support
-- This migration ensures 'ideation' is a valid tab_type value for user personal content

-- Add ideation-related indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_user_videos_tab_ideation ON public.user_videos(tab_type) WHERE tab_type = 'ideation';
CREATE INDEX IF NOT EXISTS idx_tracked_channels_tab_ideation ON public.tracked_channels(tab_type) WHERE tab_type = 'ideation';
CREATE INDEX IF NOT EXISTS idx_user_channel_subscriptions_tab_ideation ON public.user_channel_subscriptions(tab_type) WHERE tab_type = 'ideation';

-- Add comment to explain tab_type usage
COMMENT ON COLUMN public.user_videos.tab_type IS 'Tab type: usa, spanish, or ideation. Ideation is for user personal content, country tabs are for admin-managed global content.';
COMMENT ON COLUMN public.tracked_channels.tab_type IS 'Tab type: usa, spanish, or ideation. Ideation is for user personal channels, country tabs show admin-added global channels.';
COMMENT ON COLUMN public.user_channel_subscriptions.tab_type IS 'Tab type: usa, spanish, or ideation. Determines which tab receives new videos from this subscription.';

-- Note: No constraint changes needed as tab_type is already a TEXT column that accepts any value
-- The filtering is done at the application level
