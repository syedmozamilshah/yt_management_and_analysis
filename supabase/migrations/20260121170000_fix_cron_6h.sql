-- Fix cron job to run every 6 hours (not 4) to save quota
-- Also add is_global column to user_channel_subscriptions

-- 1. Unschedule old job
DO $$ 
BEGIN
  PERFORM cron.unschedule('update-view-counts-frequent');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- 2. Schedule new job every 6 hours
SELECT cron.schedule(
  'update-view-counts-6h',
  '0 */6 * * *', -- Every 6 hours
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

-- 3. Add is_global column to user_channel_subscriptions
ALTER TABLE public.user_channel_subscriptions 
ADD COLUMN IF NOT EXISTS is_global BOOLEAN DEFAULT false;

-- 4. Update trigger to sync new videos from global channels to ALL users
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
    FOR v_user_id IN SELECT id FROM public.profiles LOOP
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
