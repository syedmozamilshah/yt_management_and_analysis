-- ============================================
-- Admin Global Channels/Niches Feature
-- ============================================
-- Allows admin to add channels and niches that appear for ALL users
-- Videos from global channels sync to all user_videos automatically

-- 1. Create admin_global_channels table
CREATE TABLE IF NOT EXISTS public.admin_global_channels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id TEXT NOT NULL UNIQUE,
  channel_name TEXT NOT NULL,
  channel_thumbnail TEXT,
  channel_subscribers INTEGER,
  niche TEXT NOT NULL,
  video_range_start DATE, -- Optional: only sync videos from this date
  video_range_end DATE,   -- Optional: only sync videos until this date
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.admin_global_channels ENABLE ROW LEVEL SECURITY;

-- Only admin can manage global channels
CREATE POLICY "Admin can manage global channels" 
  ON public.admin_global_channels 
  FOR ALL 
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- All authenticated users can view global channels
CREATE POLICY "Users can view global channels"
  ON public.admin_global_channels
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- 2. Create admin_global_niches table (niches available to all users)
CREATE TABLE IF NOT EXISTS public.admin_global_niches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  niche TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.admin_global_niches ENABLE ROW LEVEL SECURITY;

-- Only admin can manage global niches
CREATE POLICY "Admin can manage global niches" 
  ON public.admin_global_niches 
  FOR ALL 
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- All authenticated users can view global niches
CREATE POLICY "Users can view global niches"
  ON public.admin_global_niches
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- 3. Function to sync global channel videos to all users
CREATE OR REPLACE FUNCTION public.sync_global_channel_to_all_users()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_video RECORD;
BEGIN
  -- When a new global channel is added, sync its videos to all users
  IF TG_OP = 'INSERT' THEN
    -- First, track the channel for all users
    FOR v_user_id IN SELECT id FROM auth.users LOOP
      INSERT INTO public.tracked_channels (
        user_id,
        channel_id,
        channel_name,
        channel_thumbnail,
        is_global
      ) VALUES (
        v_user_id,
        NEW.channel_id,
        NEW.channel_name,
        NEW.channel_thumbnail,
        true -- Mark as global
      ) ON CONFLICT (user_id, channel_id) DO UPDATE SET
        is_global = true,
        channel_name = EXCLUDED.channel_name,
        channel_thumbnail = EXCLUDED.channel_thumbnail;
    END LOOP;
    
    -- Sync existing tracked_videos for this channel to all users
    FOR v_video IN 
      SELECT * FROM public.tracked_videos 
      WHERE channel_id = NEW.channel_id
    LOOP
      FOR v_user_id IN SELECT id FROM auth.users LOOP
        INSERT INTO public.user_videos (
          user_id,
          video_id,
          title,
          youtube_url,
          thumbnail_url,
          channel_name,
          channel_subscribers,
          upload_date,
          view_count,
          niche,
          channel_id,
          is_global
        ) VALUES (
          v_user_id,
          v_video.video_id,
          v_video.title,
          'https://www.youtube.com/watch?v=' || v_video.video_id,
          v_video.thumbnail_url,
          v_video.channel_name,
          NEW.channel_subscribers,
          v_video.published_at::date,
          COALESCE(v_video.view_count, 0),
          NEW.niche,
          v_video.channel_id,
          true -- Mark as global
        ) ON CONFLICT (user_id, video_id) DO UPDATE SET
          is_global = true,
          niche = EXCLUDED.niche;
      END LOOP;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to sync global channel
DROP TRIGGER IF EXISTS trigger_sync_global_channel ON public.admin_global_channels;
CREATE TRIGGER trigger_sync_global_channel
  AFTER INSERT ON public.admin_global_channels
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_global_channel_to_all_users();

-- 4. Add is_global column to tracked_channels and user_videos
ALTER TABLE public.tracked_channels 
ADD COLUMN IF NOT EXISTS is_global BOOLEAN DEFAULT false;

ALTER TABLE public.user_videos 
ADD COLUMN IF NOT EXISTS is_global BOOLEAN DEFAULT false;

ALTER TABLE public.user_videos 
ADD COLUMN IF NOT EXISTS channel_id TEXT;

-- 5. Function to sync new tracked_videos from global channels to all users
CREATE OR REPLACE FUNCTION public.sync_new_global_video_to_users()
RETURNS TRIGGER AS $$
DECLARE
  v_global_channel RECORD;
  v_user_id UUID;
BEGIN
  -- Check if this video is from a global channel
  SELECT * INTO v_global_channel 
  FROM public.admin_global_channels 
  WHERE channel_id = NEW.channel_id AND is_active = true;
  
  IF v_global_channel IS NOT NULL THEN
    -- Sync to all users
    FOR v_user_id IN SELECT id FROM auth.users LOOP
      INSERT INTO public.user_videos (
        user_id,
        video_id,
        title,
        youtube_url,
        thumbnail_url,
        channel_name,
        channel_subscribers,
        upload_date,
        view_count,
        niche,
        channel_id,
        is_global
      ) VALUES (
        v_user_id,
        NEW.video_id,
        NEW.title,
        'https://www.youtube.com/watch?v=' || NEW.video_id,
        NEW.thumbnail_url,
        NEW.channel_name,
        v_global_channel.channel_subscribers,
        NEW.published_at::date,
        COALESCE(NEW.view_count, 0),
        v_global_channel.niche,
        NEW.channel_id,
        true
      ) ON CONFLICT (user_id, video_id) DO UPDATE SET
        view_count = EXCLUDED.view_count,
        is_global = true;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new videos from global channels
DROP TRIGGER IF EXISTS trigger_sync_new_global_video ON public.tracked_videos;
CREATE TRIGGER trigger_sync_new_global_video
  AFTER INSERT ON public.tracked_videos
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_new_global_video_to_users();

-- 6. Function to sync global niche to all users
CREATE OR REPLACE FUNCTION public.sync_global_niche_to_users()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    FOR v_user_id IN SELECT id FROM auth.users LOOP
      INSERT INTO public.user_niches (
        user_id,
        niche,
        is_global
      ) VALUES (
        v_user_id,
        NEW.niche,
        true
      ) ON CONFLICT (user_id, niche) DO UPDATE SET
        is_global = true;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add is_global to user_niches
ALTER TABLE public.user_niches 
ADD COLUMN IF NOT EXISTS is_global BOOLEAN DEFAULT false;

-- Trigger to sync global niche
DROP TRIGGER IF EXISTS trigger_sync_global_niche ON public.admin_global_niches;
CREATE TRIGGER trigger_sync_global_niche
  AFTER INSERT ON public.admin_global_niches
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_global_niche_to_users();

-- 7. Improve view count update frequency
-- Update the cron job to run every 4 hours instead of twice daily
-- First unschedule old job (ignore if doesn't exist)
DO $$ 
BEGIN
  PERFORM cron.unschedule('update-view-counts-batch-daily');
EXCEPTION WHEN OTHERS THEN
  -- Job doesn't exist, that's fine
  NULL;
END $$;

-- Also try to unschedule the frequent one in case it exists
DO $$ 
BEGIN
  PERFORM cron.unschedule('update-view-counts-frequent');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'update-view-counts-frequent',
  '0 */4 * * *', -- Every 4 hours
  $$
  SELECT net.http_post(
    url := 'https://baffhoalkllpeugluyon.supabase.co/functions/v1/update-view-counts-batch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhZmZob2Fsa2xscGV1Z2x1eW9uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzI5OTc5NDgsImV4cCI6MjA0ODU3Mzk0OH0.RfxPpx1Gt3LbpKYv5HU2NxN-lh2EsEzC8aYuMxhDJ68'
    ),
    body := '{"maxQuota": 100}'::jsonb
  );
  $$
);

-- 8. Also update view counts when user opens ideation page (via edge function call)
-- This is handled client-side, but we create index for efficiency
-- First add updated_at column if it doesn't exist
ALTER TABLE public.user_videos 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_user_videos_view_update 
  ON public.user_videos(updated_at ASC NULLS FIRST, user_id);

-- 9. Function to sync global content to newly registered users
CREATE OR REPLACE FUNCTION public.sync_global_content_to_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_channel RECORD;
  v_video RECORD;
  v_niche RECORD;
BEGIN
  -- Sync all global niches
  FOR v_niche IN SELECT * FROM public.admin_global_niches WHERE is_active = true LOOP
    INSERT INTO public.user_niches (user_id, niche, is_global)
    VALUES (NEW.id, v_niche.niche, true)
    ON CONFLICT (user_id, niche) DO NOTHING;
  END LOOP;
  
  -- Sync all global channels and their videos
  FOR v_channel IN SELECT * FROM public.admin_global_channels WHERE is_active = true LOOP
    -- Add tracked channel
    INSERT INTO public.tracked_channels (
      user_id, channel_id, channel_name, channel_thumbnail, is_global
    ) VALUES (
      NEW.id, v_channel.channel_id, v_channel.channel_name, v_channel.channel_thumbnail, true
    ) ON CONFLICT (user_id, channel_id) DO NOTHING;
    
    -- Add all videos from this channel
    FOR v_video IN 
      SELECT * FROM public.tracked_videos 
      WHERE channel_id = v_channel.channel_id
    LOOP
      INSERT INTO public.user_videos (
        user_id, video_id, title, youtube_url, thumbnail_url, channel_name,
        channel_subscribers, upload_date, view_count, niche, channel_id, is_global
      ) VALUES (
        NEW.id,
        v_video.video_id,
        v_video.title,
        'https://www.youtube.com/watch?v=' || v_video.video_id,
        v_video.thumbnail_url,
        v_video.channel_name,
        v_channel.channel_subscribers,
        v_video.published_at::date,
        COALESCE(v_video.view_count, 0),
        v_channel.niche,
        v_video.channel_id,
        true
      ) ON CONFLICT (user_id, video_id) DO NOTHING;
    END LOOP;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user registration - sync global content
DROP TRIGGER IF EXISTS trigger_sync_global_to_new_user ON public.profiles;
CREATE TRIGGER trigger_sync_global_to_new_user
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_global_content_to_new_user();
