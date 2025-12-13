-- Migration: Add competitor videos table and cron job for competitor channel updates

-- Create competitor_videos table if not exists
CREATE TABLE IF NOT EXISTS competitor_videos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id VARCHAR(255) UNIQUE NOT NULL,
  title TEXT NOT NULL,
  youtube_url TEXT NOT NULL,
  thumbnail_url TEXT,
  channel_name VARCHAR(255),
  channel_subscribers INTEGER,
  view_count INTEGER DEFAULT 0,
  upload_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_competitor_videos_channel ON competitor_videos(channel_name);
CREATE INDEX IF NOT EXISTS idx_competitor_videos_upload ON competitor_videos(upload_date DESC);

-- Enable RLS
ALTER TABLE competitor_videos ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read competitor videos
CREATE POLICY "Authenticated users can view competitor videos" 
  ON competitor_videos FOR SELECT 
  USING (auth.role() = 'authenticated');

-- Allow service role to manage competitor videos
CREATE POLICY "Service role can manage competitor videos" 
  ON competitor_videos FOR ALL 
  USING (auth.role() = 'service_role');

-- Create user_competitor_channels table if not exists
CREATE TABLE IF NOT EXISTS user_competitor_channels (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel_name VARCHAR(255) NOT NULL,
  channel_id VARCHAR(255) NOT NULL,
  channel_subscribers INTEGER,
  total_videos INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, channel_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_competitor_channels_user ON user_competitor_channels(user_id);
CREATE INDEX IF NOT EXISTS idx_user_competitor_channels_channel ON user_competitor_channels(channel_id);

-- Enable RLS
ALTER TABLE user_competitor_channels ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view their own competitor channels" ON user_competitor_channels;
DROP POLICY IF EXISTS "Users can insert their own competitor channels" ON user_competitor_channels;
DROP POLICY IF EXISTS "Users can delete their own competitor channels" ON user_competitor_channels;
DROP POLICY IF EXISTS "Admins can view all competitor channels" ON user_competitor_channels;

-- Users can view their own competitor channels
CREATE POLICY "Users can view their own competitor channels" 
  ON user_competitor_channels FOR SELECT 
  USING (auth.uid() = user_id);

-- Users can insert their own competitor channels
CREATE POLICY "Users can insert their own competitor channels" 
  ON user_competitor_channels FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own competitor channels
CREATE POLICY "Users can delete their own competitor channels" 
  ON user_competitor_channels FOR DELETE 
  USING (auth.uid() = user_id);

-- Admins can view all competitor channels
CREATE POLICY "Admins can view all competitor channels" 
  ON user_competitor_channels FOR SELECT 
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- Enable pg_cron extension (requires superuser, usually done by Supabase)
-- This needs to be run manually in the Supabase dashboard SQL editor if not already enabled
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule cron job to run every 12 hours
-- This needs to be run in the Supabase dashboard SQL editor with admin privileges:
-- 
-- SELECT cron.schedule(
--   'update-competitor-channels-every-12-hours',
--   '0 */12 * * *', -- Every 12 hours at minute 0
--   $$
--   SELECT net.http_post(
--     url := 'https://baffhoalkllpeugluyon.supabase.co/functions/v1/update-competitor-channels',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
--     ),
--     body := '{}'::jsonb
--   );
--   $$
-- );

-- Alternative: Use Supabase edge function scheduled trigger
-- In your supabase/functions/update-competitor-channels/index.ts, add:
-- export const schedule = "0 */12 * * *"; // Every 12 hours
