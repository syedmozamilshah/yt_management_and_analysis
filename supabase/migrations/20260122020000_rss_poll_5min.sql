-- ============================================
-- Change RSS polling to every 5 minutes for faster video discovery
-- ============================================

-- Remove the old 10-minute cron job
DO $$
BEGIN
  PERFORM cron.unschedule('poll-rss-feeds-optimized');
EXCEPTION WHEN OTHERS THEN
  -- Job doesn't exist, ignore
  NULL;
END $$;

-- Schedule RSS polling every 5 minutes
SELECT cron.schedule(
  'poll-rss-feeds-5min',
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
