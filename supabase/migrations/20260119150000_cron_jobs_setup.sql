-- ============================================
-- Cron Job for Daily View Count Updates
-- ============================================
-- Run this in the Supabase SQL Editor to set up the cron job
-- Requires pg_cron and pg_net extensions (enabled by default on Supabase)

-- Schedule view count batch update to run twice daily (at 6 AM and 6 PM UTC)
-- This updates view counts for tracked_videos and user_videos efficiently
-- QUOTA COST: ~1 unit per 50 videos = ~20 units for 1000 videos
SELECT cron.schedule(
  'update-view-counts-batch-daily',
  '0 6,18 * * *', -- At 6:00 AM and 6:00 PM UTC
  $$
  SELECT net.http_post(
    url := 'https://baffhoalkllpeugluyon.supabase.co/functions/v1/update-view-counts-batch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhZmZob2Fsa2xscGV1Z2x1eW9uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzI5OTc5NDgsImV4cCI6MjA0ODU3Mzk0OH0.RfxPpx1Gt3LbpKYv5HU2NxN-lh2EsEzC8aYuMxhDJ68'
    ),
    body := '{"limit": 500}'::jsonb
  );
  $$
);

-- Schedule RSS polling every 5 minutes to catch new videos
SELECT cron.schedule(
  'poll-rss-feeds-every-5-minutes',
  '*/5 * * * *', -- Every 5 minutes
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

-- To view scheduled jobs:
-- SELECT * FROM cron.job;

-- To view job run history:
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;

-- To unschedule a job:
-- SELECT cron.unschedule('update-view-counts-batch-daily');
-- SELECT cron.unschedule('poll-rss-feeds-every-5-minutes');
