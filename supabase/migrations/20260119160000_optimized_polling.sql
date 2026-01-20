-- ============================================
-- Optimized Channel Polling & View Count Updates
-- ============================================
-- Only poll/update channels that have active subscribers (within 3 days)

-- Drop existing functions to allow signature change
DROP FUNCTION IF EXISTS public.get_channels_for_rss_poll();
DROP FUNCTION IF EXISTS public.get_channels_with_active_users(INTEGER);

-- Function to get channels for RSS polling (only with active subscribers)
CREATE OR REPLACE FUNCTION public.get_channels_for_rss_poll()
RETURNS TABLE (
  channel_id TEXT,
  channel_name TEXT,
  rss_feed_url TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT 
    tc.channel_id,
    tc.channel_name,
    tc.rss_feed_url
  FROM public.tracked_channels tc
  WHERE tc.is_active = true
    AND tc.rss_feed_url IS NOT NULL
    -- Only poll channels that have at least one active subscriber
    AND EXISTS (
      SELECT 1 
      FROM public.user_channel_subscriptions ucs
      LEFT JOIN public.user_activity ua ON ua.user_id = ucs.user_id
      WHERE ucs.channel_id = tc.channel_id
        AND ucs.is_active = true
        -- User is active if they've opened ideation in last 3 days OR no activity record exists (new user)
        AND (
          ua.user_id IS NULL 
          OR ua.last_ideation_opened_at IS NULL 
          OR ua.last_ideation_opened_at > now() - INTERVAL '3 days'
        )
    )
  ORDER BY tc.channel_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get channels with active users (for view count updates)
CREATE OR REPLACE FUNCTION public.get_channels_with_active_users(active_days INTEGER DEFAULT 3)
RETURNS TABLE (channel_id TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ucs.channel_id
  FROM public.user_channel_subscriptions ucs
  JOIN public.user_activity ua ON ua.user_id = ucs.user_id
  WHERE ucs.is_active = true
    AND ua.last_ideation_opened_at > now() - (active_days || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Update Cron Jobs for Optimized Schedule
-- ============================================
-- Remove old cron jobs first
SELECT cron.unschedule('update-view-counts-batch-daily');
SELECT cron.unschedule('poll-rss-feeds-every-5-minutes');

-- Schedule optimized view count updates:
-- Run 4 times daily (every 6 hours) with low quota limit
-- This allows recent videos to update every 6 hours while using minimal quota
SELECT cron.schedule(
  'update-view-counts-optimized',
  '0 */6 * * *', -- Every 6 hours (00:00, 06:00, 12:00, 18:00 UTC)
  $$
  SELECT net.http_post(
    url := 'https://baffhoalkllpeugluyon.supabase.co/functions/v1/update-view-counts-batch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhZmZob2Fsa2xscGV1Z2x1eW9uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzI5OTc5NDgsImV4cCI6MjA0ODU3Mzk0OH0.RfxPpx1Gt3LbpKYv5HU2NxN-lh2EsEzC8aYuMxhDJ68'
    ),
    body := '{"maxQuota": 25, "activeUserDays": 3}'::jsonb
  );
  $$
);

-- RSS polling every 10 minutes (instead of 5) - saves server resources
SELECT cron.schedule(
  'poll-rss-feeds-optimized',
  '*/10 * * * *', -- Every 10 minutes
  $$
  SELECT net.http_post(
    url := 'https://baffhoalkllpeugluyon.supabase.co/functions/v1/poll-rss-feeds',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhZmZob2Fsa2xscGV1Z2x1eW9uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzI5OTc5NDgsImV4cCI6MjA0ODU3Mzk0OH0.RfxPpx1Gt3LbpKYv5HU2NxN-lh2EsEzC8aYuMxhDJ68'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- View current cron jobs
-- SELECT * FROM cron.job;

-- View job history
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;
